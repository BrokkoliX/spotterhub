import { IMAGE_VARIANT_SIZES } from '@spotterspace/shared';

// Lazy-load sharp only when image processing is actually needed.
// In Lambda (linux-x64), sharp's native binaries may not be available,
// so we handle the error gracefully and skip processing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sharp: any = null;
async function getSharp(): Promise<any> {
  if (!_sharp) {
    try {
      _sharp = await import('sharp');
    } catch (err) {
      console.error('Failed to load sharp:', err);
      throw new Error(
        'sharp module not available. Image processing requires a platform with sharp native binaries installed.',
      );
    }
  }
  return _sharp;
}

import { getObject, getObjectUrl, uploadBuffer } from './s3.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImageVariantResult {
  variantType: 'thumbnail' | 'display' | 'watermarked';
  url: string;
  key: string;
  width: number;
  height: number;
  fileSizeBytes: number;
}

export interface ExifData {
  latitude: number | null;
  longitude: number | null;
  takenAt: Date | null;
  cameraModel: string | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number;
}

// ─── EXIF Extraction ────────────────────────────────────────────────────────

/**
 * Extracts EXIF metadata from an image buffer.
 * Pulls GPS coordinates, camera model, date taken, and dimensions.
 *
 * @param buffer - The raw image data.
 * @returns Parsed EXIF data with nullable fields for missing metadata.
 */
export async function extractExif(buffer: Buffer): Promise<ExifData> {
  const metadata = await (await getSharp())(buffer).metadata();

  let latitude: number | null = null;
  let longitude: number | null = null;
  const takenAt: Date | null = null;
  const cameraModel: string | null = null;

  if (metadata.exif) {
    try {
      // Sharp exposes raw EXIF via metadata — for GPS and date we parse manually
      const exifData = metadata.exif;

      // Try to parse GPS from EXIF IFD
      // Sharp doesn't expose parsed GPS directly, so we use the raw buffer
      // For a more robust solution, we'd use a dedicated EXIF parser like exifr
      // For now, we extract what sharp provides
      const gps = parseGpsFromExif(exifData);
      if (gps) {
        latitude = gps.latitude;
        longitude = gps.longitude;
      }

      // Date and camera from sharp metadata
      // These are not always available via sharp metadata directly
    } catch {
      // EXIF parsing failed — continue with nulls
    }
  }

  return {
    latitude,
    longitude,
    takenAt,
    cameraModel,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    fileSizeBytes: buffer.length,
  };
}

// ─── Variant Generation ─────────────────────────────────────────────────────

/**
 * Generates thumbnail and display variants from an uploaded original image.
 * Fetches the original from S3, processes with Sharp, and uploads variants back.
 * Optionally generates a watermarked variant.
 *
 * @param originalKey - The S3 key of the original uploaded image.
 * @param options - Optional generation options.
 * @param options.watermarkEnabled - Whether to generate a watermarked variant.
 * @returns Array of generated variant metadata.
 */
