import type { NextConfig } from 'next';

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
    return [
      {
        source: '/api/graphql',
        destination: apiUrl,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      ...(process.env.NODE_ENV !== 'production'
        ? [
            {
              protocol: 'http' as const,
              hostname: 'localhost',
              port: '4566',
              pathname: '/spotterhub-photos/**',
            },
          ]
        : []),
      {
        protocol: 'https',
        hostname: 'd2ur47prd8ljwz.cloudfront.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_S3_IMAGES_HOST ?? 'd2ur47prd8ljwz.cloudfront.net',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
