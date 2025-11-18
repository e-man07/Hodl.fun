import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all HTTPS origins for images
      },
      {
        protocol: 'http',
        hostname: '**', // Allow all HTTP origins for images
      },
    ],
  },
};

export default nextConfig;