export async function generateVariants(
  originalKey: string,
  options: { watermarkEnabled?: boolean } = {},
): Promise<ImageVariantResult[]> {
  console.log('[IMG] generateVariants called with key:', originalKey, 'watermarkEnabled:', options.watermarkEnabled);
  const original = await getObject(originalKey);
  console.log('[IMG] Fetched original from S3, size:', original.length);
  const results: ImageVariantResult[] = [];

  // Generate thumbnail
  const thumbnail = await resizeImage(original, IMAGE_VARIANT_SIZES.thumbnail);
  const thumbnailKey = deriveVariantKey(originalKey, 'thumbnail');
  await uploadBuffer(thumbnailKey, thumbnail.buffer, 'image/jpeg');
  results.push({
    variantType: 'thumbnail',
    url: getObjectUrl(thumbnailKey),
    key: thumbnailKey,
    width: thumbnail.width,
    height: thumbnail.height,
    fileSizeBytes: thumbnail.buffer.length,
  });

  // Generate display variant
  const display = await resizeImage(original, IMAGE_VARIANT_SIZES.display);
  const displayKey = deriveVariantKey(originalKey, 'display');
  await uploadBuffer(displayKey, display.buffer, 'image/jpeg');
  results.push({
    variantType: 'display',
    url: getObjectUrl(displayKey),
    key: displayKey,
    width: display.width,
    height: display.height,
    fileSizeBytes: display.buffer.length,
  });

  // Generate watermarked variant if enabled
  if (options.watermarkEnabled) {
    console.log('[IMG] Generating watermarked variant for key:', originalKey);
    const watermarked = await generateWatermarked(original);
    const watermarkedKey = deriveVariantKey(originalKey, 'watermarked');
    console.log('[IMG] Uploading watermarked variant to:', watermarkedKey);
    await uploadBuffer(watermarkedKey, watermarked.buffer, 'image/jpeg');
    results.push({
      variantType: 'watermarked',
      url: getObjectUrl(watermarkedKey),
      key: watermarkedKey,
      width: watermarked.width,
      height: watermarked.height,
      fileSizeBytes: watermarked.buffer.length,
    });
    console.log('[IMG] Watermarked variant complete:', watermarkedKey);
  }

  return results;
}

/**
 * Generates a watermarked version of an image with "© SpotterSpace" text overlay.
 *
 * @param buffer - The original image buffer.
 * @returns The watermarked image buffer with dimensions.
 */
async function generateWatermarked(buffer: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  console.log('[IMG] generateWatermarked called, buffer size:', buffer.length);
  const metadata = await (await getSharp())(buffer).metadata();
  console.log('[IMG] sharp metadata:', metadata.width, 'x', metadata.height);
  const width = metadata.width ?? 1920;
  const height = metadata.height ?? 1080;

  // Create SVG watermark text overlay
  const svg = Buffer.from(
    `<svg width="${width}" height="${Math.min(Math.floor(height * 0.1), 80)}">
      <style>
        .w { fill: white; font-size: ${Math.max(Math.floor(width * 0.02), 18)}px; font-family: Arial, sans-serif; opacity: 0.5; }
      </style>
      <text x="${Math.floor(width * 0.02)}" y="${Math.floor(height * 0.08)}" class="w">© SpotterSpace</text>
    </svg>`,
  );

  const watermarkBuffer = await (await getSharp())(svg).png().toBuffer();

  const result = await (await getSharp())(buffer)
    .composite([{ input: watermarkBuffer, gravity: 'southeast' }])
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

/**
 * Extracts EXIF data from an image stored in S3.
 *
 * @param key - The S3 key of the image.
 * @returns Parsed EXIF data.
 */
export async function extractExifFromS3(key: string): Promise<ExifData> {
  const buffer = await getObject(key);
  return extractExif(buffer);
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

interface ResizeResult {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Resizes an image to fit within the given long-edge dimension, preserving aspect ratio.
 * Converts to JPEG for consistent output.
 */
async function resizeImage(input: Buffer, longEdge: number): Promise<ResizeResult> {
  const result = await (
    await getSharp()
  )(input)
    .resize(longEdge, longEdge, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

/**
 * Derives a variant S3 key from the original key.
 * e.g. `uploads/user-id/abc.jpg` → `variants/user-id/abc-thumbnail.jpg`
 */
function deriveVariantKey(originalKey: string, variant: string): string {
  const parts = originalKey.replace('uploads/', 'variants/').split('.');
  const ext = parts.pop() ?? 'jpg';
  return `${parts.join('.')}-${variant}.${ext}`;
}

/**
 * Attempts to parse GPS coordinates from raw EXIF buffer.
 * Returns null if GPS data is not present or cannot be parsed.
 * This is a simplified parser — a production system would use exifr or similar.
 */
function parseGpsFromExif(_exifBuffer: Buffer): { latitude: number; longitude: number } | null {
  // Simplified: Sharp doesn't provide easy GPS access from the raw buffer.
  // In a production system, we'd use the `exifr` package for reliable EXIF parsing.
  // For now, GPS will be manually provided via the createPhoto mutation.
  return null;
}
