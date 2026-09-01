"""
Nodiatis mst.js Sync
====================
Merges items from the LIVE game master database into data/allitems.json.

Background: data/allitems.json is a snapshot of tools.nodiatis.com's item
table (Jan-2024 vintage). The upstream tool now merges that snapshot AT
RUNTIME with https://www.nodiatis.com/mst.js — the game's live master DB
(three JS arrays of pipe-separated base-32 descriptors: `mdescs`,
`itemdbdescs`, `itemdbtierdescs`). Items added to the game after the
snapshot exist only in mst.js. This script replicates the upstream decode
(see tools.nodiatis.com/neo-items/app.js: decodeMasterDescriptor,
decodeImage, buildCurrentItemData) and appends the missing items.

Field conventions are derived FROM THE OVERLAP at runtime (SubType->Type,
kind->RecipeType, skill id->name, which fields a category carries), so the
script self-maintains as the game adds content.

Known renames (game renamed items; we rename in place, keeping local
enrichment like Location/Energy/Mana):
  - "Giant Fagot" -> "Giant Fallgood"
  - "Mana Reduction Rank N..." -> "Mana Reduction Rune Rank N..."
  - "Energy Reduction Rank N..." -> "Energy Reduction Rune Rank N..."

Usage:
    python scripts/sync_mst.py --dry-run     # report only
    python scripts/sync_mst.py               # merge into data/allitems.json
    python scripts/sync_mst.py --images      # also download missing artwork
                                             # (from nd1.nodiatis.com; the
                                             # tools mirror 404s new files)

After a merge run:
    node scripts/compute_recipes.mjs         # recipes for new combos
    python scripts/shard_data.py
    cd web && npm run build:data
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ALLITEMS = DATA / "allitems.json"
WEB_IMAGES = ROOT / "web" / "public" / "images"

MST_URL = "https://www.nodiatis.com/mst.js"
IMG_BASE = "https://nd1.nodiatis.com/"
UA = "Mozilla/5.0 (mst sync for nodiacraft.com wiki)"

TYPE_FALLBACK = [
    "Weapon", "Helmet", "Breastplate", "Sleeve", "Legging", "Shield",
    "Bow", "Quiver", "Arrow", "Gem", "Pet", "Rune", "Tool", "Food",
    "Drink", "Potion", "Travel Gear", "Trophy", "Resource", "Misc",
]
# Confirmed against the live grid: app.js rarityString + Resell factors.
# Integer math (pct // 100) matches the game's own rounding — float 0.13
# drifts by 1 gold on some costs.
RESELL_PCT = [30, 25, 19, 50, 13, 13]
# The site displays accuracy as the game's word labels, not raw numbers.
ACCURACY_LABELS = {1: "Normal", 2: "Good", 3: "Great",
                   4: "Excellent", 5: "Exceptional", 6: "Epic"}
# Stat slot order derived from 2,900+ overlap items (unambiguous).
STAT_SLOTS = ["Str", "Dex", "PSt", "Int", "Cnc", "MSt",
              "Agi", "Cnt", "Dur", "PRe", "MRe", "Reg"]
RESOURCE_KINDS = [
    "hunt", "fish", "rodent", "wood", "ore", "vege", "forage", "silk",
    "resin", "dust", "plank", "oil", "bones", "skin", "geode", "dye",
    "scale", "thread", "leather", "ingot", "sinew", "cloth",
]

RENAMES = [
    (re.compile(r"^Giant Fagot$"), "Giant Fallgood"),
    (re.compile(r"^(Mana Reduction) (Rank .+)$"), r"\1 Rune \2"),
    (re.compile(r"^(Energy Reduction) (Rank .+)$"), r"\1 Rune \2"),
]

_B32 = "0123456789abcdefghijklmnopqrstuv"


def parse_dhex(value) -> int:
    """JS parseInt(value, 32): prefix-parse, 0 on garbage."""
    s = str(value).strip().lower()
    neg = s.startswith("-")
    if neg:
        s = s[1:]
    n, seen = 0, False
    for ch in s:
        d = _B32.find(ch)
        if d < 0:
            break
        n, seen = n * 32 + d, True
    if not seen:
        return 0
    return -n if neg else n


def decode_descriptor(desc: str) -> dict:
    """Port of app.js decodeMasterDescriptor."""
    arr = desc.split("|")
    if len(arr) < 21:
        raise ValueError("bad descriptor")
    field = 14
    stats: list[int] = []
    if arr[field] == "z":
        field += 1
    else:
        for _ in range(12):
            stats.append(parse_dhex(arr[field]))
            field += 1
    amount = parse_dhex(arr[field]); field += 1
    item_type = parse_dhex(arr[field]); field += 1
    field += 2
    item_index = parse_dhex(arr[field]); field += 1
    if not amount:
        raise ValueError("empty descriptor")
    return {
        "Description": arr[0], "Name": arr[1], "Cost": parse_dhex(arr[2]),
        "Rarity": parse_dhex(arr[3]), "Skill": parse_dhex(arr[4]),
        "Level": parse_dhex(arr[5]), "Weight": parse_dhex(arr[6]),
        "GraphicCode": parse_dhex(arr[7]), "SubType": parse_dhex(arr[8]),
        "MinDamage": parse_dhex(arr[9]), "MaxDamage": parse_dhex(arr[10]),
        "DelayValue": parse_dhex(arr[11]), "Accuracy": parse_dhex(arr[12]),
        "ArmorClass": parse_dhex(arr[13].split(",")[0]),
        "StatsValues": stats,
        "ItemType": item_type, "ItemIndex": item_index,
    }


def decode_image(gfx: int) -> str | None:
    """Port of app.js decodeImage."""
    low = gfx & 0xFFFF
    high = gfx >> 16
    if 0 <= high <= 4:
        return f"ex/weapons/weapon_{low}_{high + 1}.png"
    if 5 <= high <= 9:
        return f"ex/armor/armor_{low}_{high - 4}.png"
    if high == 10:
        return f"ex/whips/whip_{low}.png"
    if high == 11:
        return f"ex/staves/stave_{low}.png"
    if high == 12:
        return f"ex/pets/pet_{low}.png"
    if high == 13:
        return f"ex/gems/gem_{low}.jpg"
    if high == 14:
        return f"ex/runes/rune_{low}.jpg"
    if high == 15:
        return f"ex/tool/tool_{low}.png"
    if high == 16:
        return f"ex/icons/icon_{low}" + (".png" if low == 254 else ".jpg")
    if high == 17:
        return f"ex/gear/gear_{low}.png"
    if high == 18:
        packed = low - 1
        kind, num = packed // 30, packed % 30 + 1
        if 0 <= kind < len(RESOURCE_KINDS):
            k = RESOURCE_KINDS[kind]
            prefix = "rodents" if k == "rodent" else k
            return f"ex/{k}/{prefix}_{num}.png"
    return None


def extract_js_array(src: str, name: str) -> list:
    m = re.search(r"var %s\s*=\s*" % re.escape(name), src)
    if not m:
        raise ValueError(f"{name} not found in mst.js")
    start = src.index("[", m.end())
    depth, i, instr, quote = 0, start, False, ""
    while i < len(src):
        c = src[i]
        if instr:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                instr = False
        else:
            if c in ('"', "'"):
                instr, quote = True, c
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    return json.loads(src[start:i + 1])
        i += 1
    raise ValueError(f"unterminated array for {name}")


def replace_description_numbers(base: str, deltas: list) -> str:
    replacements = {parse_dhex(d[0]): str(d[1]) for d in deltas}
    counter = {"i": 0}

    def sub(m):
        r = replacements.get(counter["i"])
        counter["i"] += 1
        return m.group(0) if r is None else r

    return re.sub(r"\d+(?:[.,]\d+)*", sub, base)


def expand_descriptors(itemdb: list[str], tier_families: list) -> list[str]:
    """Port of app.js expandItemDatabaseDescriptors."""
    descriptors = list(itemdb)
    base_by_key: dict[str, str] = {}
    for d in itemdb:
        dec = decode_descriptor(d)
        base_by_key[f"{dec['ItemType']}:{dec['ItemIndex']}"] = d
    for family in tier_families:
        item_type = parse_dhex(family[0])
        base_index = parse_dhex(family[1])
        base = base_by_key.get(f"{item_type}:{base_index}")
        if not base:
            raise ValueError(f"tier family has no base {item_type}:{base_index}")
        base_fields = base.split("|")
        for tier in family[2]:
            fields = list(base_fields)
            for delta in tier[1]:
                fields[parse_dhex(delta[0])] = delta[1]
            fields[0] = (replace_description_numbers(base_fields[0], tier[2])
                         if isinstance(tier[2], list) else tier[2])
            descriptors.append("|".join(fields))
    return descriptors


DESC_DMG_RE = re.compile(r"[Dd]irect damage(?:\s*\([^)]*\))? of (\d+) to (\d+)")


def build_record(d: dict, maps: dict) -> dict:
    """Build a RawItem in local allitems.json conventions."""
    kind = (d["ItemType"], d["SubType"])
    item_type = d["ItemType"]

    if item_type == 19:
        type_str = "Misc"
    elif item_type == 18:
        idx = d["ItemIndex"]
        kind_i, tier = idx // 30, idx % 30 + 1
        if 0 <= kind_i < len(RESOURCE_KINDS):
            label = {"vege": "Vegetable", "hunt": "Prey", "bones": "Bone",
                     "forage": "Plant"}.get(
                RESOURCE_KINDS[kind_i], RESOURCE_KINDS[kind_i].capitalize())
            type_str = f"Resource ({label} Tier {tier})"
        else:
            type_str = f"Resource ({d['Name']})"
    else:
        type_str = maps["type_by_kind"].get(kind) or TYPE_FALLBACK[item_type]

    rec: dict = {
        "Cost": d["Cost"],
        "Description": d["Description"],
        "Level": d["Level"],
        "Name": d["Name"],
        "Rarity": d["Rarity"],
        "Resell": d["Cost"] * RESELL_PCT[d["Rarity"]] // 100
        if d["Rarity"] < len(RESELL_PCT) else 0,
        "Type": type_str,
        "Weight": d["Weight"],
    }

    img = decode_image(d["GraphicCode"])
    if img:
        rec["Image"] = img

    recipe_type = maps["recipe_by_kind"].get(kind)
    if recipe_type:
        rec["RecipeType"] = recipe_type

    if d["Skill"]:
        skill = maps["skill_names"].get(d["Skill"])
        if skill:
            rec["Prereq"] = f"{skill} ({d['Level']})"

    # Damage: weapons/arrows/pets straight from the descriptor; gems from
    # the description text (matches how the old table displayed them).
    if item_type in (0, 8, 10) and (d["MinDamage"] or d["MaxDamage"]):
        rec["Damage"] = f"{d['MinDamage']}-{d['MaxDamage']}"
    elif item_type == 9:
        m = DESC_DMG_RE.search(d["Description"])
        if m:
            rec["Damage"] = f"{m.group(1)}-{m.group(2)}"

    # Delay conventions differ per category (derived from overlap):
    #   weapons: DelayValue/143, plain integer string
    #   gems: 0 = draw-cast, 999999999 = aura, else milliseconds
    if item_type == 0 and d["DelayValue"]:
        rec["Delay"] = str(round(d["DelayValue"] / 143))
    elif item_type == 9:
        if d["DelayValue"] == 999999999:
            rec["Delay"] = "Effective When in Play"
        elif d["DelayValue"] == 0:
            rec["Delay"] = "One Cast Per Draw"
        else:
            rec["Delay"] = "%.1f Seconds" % (d["DelayValue"] / 1000)

    if d["Accuracy"]:
        rec["Accuracy"] = ACCURACY_LABELS.get(d["Accuracy"], d["Accuracy"])
    if d["ArmorClass"]:
        rec["ArmorClass"] = d["ArmorClass"]

    if d["StatsValues"] and any(d["StatsValues"]):
        parts = [f"{STAT_SLOTS[i]}: {v}"
                 for i, v in enumerate(d["StatsValues"]) if v]
        rec["Stats"] = "  ".join(parts)

    return rec


def refresh_existing(items: list[dict], decoded_by_name: dict, maps: dict) -> Counter:
    """Update stale fields on items we already have — the game edits item
    text/stats over time (e.g. Tantalious Gemstone's damage rework) and the
    snapshot keeps the old values. Local-only enrichment (Location, Energy,
    Mana, Virtues, LastSeen, Type, RecipeType) is never touched; decoded
    zero-values don't clobber real data.
    """
    changed = Counter()
    for item in items:
        d = decoded_by_name.get(item["Name"].strip())
        if not d:
            continue
        fresh = build_record(d, maps)
        for key in ("Description", "Cost", "Resell", "Weight", "Level",
                    "Rarity", "Damage", "Delay", "Accuracy", "ArmorClass",
                    "Stats", "Prereq", "Image"):
            if key not in fresh:
                continue
            value = fresh[key]
            if value in ("", None):
                continue
            if key in ("Cost", "Resell", "Weight") and not value:
                continue
            # Don't ADD a field the record deliberately omits (starter gear
            # has no Level/Prereq) unless the fresh value carries signal.
            if key not in item and value in (0, "0", "0-0"):
                continue
            # Prereq: only replace a real existing prereq, and never with a
            # level-0 one — starter gear shows 'None' locally.
            if key == "Prereq" and (
                not item.get("Prereq") or item.get("Prereq") == "None"
                or d["Level"] == 0
            ):
                continue
            if item.get(key) != value:
                item[key] = value
                changed[key] += 1
    return changed


def derive_maps(decoded: list[dict], local_by_name: dict) -> dict:
    type_by_kind: dict = defaultdict(Counter)
    recipe_by_kind: dict = defaultdict(Counter)
    skill_names: dict = defaultdict(Counter)
    for d in decoded:
        o = local_by_name.get(d["Name"].strip())
        if not o:
            continue
        kind = (d["ItemType"], d["SubType"])
        if o.get("Type"):
            type_by_kind[kind][o["Type"]] += 1
        if o.get("RecipeType"):
            recipe_by_kind[kind][o["RecipeType"]] += 1
        m = re.match(r"^(.*) \(\d+\)$", o.get("Prereq") or "")
        if m and d["Skill"]:
            skill_names[d["Skill"]][m.group(1)] += 1
    pick = lambda c: {k: v.most_common(1)[0][0] for k, v in c.items()}
    # RecipeType needs real evidence — a single name collision (e.g. a
    # trophy sharing a name with a weapon) must not give a whole category
    # a bogus recipe type.
    recipe_picked = {}
    for kind, votes in recipe_by_kind.items():
        winner, count = votes.most_common(1)[0]
        evidence = sum(type_by_kind.get(kind, Counter()).values()) or 1
        if count >= 3 and count / evidence >= 0.2:
            recipe_picked[kind] = winner
    return {
        "type_by_kind": pick(type_by_kind),
        "recipe_by_kind": recipe_picked,
        "skill_names": pick(skill_names),
    }


def fetch(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": UA})
    with urlopen(req, timeout=30) as resp:
        return resp.read()


def download_images(records: list[dict]) -> None:
    wanted = sorted({r["Image"] for r in records if r.get("Image")})
    missing = [p for p in wanted if not (WEB_IMAGES / p).exists()]
    print(f"Images: {len(wanted)} referenced, {len(missing)} to download")
    ok = fail = 0
    for i, rel in enumerate(missing, 1):
        dest = WEB_IMAGES / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            blob = fetch(IMG_BASE + rel)
            if not blob.startswith((b"\xff\xd8", b"\x89PNG")):
                raise ValueError("not an image (%d bytes)" % len(blob))
            dest.write_bytes(blob)
            ok += 1
        except Exception as e:
            print(f"  [{i}/{len(missing)}] FAIL {rel}: {e}")
            fail += 1
        if i % 50 == 0:
            print(f"  [{i}/{len(missing)}] ...")
        time.sleep(0.25)
    print(f"Images done: {ok} downloaded, {fail} failed")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--images", action="store_true",
                    help="download missing artwork for merged items")
    ap.add_argument("--mst-file", help="use a local mst.js instead of fetching")
    args = ap.parse_args()

    if args.mst_file:
        src = Path(args.mst_file).read_text(encoding="utf-8", errors="replace")
    else:
        print(f"Fetching {MST_URL} ...")
        src = fetch(MST_URL).decode("utf-8", errors="replace")

    mdescs = extract_js_array(src, "mdescs")
    itemdb = extract_js_array(src, "itemdbdescs")
    tiers = extract_js_array(src, "itemdbtierdescs")
    print(f"mst.js: {len(mdescs)} masters, {len(itemdb)} itemdb, "
          f"{len(tiers)} tier families")

    decoded = [decode_descriptor(d) for d in expand_descriptors(itemdb, tiers)]
    decoded = [d for d in decoded if d["Name"].strip()]
    for d in decoded:
        d["Name"] = d["Name"].strip()

    items = json.loads(ALLITEMS.read_text(encoding="utf-8"))

    # Apply known renames in place (keeps enrichment fields + file order).
    decoded_names = {d["Name"] for d in decoded}
    renamed = []
    for item in items:
        for pattern, repl in RENAMES:
            new_name = pattern.sub(repl, item["Name"])
            if new_name != item["Name"] and new_name in decoded_names:
                renamed.append((item["Name"], new_name))
                item["Name"] = new_name
                break

    local_by_name = {i["Name"].strip(): i for i in items}
    maps = derive_maps(decoded, local_by_name)

    decoded_by_name = {d["Name"]: d for d in decoded}
    field_changes = refresh_existing(items, decoded_by_name, maps)

    missing = [d for d in decoded if d["Name"] not in local_by_name]
    # The same name can appear in both mdescs-era and itemdb-era data;
    # dedupe on name keeping the first occurrence.
    seen: set = set()
    missing = [d for d in missing
               if not (d["Name"] in seen or seen.add(d["Name"]))]

    new_records = [build_record(d, maps) for d in missing]

    print(f"\nRenames applied: {len(renamed)}")
    for old, new in renamed[:40]:
        print(f"  {old} -> {new}")
    print(f"Existing items refreshed — field changes: "
          f"{dict(field_changes.most_common()) or 'none'}")
    print(f"New items to merge: {len(new_records)}")
    by_type = Counter(r["Type"].split(" (")[0] for r in new_records)
    for t, c in by_type.most_common():
        print(f"  {c:5d}  {t}")

    if args.dry_run:
        print("\n[dry-run] no files written")
        return 0

    items.extend(new_records)
    with ALLITEMS.open("w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"\nWrote {ALLITEMS} ({len(items)} items)")

    if args.images:
        # Scan the whole item set — idempotent, so this also backfills
        # anything missed by an earlier run.
        download_images(items)

    print("\nNext: node scripts/compute_recipes.mjs && "
          "python scripts/shard_data.py && (cd web && npm run build:data)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
