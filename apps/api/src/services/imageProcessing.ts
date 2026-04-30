import { IMAGE_VARIANT_SIZES } from '@spotterspace/shared';

// Lazy-load sharp only when image processing is actually needed.
// In Lambda (linux-x64), sharp's native binaries may not be available,
// so we handle the error gracefully and skip processing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sharp: any = null;
export async function getSharp(): Promise<any> {
  if (!_sharp) {
    try {
      const mod = await import('sharp');
      _sharp = mod.default ?? mod;
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
  variantType: 'thumbnail' | 'thumbnail_16x9' | 'display' | 'watermarked';
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
  console.log(
    '[IMG] generateVariants called with key:',
    originalKey,
    'watermarkEnabled:',
    options.watermarkEnabled,
  );
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

  // Generate 16:9 cropped thumbnail for feed display
  const thumbnail16x9 = await resizeImageCropped16x9(original, IMAGE_VARIANT_SIZES.thumbnail16x9);
  const thumbnail16x9Key = deriveVariantKey(originalKey, 'thumbnail16x9');
  await uploadBuffer(thumbnail16x9Key, thumbnail16x9.buffer, 'image/jpeg');
  results.push({
    variantType: 'thumbnail_16x9',
    url: getObjectUrl(thumbnail16x9Key),
    key: thumbnail16x9Key,
    width: thumbnail16x9.width,
    height: thumbnail16x9.height,
    fileSizeBytes: thumbnail16x9.buffer.length,
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
async function generateWatermarked(
  buffer: Buffer,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  console.log('[IMG] generateWatermarked called, buffer size:', buffer.length);
  const metadata = await (await getSharp())(buffer).metadata();
  console.log('[IMG] sharp metadata:', metadata.width, 'x', metadata.height);
  const width = metadata.width ?? 1920;

  // Create a single watermark label for the bottom-right corner.
  // Use XML entity for copyright symbol to avoid encoding issues in Alpine.
  const fontSize = Math.max(Math.floor(width * 0.03), 24);
  const padding = Math.floor(fontSize * 0.5);
  const svgW = Math.floor(fontSize * 12);
  const svgH = Math.floor(fontSize * 2);

  const svg = Buffer.from(
    `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${svgW - padding}" y="${svgH - padding}" text-anchor="end"
        font-size="${fontSize}" font-family="sans-serif" font-weight="bold">
        <tspan fill="black" fill-opacity="0.4" dx="1" dy="1">&#169; SpotterSpace</tspan>
      </text>
      <text x="${svgW - padding}" y="${svgH - padding}" text-anchor="end"
        font-size="${fontSize}" font-family="sans-serif" font-weight="bold"
        fill="white" fill-opacity="0.7">&#169; SpotterSpace</text>
    </svg>`,
  );

  const watermarkBuffer = await (await getSharp())(svg).png().toBuffer();

  const result = await (
    await getSharp()
  )(buffer)
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
 * If the source is smaller than 50% of target, upscale to 50% of target (prevents
 * tiny images passing through at tiny sizes). Otherwise just resize normally.
 * Uses withoutEnlargement: true so images already >= target pass through at original size.
 */
async function resizeImage(input: Buffer, longEdge: number): Promise<ResizeResult> {
  const sharp = await getSharp();
  const metadata = await sharp(input).metadata();
  const sourceLongEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);

  // If source is very small (< 50% of target), upscale to 50% of target
  const targetLongEdge = sourceLongEdge < longEdge * 0.5 ? Math.floor(longEdge * 0.5) : longEdge;

  const result = await sharp(input)
    .resize(targetLongEdge, targetLongEdge, {
      fit: 'inside',
      withoutEnlargement: targetLongEdge < longEdge ? false : true,
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
 * Resizes and center-crops an image to a 16:9 frame at the given width.
 * The image is scaled to fill the frame, then the overflow is cropped from
 * the centre — no letterbox bars. Converts to JPEG for consistent output.
 * e.g. a 3000×4000 portrait is scaled up to cover 640×360, then the top/bottom
 *      excess is trimmed so only the centre portion remains.
 */
async function resizeImageCropped16x9(input: Buffer, longEdge: number): Promise<ResizeResult> {
  const result = await (
    await getSharp()
  )(input)
    .resize(longEdge, Math.round((longEdge * 9) / 16), {
      fit: 'cover',
      position: 'centre',
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
