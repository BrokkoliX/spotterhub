import {
  IMAGE_VARIANT_SIZES,
  WATERMARK_DEFAULTS,
  WatermarkPosition,
  type WatermarkConfig,
} from '@spotterspace/shared';

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
 * Hard upper bound on how long a single `generateVariants` call may take.
 *
 * Sharp variant generation runs on the libuv thread pool and uploads to S3.
 * On a 0.5-vCPU Fargate task a normal call completes in 2-8 seconds. We cap
 * at 30 seconds so that an upstream stall (S3 hung, oversized image, runaway
 * encode) cannot pin the request thread indefinitely and amplify into a
 * multi-minute portal outage. Override with `IMAGE_VARIANT_TIMEOUT_MS`.
 */
const IMAGE_VARIANT_TIMEOUT_MS = Number.parseInt(
  process.env.IMAGE_VARIANT_TIMEOUT_MS ?? '30000',
  10,
);

/**
 * Race a promise against a timeout. Resolves with the promise's value or
 * rejects with a descriptive Error after `timeoutMs`.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    // Don't keep the event loop alive solely for this timer.
    timer.unref?.();
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Options accepted by `generateVariants`.
 *
 * `watermark.enabled` controls whether a `watermarked` variant is rendered.
 * `watermark.config` (optional) provides the per-photo position/size/opacity
 * overrides. When omitted while `enabled` is true, `WATERMARK_DEFAULTS` is
 * used so legacy callers still produce a sensible watermark.
 */
export interface GenerateVariantsOptions {
  watermark?: {
    enabled: boolean;
    config?: WatermarkConfig;
  };
}

/**
 * Generates thumbnail and display variants from an uploaded original image.
 * Fetches the original from S3, processes with Sharp, and uploads variants back.
 * Optionally generates a watermarked variant.
 *
 * Wrapped in a timeout (`IMAGE_VARIANT_TIMEOUT_MS`, default 30s) so that a
 * stalled S3 call or a runaway encode cannot hold the GraphQL request open
 * for minutes. Callers already wrap this in try/catch and surface a clean
 * error to the user.
 *
 * @param originalKey - The S3 key of the original uploaded image.
 * @param options - Optional generation options including watermark settings.
 * @returns Array of generated variant metadata.
 */
export function generateVariants(
  originalKey: string,
  options: GenerateVariantsOptions = {},
): Promise<ImageVariantResult[]> {
  return withTimeout(
    generateVariantsImpl(originalKey, options),
    IMAGE_VARIANT_TIMEOUT_MS,
    `generateVariants(${originalKey})`,
  );
}

async function generateVariantsImpl(
  originalKey: string,
  options: GenerateVariantsOptions = {},
): Promise<ImageVariantResult[]> {
  const watermarkEnabled = options.watermark?.enabled ?? false;
  const watermarkConfig = options.watermark?.config ?? WATERMARK_DEFAULTS;
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(
      '[IMG] generateVariants called with key:',
      originalKey,
      'watermarkEnabled:',
      watermarkEnabled,
    );
  }
  const original = await getObject(originalKey);
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('[IMG] Fetched original from S3, size:', original.length);
  }
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
  if (watermarkEnabled) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(
        '[IMG] Generating watermarked variant for key:',
        originalKey,
        'config:',
        watermarkConfig,
      );
    }
    const watermarked = await generateWatermarked(original, watermarkConfig);
    const watermarkedKey = deriveVariantKey(originalKey, 'watermarked');
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[IMG] Uploading watermarked variant to:', watermarkedKey);
    }
    await uploadBuffer(watermarkedKey, watermarked.buffer, 'image/jpeg');
    results.push({
      variantType: 'watermarked',
      url: getObjectUrl(watermarkedKey),
      key: watermarkedKey,
      width: watermarked.width,
      height: watermarked.height,
      fileSizeBytes: watermarked.buffer.length,
    });
    if (process.env.LOG_LEVEL === 'debug') {
      console.log('[IMG] Watermarked variant complete:', watermarkedKey);
    }
  }

  return results;
}

/**
 * Generates a watermarked version of an image with "© SpotterSpace" text overlay,
 * positioned, sized, and opacity-tuned according to the supplied config.
 *
 * The watermark text and brand are intentionally fixed (`© SpotterSpace`) per
 * the platform's "no personal watermarks" upload policy. Users control where
 * the mark sits, how big it is, and how visible it is — but not what it says.
 *
 * @param buffer - The original image buffer.
 * @param config - Per-photo watermark settings (position, size %, opacity %).
 * @returns The watermarked image buffer with dimensions.
 */
