// Generate a manifest of which image paths actually exist on disk.
// Used by lib/data.ts to skip setting imageUrl for the ~666 items
// whose source DB references images that aren't in our /public/images.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const IMAGES = path.join(ROOT, "public", "images");
const OUT = path.join(ROOT, "src", "data", "imageManifest.json");

async function walk(dir, baseDir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walk(full, baseDir)));
    } else if (e.isFile()) {
      // Convert Windows backslashes → forward (matches the URL form in allitems)
      const rel = path.relative(baseDir, full).split(path.sep).join("/");
      out.push(rel);
    }
  }
  return out;
}

const files = await walk(IMAGES, IMAGES);
files.sort();
await fs.writeFile(OUT, JSON.stringify(files));
const sizeKB = (await fs.stat(OUT)).size / 1024;
console.log(
  `Wrote ${files.length} image paths to ${OUT} (${sizeKB.toFixed(1)} KB)`,
);
