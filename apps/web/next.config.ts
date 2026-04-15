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
        pathname: "/spotterspace-photos/**",
      },
      {
        protocol: "https",
        hostname: "spotterspace-photos.s3.us-east-1.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
