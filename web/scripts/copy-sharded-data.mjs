// Copy the canonical sharded data from /data into web/src/data so the Next
// app can import it via the @/data alias. Source of truth lives at the repo
// root; this is just a deterministic mirror.
//
// Run automatically as part of `npm run build:data` BEFORE the other index
// scripts (which read from these mirrored files).

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const REPO = path.resolve(WEB, "..");
const SRC_DATA = path.join(REPO, "data");
const DST_DATA = path.join(WEB, "src", "data");

async function copyDir(srcDir, dstDir, label) {
  await fs.mkdir(dstDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  let count = 0;
  let bytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    await fs.copyFile(srcPath, dstPath);
    const stat = await fs.stat(dstPath);
    count += 1;
    bytes += stat.size;
  }
  console.log(`Mirrored ${count} ${label} files (${(bytes / 1024).toFixed(1)} KB)`);
}

await copyDir(
  path.join(SRC_DATA, "items"),
  path.join(DST_DATA, "items"),
  "items/",
);
await copyDir(
  path.join(SRC_DATA, "recipes"),
  path.join(DST_DATA, "recipes"),
  "recipes/",
);
