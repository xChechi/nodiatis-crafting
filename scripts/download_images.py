"""
Nodiatis Image Downloader
=========================
Downloads all unique item artwork from tools.nodiatis.com,
preserving the original directory structure under data/images/.

Usage:
    python download_images.py --test   # download first 5 only
    python download_images.py          # full run (~12 min @ 300ms throttle)

Already-downloaded files are skipped automatically (idempotent).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ALLITEMS = DATA_DIR / "allitems.json"
IMAGES_DIR = DATA_DIR / "images"
BASE_URL = "https://tools.nodiatis.com/"

THROTTLE_SECONDS = 0.3


def unique_image_paths(items: list[dict]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        img = item.get("Image")
        if img and img not in seen:
            seen.add(img)
            out.append(img)
    return sorted(out)


def download_one(rel_path: str, out_path: Path) -> tuple[bool, str]:
    """Returns (downloaded, message). False+'skipped' if already exists."""
    if out_path.exists() and out_path.stat().st_size > 0:
        return False, "skipped (exists)"

    out_path.parent.mkdir(parents=True, exist_ok=True)
    url = BASE_URL + rel_path

    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (image-downloader for personal app build)",
        },
    )

    try:
        with urlopen(req, timeout=20) as resp:
            data = resp.read()
    except HTTPError as e:
        return False, f"HTTP {e.code}"
    except URLError as e:
        return False, f"URL error: {e.reason}"

    if not data:
        return False, "empty response"

    tmp = out_path.with_suffix(out_path.suffix + ".tmp")
    tmp.write_bytes(data)
    tmp.replace(out_path)
    return True, f"{len(data)} bytes"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="Download first 5 only")
    args = ap.parse_args()

    print(f"Loading {ALLITEMS} ...")
    with ALLITEMS.open(encoding="utf-8") as f:
        items = json.load(f)

    paths = unique_image_paths(items)
    print(f"  {len(paths)} unique images")

    if args.test:
        paths = paths[:5]
        print(f"\n[TEST] Will download first {len(paths)} only.\n")

    downloaded = 0
    skipped = 0
    failed = 0
    started = time.time()

    for i, rel in enumerate(paths, start=1):
        out_path = IMAGES_DIR / rel
        ok, msg = download_one(rel, out_path)
        if ok:
            downloaded += 1
            status = "OK"
        elif "skipped" in msg:
            skipped += 1
            status = ".."
        else:
            failed += 1
            status = "!!"

        if i % 100 == 0 or args.test or status == "✗":
            elapsed = time.time() - started
            print(f"  [{i:>4}/{len(paths)}] {status} {rel:<45} {msg}")
            if i % 100 == 0:
                rate = i / max(elapsed, 0.001)
                remaining = (len(paths) - i) / max(rate, 0.001)
                print(f"          -- ok {downloaded}, skip {skipped}, fail {failed} "
                      f"-- ~{remaining/60:.1f} min remaining --")

        # Only throttle on actual downloads, not skips
        if ok:
            time.sleep(THROTTLE_SECONDS)

    elapsed = time.time() - started
    print(f"\nDone in {elapsed:.1f}s")
    print(f"Downloaded: {downloaded}")
    print(f"Skipped (exists): {skipped}")
    print(f"Failed: {failed}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
