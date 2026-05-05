import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // We bundle 1,706 images locally — keep them as-is, no Image Optimization Service
  // (would cost money on Vercel for this many unique URLs).
  images: {
    unoptimized: true,
  },
  // Item DB is large; allow client to fetch the JSON imports without warning.
  experimental: {
    largePageDataBytes: 5 * 1024 * 1024,
  },
  // Pin the workspace root so Turbopack stops complaining about parent lockfiles.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
