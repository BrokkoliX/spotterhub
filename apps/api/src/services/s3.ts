import { randomUUID } from 'node:crypto';

import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Configuration ──────────────────────────────────────────────────────────

const S3_BUCKET = process.env.S3_BUCKET ?? 'spotterhub-photos';
const S3_REGION = process.env.S3_REGION ?? 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT; // e.g. http://localhost:4566 for LocalStack

const s3 = new S3Client({
  region: S3_REGION,
  // Disable default CRC32 checksums — LocalStack 3.x does not support them
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  ...(S3_ENDPOINT && {
    endpoint: S3_ENDPOINT,
    forcePathStyle: true, // Required for LocalStack
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
    },
  }),
});

// ─── Bucket Initialization ──────────────────────────────────────────────────

/**
 * Ensures the S3 bucket exists. Creates it if it doesn't (for local dev).
 * Called once at API startup. Non-fatal — the API will start even if S3 is
 * unreachable (photo uploads will fail until S3 becomes available).
 */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    try {
      console.log(`📦 Creating S3 bucket: ${S3_BUCKET}`);
      await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    } catch {
      console.warn(
        `⚠️  Could not reach S3 (${S3_ENDPOINT ?? 'AWS'}). Photo uploads will be unavailable until S3 is running.`,
      );
      return;
    }
  }

  // Configure CORS so the browser can load images and upload files directly
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ['*'],
              AllowedMethods: ['GET', 'PUT', 'HEAD'],
              AllowedHeaders: ['*'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  } catch {
    console.warn('⚠️  Could not set S3 bucket CORS configuration.');
  }
}

// ─── Presigned URLs ─────────────────────────────────────────────────────────

/**
 * Generates a presigned PUT URL for direct client-side uploads.
 *
 * @param userId - The uploading user's ID (used in the S3 key prefix).
 * @param mimeType - The MIME type of the file being uploaded.
 * @returns An object with the presigned URL and the S3 object key.
 */
export async function getPresignedUploadUrl(
  userId: string,
  mimeType: string,
): Promise<{ url: string; key: string }> {
  const ext = mimeTypeToExtension(mimeType);
  const key = `uploads/${userId}/${randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: mimeType,
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
  return { url, key };
}

/**
 * Generates a presigned GET URL for reading an object.
 *
 * @param key - The S3 object key.
 * @param expiresIn - Seconds until the URL expires (default 1 hour).
 * @returns The presigned GET URL.
 */
export async function getPresignedReadUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

// ─── Upload Variant ─────────────────────────────────────────────────────────

/**
 * Uploads a processed image buffer to S3.
 *
 * @param key - The S3 object key for the variant.
 * @param buffer - The image data.
 * @param mimeType - The MIME type of the processed image.
 */
export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
}

/**
 * Fetches an object from S3 as a Buffer.
 *
 * @param key - The S3 object key.
 * @returns The object data as a Buffer.
 */
export async function getObject(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );
  const stream = response.Body;
  if (!stream) throw new Error(`Empty response for key: ${key}`);

  const chunks: Uint8Array[] = [];
  // @ts-expect-error — S3 Body is a readable stream in Node
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Builds the full object URL for a given S3 key.
 * In dev (LocalStack), returns a direct URL. In prod, this would return a CloudFront URL.
 */
export function getObjectUrl(key: string): string {
  if (S3_ENDPOINT) {
    return `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  }
  // Use CloudFront for prod reads (serves via CDN with proper caching headers)
  return `https://d2ur47prd8ljwz.cloudfront.net/${key}`;
}

function mimeTypeToExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  return map[mimeType] ?? 'jpg';
}