async function generateWatermarked(
  buffer: Buffer,
  config: WatermarkConfig,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('[IMG] generateWatermarked called, buffer size:', buffer.length, 'config:', config);
  }
  const sharp = await getSharp();
  const metadata = await sharp(buffer).metadata();
  if (process.env.LOG_LEVEL === 'debug') {
    console.log('[IMG] sharp metadata:', metadata.width, 'x', metadata.height);
  }
  const imageWidth = metadata.width ?? 1920;
  const imageHeight = metadata.height ?? 1080;
  const longEdge = Math.max(imageWidth, imageHeight);

  // Font size: percentage of the long edge, with a hard floor so very small
  // images still have legible attribution.
  const fontSize = Math.max(Math.floor((longEdge * config.sizePct) / 100), 24);
  const padding = Math.floor(fontSize * 0.5);

  // Estimate the rendered text width. Sharp can't measure SVG text directly,
  // so we approximate using a typical sans-serif advance width (~0.6em per
  // character). "© SpotterSpace" is 14 characters; we round up generously to
  // avoid clipping at large sizes.
  const text = '\u00A9 SpotterSpace';
  const approxTextWidth = Math.ceil(fontSize * 0.62 * text.length);
  const svgW = approxTextWidth + padding * 2;
  const svgH = Math.ceil(fontSize * 1.6) + padding;

  // Map the position enum onto SVG text alignment and Sharp gravity.
  const horizontal = horizontalFromPosition(config.position);
  const vertical = verticalFromPosition(config.position);

  // SVG anchor: x at left/middle/right of the canvas; y baseline at the
  // top/middle/bottom band. We align inside the SVG so the same canvas can be
  // used at any of the 9 gravity anchors without misalignment when composited.
  let textX: number;
  let textAnchor: 'start' | 'middle' | 'end';
  if (horizontal === 'left') {
    textX = padding;
    textAnchor = 'start';
  } else if (horizontal === 'center') {
    textX = Math.floor(svgW / 2);
    textAnchor = 'middle';
  } else {
    textX = svgW - padding;
    textAnchor = 'end';
  }

  let textY: number;
  if (vertical === 'top') {
    textY = padding + fontSize;
  } else if (vertical === 'middle') {
    textY = Math.floor(svgH / 2 + fontSize / 2.5);
  } else {
    textY = svgH - padding;
  }

  const opacity = config.opacityPct / 100;
  // Drop shadow opacity scales with the main fill so the shadow remains
  // proportional at all opacities (legacy default 0.7 fill / 0.4 shadow).
  const shadowOpacity = Math.min(1, opacity * (0.4 / 0.7));

  const svg = Buffer.from(
    `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
      <text x="${textX}" y="${textY}" text-anchor="${textAnchor}"
        font-size="${fontSize}" font-family="sans-serif" font-weight="bold">
        <tspan fill="black" fill-opacity="${shadowOpacity.toFixed(3)}" dx="1" dy="1">&#169; SpotterSpace</tspan>
      </text>
      <text x="${textX}" y="${textY}" text-anchor="${textAnchor}"
        font-size="${fontSize}" font-family="sans-serif" font-weight="bold"
        fill="white" fill-opacity="${opacity.toFixed(3)}">&#169; SpotterSpace</text>
    </svg>`,
  );

  const watermarkBuffer = await sharp(svg).png().toBuffer();

  const result = await sharp(buffer)
    .composite([{ input: watermarkBuffer, gravity: gravityFromPosition(config.position) }])
    .jpeg({ quality: 90 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

/** Maps a 9-point position to a horizontal band for SVG text alignment. */
function horizontalFromPosition(position: WatermarkPosition): 'left' | 'center' | 'right' {
  switch (position) {
    case WatermarkPosition.TOP_LEFT:
    case WatermarkPosition.MIDDLE_LEFT:
    case WatermarkPosition.BOTTOM_LEFT:
      return 'left';
    case WatermarkPosition.TOP_CENTER:
    case WatermarkPosition.CENTER:
    case WatermarkPosition.BOTTOM_CENTER:
      return 'center';
    case WatermarkPosition.TOP_RIGHT:
    case WatermarkPosition.MIDDLE_RIGHT:
    case WatermarkPosition.BOTTOM_RIGHT:
      return 'right';
  }
}

/** Maps a 9-point position to a vertical band for SVG text alignment. */
function verticalFromPosition(position: WatermarkPosition): 'top' | 'middle' | 'bottom' {
  switch (position) {
    case WatermarkPosition.TOP_LEFT:
    case WatermarkPosition.TOP_CENTER:
    case WatermarkPosition.TOP_RIGHT:
      return 'top';
    case WatermarkPosition.MIDDLE_LEFT:
    case WatermarkPosition.CENTER:
    case WatermarkPosition.MIDDLE_RIGHT:
      return 'middle';
    case WatermarkPosition.BOTTOM_LEFT:
    case WatermarkPosition.BOTTOM_CENTER:
    case WatermarkPosition.BOTTOM_RIGHT:
      return 'bottom';
  }
}

/** Maps a 9-point position to the corresponding Sharp `gravity` value. */
function gravityFromPosition(position: WatermarkPosition): string {
  switch (position) {
    case WatermarkPosition.TOP_LEFT:
      return 'northwest';
    case WatermarkPosition.TOP_CENTER:
      return 'north';
    case WatermarkPosition.TOP_RIGHT:
      return 'northeast';
    case WatermarkPosition.MIDDLE_LEFT:
      return 'west';
    case WatermarkPosition.CENTER:
      return 'centre';
    case WatermarkPosition.MIDDLE_RIGHT:
      return 'east';
    case WatermarkPosition.BOTTOM_LEFT:
      return 'southwest';
    case WatermarkPosition.BOTTOM_CENTER:
      return 'south';
    case WatermarkPosition.BOTTOM_RIGHT:
      return 'southeast';
  }
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
