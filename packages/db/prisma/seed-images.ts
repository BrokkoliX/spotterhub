/**
 * Generate placeholder images for seeded photos and upload them to LocalStack S3.
 * Each photo gets a unique gradient with its caption overlaid as text.
 *
 * Usage: npx tsx prisma/seed-images.ts
 */
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const prisma = new PrismaClient();

const S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:4566';
const S3_BUCKET = process.env.S3_BUCKET ?? 'spotterhub-photos';
const S3_REGION = process.env.S3_REGION ?? 'us-east-1';

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
  },
});

// Color palette — each photo gets a unique gradient
const PALETTES = [
  { from: '#ff6b35', to: '#f7c59f', label: 'Emirates A380' },        // warm orange
  { from: '#1a535c', to: '#4ecdc4', label: 'Alaska 737 MAX' },       // teal
  { from: '#2d3436', to: '#636e72', label: 'F-22 Raptor' },          // dark steel
  { from: '#0c3547', to: '#a0c4ff', label: 'Lufthansa 747' },        // foggy blue
  { from: '#6c5ce7', to: '#a29bfe', label: 'SIA A350' },             // purple
  { from: '#d63031', to: '#fdcb6e', label: 'BA A350' },              // red-gold
];

async function generateImage(
  width: number,
  height: number,
  palette: (typeof PALETTES)[number],
): Promise<Buffer> {
  // Create an SVG gradient with centered text
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${palette.from};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${palette.to};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <text
        x="50%" y="45%"
        font-family="sans-serif"
        font-size="${Math.round(width * 0.06)}"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
        opacity="0.9"
      >${palette.label}</text>
      <text
        x="50%" y="55%"
        font-family="sans-serif"
        font-size="${Math.round(width * 0.025)}"
        fill="white"
        text-anchor="middle"
        dominant-baseline="middle"
        opacity="0.6"
      >${width}x${height} - SpotterHub Dev</text>
    </svg>`;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 85 })
    .toBuffer();
}

function extractS3Key(url: string): string {
  // URL format: http://localhost:4566/spotterhub-photos/uploads/...
  const bucketPrefix = `${S3_ENDPOINT}/${S3_BUCKET}/`;
  return url.replace(bucketPrefix, '');
}

async function uploadToS3(key: string, body: Buffer): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: 'image/jpeg',
    }),
  );
}

async function main() {
  console.log('🖼  Generating placeholder images for seeded photos...');
  console.log();

  const photos = await prisma.photo.findMany({
    include: { variants: true },
    orderBy: { createdAt: 'asc' },
  });

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const palette = PALETTES[i % PALETTES.length];
    const shortCaption = photo.caption?.slice(0, 50) ?? 'Photo';

    // 1. Original (6000×4000)
    const originalKey = extractS3Key(photo.originalUrl);
    const originalBuf = await generateImage(6000, 4000, palette);
    await uploadToS3(originalKey, originalBuf);
    console.log(`  ✅ Original: ${originalKey} (${(originalBuf.length / 1024).toFixed(0)} KB)`);

    // 2. Variants
    for (const variant of photo.variants) {
      const variantKey = extractS3Key(variant.url);
      const variantBuf = await generateImage(variant.width, variant.height, palette);
      await uploadToS3(variantKey, variantBuf);
      console.log(`     ${variant.variantType}: ${variantKey} (${(variantBuf.length / 1024).toFixed(0)} KB)`);
    }

    console.log(`  📷 ${shortCaption}…`);
  }

  console.log(`✅ Done! ${photos.length} photos with images uploaded to S3.`);
}

main()
  .catch((e) => {
    console.error('Image generation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
