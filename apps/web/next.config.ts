import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
        hostname: "spotterhub-photos.s3.us-east-1.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/graphql",
        destination: "http://localhost:4000/",
      },
    ];
  },
};

export default nextConfig;
