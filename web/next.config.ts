import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Use import.meta.url since `__dirname` isn't always reliable in TS+ESM.
const HERE = path.dirname(fileURLToPath(import.meta.url));

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
  // Pin the workspace root to web/ so Turbopack/PostCSS stays inside this
  // package and doesn't go searching the parent dirs (where there's no
  // package.json).
  turbopack: {
    root: HERE,
  },
};

export default nextConfig;
