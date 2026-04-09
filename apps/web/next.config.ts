import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4566",
        pathname: "/spotterhub-photos/**",
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
