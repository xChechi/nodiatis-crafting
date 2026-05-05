"""
Nodiatis Recipe Scraper
=======================
Fetches all unique recipes from tools.nodiatis.com via the
POST /calculators/recipe?results-only endpoint.

Usage:
    python scrape_recipes.py --test       # fetch first 5, print, exit
    python scrape_recipes.py              # full run (~18 min @ 500ms throttle)
    python scrape_recipes.py --resume     # resume from existing recipes.json

Output: data/recipes.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ALLITEMS = DATA_DIR / "allitems.json"
OUTPUT = DATA_DIR / "recipes.json"
ENDPOINT = "https://tools.nodiatis.com/calculators/recipe?results-only"

THROTTLE_SECONDS = 0.5
SAVE_EVERY = 50

LI_RE = re.compile(r"<li>\s*(\d+)\s+(.+?)\s+\(T(\d+)\)\s*</li>")
CONSUMABLE_BLOCK_RE = re.compile(
    r'<ul id="consumableUl">(.*?)</ul>', re.DOTALL
)
ITEM_BLOCK_RE = re.compile(r'<ul id="itemUl">(.*?)</ul>', re.DOTALL)


def parse_mats(html_block: str) -> list[dict]:
    """Extract [{name, tier, qty}, ...] from a <ul>...</ul> block."""
    out: list[dict] = []
    for qty, name, tier in LI_RE.findall(html_block):
        out.append(
            {"name": name.strip(), "tier": int(tier), "qty": int(qty)}
        )
    return out


def fetch_recipe(item_type: str, rarity: int, level: int, cost: int) -> dict | None:
    """POST to the recipe calculator endpoint and parse mats out of the HTML."""
    body = urlencode(
        {
            "itemType": item_type,
            "rarity": rarity,
            "level": level,
            "cost": cost,
        }
    ).encode("utf-8")

    req = Request(
        ENDPOINT,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (recipe-scraper for personal app build)",
        },
    )

    with urlopen(req, timeout=20) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    consumable_match = CONSUMABLE_BLOCK_RE.search(html)
    item_match = ITEM_BLOCK_RE.search(html)

    if not consumable_match or not item_match:
        return None

    return {
        "consumable": parse_mats(consumable_match.group(1)),
        "finished": parse_mats(item_match.group(1)),
    }


def is_uptier_only(name: str) -> bool:
    """Items like 'Foo {II{' are uptier-only, no fresh recipe."""
    return "{" in name and "}I{" not in name


def build_combos(items: list[dict]) -> dict[tuple, dict]:
    """
    Group items by (itemType, rarity, level, cost).
    Returns: { (type, rarity, level, cost): {"params": {...}, "items": [names]} }
    """
    combos: dict[tuple, dict] = {}
    for item in items:
        if not item.get("RecipeType"):
            continue
        if is_uptier_only(item.get("Name", "")):
            continue

        key = (
            item["RecipeType"],
            item.get("Rarity", 0),
            item.get("Level", 0) or 0,
            item.get("Cost", 0) or 0,
        )
        if key not in combos:
            combos[key] = {
                "itemType": key[0],
                "rarity": key[1],
                "level": key[2],
                "cost": key[3],
                "items": [],
            }
        combos[key]["items"].append(item["Name"])
    return combos


def load_existing(path: Path) -> tuple[list[dict], set[tuple]]:
    if not path.exists():
        return [], set()
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    done = {(r["itemType"], r["rarity"], r["level"], r["cost"]) for r in data}
    return data, done


def save(path: Path, recipes: list[dict]) -> None:
    tmp = path.with_suffix(".tmp.json")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--test", action="store_true", help="Fetch first 5 only")
    ap.add_argument("--resume", action="store_true", help="Skip already-saved combos")
    args = ap.parse_args()

    print(f"Loading {ALLITEMS} ...")
    with ALLITEMS.open(encoding="utf-8") as f:
        items = json.load(f)
    print(f"  Loaded {len(items)} items")

    combos = build_combos(items)
    print(f"  Built {len(combos)} unique recipe combos")

    existing, done_keys = ([], set())
    if args.resume and OUTPUT.exists():
        existing, done_keys = load_existing(OUTPUT)
        print(f"  Resuming: {len(done_keys)} already saved, "
              f"{len(combos) - len(done_keys)} remaining")

    pending = [c for k, c in combos.items() if k not in done_keys]
    if args.test:
        pending = pending[:5]
        print(f"\n[TEST] Will fetch first {len(pending)} only.\n")

    results = list(existing)
    fail_count = 0
    started = time.time()

    for i, combo in enumerate(pending, start=1):
        try:
            recipe = fetch_recipe(
                combo["itemType"], combo["rarity"],
                combo["level"], combo["cost"],
            )
        except Exception as e:
            print(f"  [{i}/{len(pending)}] FAIL {combo['itemType']} "
                  f"r{combo['rarity']} L{combo['level']} ${combo['cost']}: {e}")
            fail_count += 1
            time.sleep(THROTTLE_SECONDS)
            continue

        if recipe is None:
            print(f"  [{i}/{len(pending)}] no-recipe-block: "
                  f"{combo['items'][0]} ({combo['itemType']})")
            fail_count += 1
        else:
            results.append({**combo, **recipe})
            sample_items = ", ".join(combo["items"][:2])
            if len(combo["items"]) > 2:
                sample_items += f" (+{len(combo['items']) - 2} more)"
            print(f"  [{i}/{len(pending)}] {sample_items} -> "
                  f"{len(recipe['consumable'])} consum / "
                  f"{len(recipe['finished'])} finished")

        if i % SAVE_EVERY == 0:
            save(OUTPUT, results)
            elapsed = time.time() - started
            rate = i / max(elapsed, 0.001)
            remaining = (len(pending) - i) / max(rate, 0.001)
            print(f"  -- saved checkpoint ({len(results)} total) "
                  f"-- ~{remaining/60:.1f} min remaining --")

        time.sleep(THROTTLE_SECONDS)

    save(OUTPUT, results)
    elapsed = time.time() - started
    print(f"\nDone. {len(results)} total recipes saved to {OUTPUT}")
    print(f"Elapsed: {elapsed:.1f}s, failures: {fail_count}")

    if args.test and pending:
        print("\n--- SAMPLE OF FIRST RESULT ---")
        print(json.dumps(results[-len(pending)], indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
