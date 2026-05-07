"""
Nodiatis Data Sharder
=====================
Splits the monolithic data files into per-category and per-recipe-type shards
to keep file sizes small (better for grep, IDE search, agent token usage, and
human navigation).

Reads:
    data/allitems.json   (~1.7 MB, 5,488 items)
    data/recipes.json    (~2.0 MB, 2,211 recipes)

Writes:
    data/_index.json                        (~80 KB — slim record per item)
    data/items/{category}.json              (8 files, 100-400 KB each)
    data/recipes/{itemType}.json            (~50 files, 5-100 KB each)
    data/items/_README.md
    data/recipes/_README.md

The originals are KEPT in place — scrapers still write to them, this script
treats them as canonical input. See data/INDEX.md for the full layout.

Idempotent. Safe to re-run after a fresh scrape.

Usage:
    python scripts/shard_data.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ALLITEMS = DATA / "allitems.json"
RECIPES = DATA / "recipes.json"
INDEX_OUT = DATA / "_index.json"
ITEMS_DIR = DATA / "items"
RECIPES_DIR = DATA / "recipes"


# Category mapping — must mirror web/src/lib/categories.ts.
# Order matters: first match wins for a given Type.
def category_for_type(t: str) -> str:
    if t == "Potion":
        return "potions"
    if t.startswith("Weapon") or t.startswith("Archery"):
        return "weapons"
    if t.startswith("Armor") or t == "Shield":
        return "armor"
    if t.startswith("Gem"):
        return "gems"
    if t in ("Pet", "Pets"):
        return "pets"
    if t.startswith("Tool"):
        return "tools"
    if t.startswith("Resource"):
        return "materials"
    return "other"


_TIER_RE = re.compile(r"\(T(\d+)\)")
_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9_-]+")


def slugify_name(name: str) -> str:
    """Mirror of web/src/lib/slug.ts — keep both in sync."""
    out = name.lower()
    for ch in "}{":
        out = out.replace(ch, "-")
    for src, dst in (("é", "e"), ("è", "e"), ("à", "a"), ("â", "a"), ("ñ", "n")):
        out = out.replace(src, dst)
    out = re.sub(r"[^a-z0-9]+", "-", out)
    return out.strip("-")


def safe_recipe_filename(item_type: str) -> str:
    """E.g. 'Archery (Arrow)' -> 'Archery_Arrow'."""
    return _FILENAME_SAFE.sub("_", item_type).strip("_") or "Unknown"


def extract_tier(name: str) -> int | None:
    m = _TIER_RE.search(name)
    return int(m.group(1)) if m else None


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def clear_dir(d: Path) -> None:
    """Remove all .json files in `d` so re-runs don't leave stale shards
    behind (e.g. after a re-categorisation or sub-shard threshold change)."""
    if not d.exists():
        return
    for f in d.glob("*.json"):
        f.unlink()


def shard_items() -> tuple[dict[str, int], int]:
    """Return (per-category counts, total items)."""
    print(f"Reading {ALLITEMS} ...")
    items = json.loads(ALLITEMS.read_text(encoding="utf-8"))
    print(f"  {len(items)} items")

    by_cat: dict[str, list[dict]] = {}
    index: list[dict] = []

    used_slugs: dict[str, int] = {}
    for raw in items:
        name = raw["Name"]
        cat = category_for_type(raw.get("Type", ""))
        by_cat.setdefault(cat, []).append(raw)

        # Slug uniqueness — same logic as web/src/lib/data.ts
        base = slugify_name(name)
        n = used_slugs.get(base, 0)
        used_slugs[base] = n + 1
        slug = base if n == 0 else f"{base}-{n + 1}"

        # Slim record — short keys, omit defaults to keep the file small.
        # Schema documented in data/INDEX.md.
        entry: dict = {
            "s": slug,            # slug
            "n": name,            # name
            "c": cat,             # category
            "t": raw.get("Type", ""),  # type (raw)
        }
        if raw.get("Rarity", 0):
            entry["r"] = raw["Rarity"]      # rarity (omit if 0=Common)
        tier = extract_tier(name)
        if tier is not None:
            entry["T"] = tier               # tier
        lvl = raw.get("Level", 0) or 0
        if lvl:
            entry["L"] = lvl                # level
        if raw.get("RecipeType"):
            entry["k"] = True               # craftable
        if raw.get("Image"):
            entry["i"] = raw["Image"]       # image path
        index.append(entry)

    # Per-category files
    for cat, lst in sorted(by_cat.items()):
        out = ITEMS_DIR / f"{cat}.json"
        write_json(out, lst)
        size_kb = out.stat().st_size / 1024
        print(f"  items/{cat}.json — {len(lst):>4} items, {size_kb:.1f} KB")

    # Slim index
    write_json(INDEX_OUT, index)
    size_kb = INDEX_OUT.stat().st_size / 1024
    print(f"  _index.json — {len(index)} entries, {size_kb:.1f} KB")

    return ({c: len(v) for c, v in by_cat.items()}, len(items))


# itemTypes with too many recipes for a single file get sub-sharded by rarity.
_RARITY_LABELS = ["common", "uncommon", "rare", "epic", "legendary"]
_SUBSHARD_THRESHOLD = 200  # recipes per file ceiling


def shard_recipes() -> tuple[dict[str, int], int]:
    """Return (per-itemType counts, total recipes)."""
    print(f"\nReading {RECIPES} ...")
    recipes = json.loads(RECIPES.read_text(encoding="utf-8"))
    print(f"  {len(recipes)} recipes")

    by_type: dict[str, list[dict]] = {}
    for r in recipes:
        by_type.setdefault(r["itemType"], []).append(r)

    counts: dict[str, int] = {}
    for item_type, lst in sorted(by_type.items()):
        base = safe_recipe_filename(item_type)

        if len(lst) > _SUBSHARD_THRESHOLD:
            # Sub-shard by rarity: e.g. Gem_common.json, Gem_rare.json, ...
            by_rarity: dict[int, list[dict]] = {}
            for r in lst:
                by_rarity.setdefault(r.get("rarity", 0), []).append(r)
            for rarity_idx, sublst in sorted(by_rarity.items()):
                label = (
                    _RARITY_LABELS[rarity_idx]
                    if 0 <= rarity_idx < len(_RARITY_LABELS)
                    else f"r{rarity_idx}"
                )
                fname = f"{base}_{label}.json"
                out = RECIPES_DIR / fname
                write_json(out, sublst)
                size_kb = out.stat().st_size / 1024
                print(
                    f"  recipes/{fname:<28} {len(sublst):>4} recipes, {size_kb:.1f} KB"
                )
            counts[item_type] = len(lst)
        else:
            fname = base + ".json"
            out = RECIPES_DIR / fname
            write_json(out, lst)
            counts[item_type] = len(lst)
            size_kb = out.stat().st_size / 1024
            print(f"  recipes/{fname:<28} {len(lst):>4} recipes, {size_kb:.1f} KB")

    return (counts, len(recipes))


def write_readmes(item_counts: dict[str, int], recipe_counts: dict[str, int]) -> None:
    items_readme = ITEMS_DIR / "_README.md"
    items_readme.write_text(
        "# items/\n\n"
        "Per-category item files. Each file is a JSON array of full RawItem records.\n"
        "Generated by `scripts/shard_data.py` from `data/allitems.json`.\n\n"
        "| Category | Items |\n|---|---|\n"
        + "\n".join(
            f"| `{c}.json` | {n} |"
            for c, n in sorted(item_counts.items(), key=lambda kv: -kv[1])
        )
        + "\n\nSee `../INDEX.md` for the full data layout.\n",
        encoding="utf-8",
    )

    recipes_readme = RECIPES_DIR / "_README.md"
    sorted_recipes = sorted(recipe_counts.items(), key=lambda kv: -kv[1])
    top = sorted_recipes[:15]
    rest = len(sorted_recipes) - len(top)
    table = "\n".join(f"| `{t}` | {n} |" for t, n in top)
    suffix = f"\n\n…plus {rest} more itemTypes (one file each)." if rest > 0 else ""
    recipes_readme.write_text(
        "# recipes/\n\n"
        "Per-itemType recipe files. Each file is a JSON array of recipe records.\n"
        "Generated by `scripts/shard_data.py` from `data/recipes.json`.\n\n"
        "| itemType | Recipes |\n|---|---|\n"
        + table
        + suffix
        + "\n\nSee `../INDEX.md` for the recipe shape.\n",
        encoding="utf-8",
    )


def main() -> int:
    if not ALLITEMS.exists():
        print(f"ERROR: {ALLITEMS} not found", file=sys.stderr)
        return 1
    if not RECIPES.exists():
        print(f"ERROR: {RECIPES} not found", file=sys.stderr)
        return 1

    clear_dir(ITEMS_DIR)
    clear_dir(RECIPES_DIR)
    item_counts, total_items = shard_items()
    recipe_counts, total_recipes = shard_recipes()
    write_readmes(item_counts, recipe_counts)

    print(
        f"\nDone. {total_items} items in {len(item_counts)} categories, "
        f"{total_recipes} recipes in {len(recipe_counts)} itemTypes."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
