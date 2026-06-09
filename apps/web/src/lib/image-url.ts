// Client-safe URL helpers. This file must NOT import 'server-only' — it's used
// by both server components (for Open Graph metadata) and client components
// (for rendering S3 image URLs in the browser). Only reads NEXT_PUBLIC_ env
// vars so the values are inlined into client bundles.

/**
 * Base URL of the CDN that serves S3 objects in production. Use to build
 * public URLs from S3 object keys (e.g. after an upload).
 */
export const CDN_BASE =
  process.env.NEXT_PUBLIC_S3_IMAGES_HOST ?? 'https://d2ur47prd8ljwz.cloudfront.net';

/**
 * Public base URL of the web app. Used to build absolute canonical URLs in
 * metadata (og:url, canonical, default OG image fallback) and to share buttons
 * on the client. Falls back to localhost in dev.
 */
export const WEB_BASE = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

/**
 * Rewrite LocalStack S3 URLs (http://localhost:4566/bucket/key) to the
 * configured CDN host. In dev, photos come back pointing at LocalStack; for
 * OG metadata (which is fetched by Facebook/Twitter crawlers, not the
 * browser) and for the `<img src>` in client components, we want a
 * CloudFront URL.
 */
export function fixLocalhostUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\/localhost:4566\/[^/]+\//, `${CDN_BASE}/`);
}
