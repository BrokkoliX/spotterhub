import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
    return [
      {
        source: '/api/graphql',
        destination: apiUrl,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4566",
        pathname: "/spotterhub-photos/**",
      },
      {
        protocol: "https",
        hostname: "d2ur47prd8ljwz.cloudfront.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: process.env.NEXT_PUBLIC_S3_IMAGES_HOST ?? "d2ur47prd8ljwz.cloudfront.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
