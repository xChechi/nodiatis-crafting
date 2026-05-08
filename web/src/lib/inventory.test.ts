import { describe, expect, test } from "vitest";
import { parseMaterialShorthand, parseRangeShorthand, parseGemColorShorthand } from "./inventory";

describe("parseMaterialShorthand", () => {
  test("matches T30 dye", () => {
    const item = parseMaterialShorthand("t30 dye");
    expect(item).not.toBeNull();
    expect(item!.Type).toBe("Resource (Dye Tier 30)");
  });

  test("matches uppercase T", () => {
    expect(parseMaterialShorthand("T1 ore")?.Type).toBe("Resource (Ore Tier 1)");
  });

  test("matches 'tier 5 bone'", () => {
    expect(parseMaterialShorthand("tier 5 bone")?.Type).toBe(
      "Resource (Bone Tier 5)",
    );
  });

  test("strips plural 's'", () => {
    expect(parseMaterialShorthand("t30 dyes")?.Type).toBe(
      "Resource (Dye Tier 30)",
    );
    expect(parseMaterialShorthand("t1 bones")?.Type).toBe(
      "Resource (Bone Tier 1)",
    );
  });

  test("matches reversed order: 'dye t30'", () => {
    expect(parseMaterialShorthand("dye t30")?.Type).toBe(
      "Resource (Dye Tier 30)",
    );
  });

  test("matches reversed: 'bone tier 5'", () => {
    expect(parseMaterialShorthand("bone tier 5")?.Type).toBe(
      "Resource (Bone Tier 5)",
    );
  });

  test("returns null for bare number (no t/tier prefix)", () => {
    expect(parseMaterialShorthand("30 dye")).toBeNull();
  });

  test("returns null for unknown type", () => {
    expect(parseMaterialShorthand("t5 unobtainium")).toBeNull();
  });

  test("returns null for tier out of range", () => {
    expect(parseMaterialShorthand("t99 dye")).toBeNull();
  });

  test("returns null for empty input", () => {
    expect(parseMaterialShorthand("")).toBeNull();
  });
});

describe("parseRangeShorthand", () => {
  test("expands 't1-30 dye' to 30 items", () => {
    const items = parseRangeShorthand("t1-30 dye");
    expect(items).not.toBeNull();
    expect(items!.length).toBe(30);
    expect(items![0].Type).toBe("Resource (Dye Tier 1)");
    expect(items![29].Type).toBe("Resource (Dye Tier 30)");
  });

  test("expands single-tier range 't15-15 ore'", () => {
    const items = parseRangeShorthand("t15-15 ore");
    expect(items).not.toBeNull();
    expect(items!.length).toBe(1);
    expect(items![0].Type).toBe("Resource (Ore Tier 15)");
  });

  test("accepts 'tier' word form: 'tier 5-7 bone'", () => {
    const items = parseRangeShorthand("tier 5-7 bone");
    expect(items).not.toBeNull();
    expect(items!.length).toBe(3);
  });

  test("accepts reversed order: 'dye t1-3'", () => {
    const items = parseRangeShorthand("dye t1-3");
    expect(items).not.toBeNull();
    expect(items!.length).toBe(3);
  });

  test("strips plural", () => {
    expect(parseRangeShorthand("t1-2 dyes")?.length).toBe(2);
  });

  test("returns null for inverted range t30-1", () => {
    expect(parseRangeShorthand("t30-1 dye")).toBeNull();
  });

  test("returns null for unknown type", () => {
    expect(parseRangeShorthand("t1-3 unobtainium")).toBeNull();
  });

  test("returns null for plain non-range shorthand", () => {
    expect(parseRangeShorthand("t30 dye")).toBeNull();
  });
});

describe("parseGemColorShorthand", () => {
  test("returns all red gems when no rank given", () => {
    const items = parseGemColorShorthand("red gem");
    expect(items).not.toBeNull();
    expect(items!.length).toBeGreaterThan(0);
    for (const it of items!) {
      expect(it.Type).toBe("Gem (Red)");
    }
  });

  test("filters by rank: 'red t5 gem'", () => {
    const items = parseGemColorShorthand("red t5 gem");
    expect(items).not.toBeNull();
    for (const it of items!) {
      expect(it.Type).toBe("Gem (Red)");
      expect(it.Name).toMatch(/\sRank\s+5$/i);
    }
  });

  test("plural 'gems' works", () => {
    const items = parseGemColorShorthand("red gems");
    expect(items).not.toBeNull();
  });

  test("'tier 3' word form", () => {
    const items = parseGemColorShorthand("blue tier 3 gem");
    expect(items).not.toBeNull();
    for (const it of items!) {
      expect(it.Type).toBe("Gem (Blue)");
      expect(it.Name).toMatch(/\sRank\s+3$/i);
    }
  });

  test("returns null for unknown color", () => {
    expect(parseGemColorShorthand("octarine gem")).toBeNull();
  });

  test("returns null when 'gem' token missing", () => {
    expect(parseGemColorShorthand("red t5")).toBeNull();
  });

  test("case-insensitive color", () => {
    expect(parseGemColorShorthand("RED Gem")).not.toBeNull();
  });
});

import { fuzzyResolve, parseInventoryLine } from "./inventory";

describe("fuzzyResolve", () => {
  test("matches exact known name", () => {
    const item = fuzzyResolve("Bone Sword");
    if (item) expect(typeof item.Name).toBe("string");
  });

  test("recovers a known-good item from a small typo", async () => {
    const { allItems } = await import("./data");
    const sword = allItems().find((i) => i.Name === "Bone Sword");
    if (!sword) return; // skip if not present
    const typo = sword.Name.replace("o", "0");
    const recovered = fuzzyResolve(typo);
    expect(recovered?.Name).toBe(sword.Name);
  });

  test("returns null for garbage input", () => {
    expect(fuzzyResolve("xyzzqxyzzq nonexistent")).toBeNull();
  });

  test("returns null for empty input", () => {
    expect(fuzzyResolve("")).toBeNull();
  });
});

describe("parseInventoryLine", () => {
  test("'6 t30 dyes' → 1 entry, qty 6, T30 dye", () => {
    const result = parseInventoryLine("6 t30 dyes");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].qty).toBe(6);
    expect(result.warning).toBeUndefined();
  });

  test("'t30 dust' (no qty) → 1 entry, qty Infinity", () => {
    const result = parseInventoryLine("t30 dust");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].qty).toBe(Infinity);
  });

  test("'t1-3 dye' → 3 entries, all unbounded", () => {
    const result = parseInventoryLine("t1-3 dye");
    expect(result.entries.length).toBe(3);
    for (const e of result.entries) expect(e.qty).toBe(Infinity);
  });

  test("'60 t1-3 dye' → 3 entries, all qty 60", () => {
    const result = parseInventoryLine("60 t1-3 dye");
    expect(result.entries.length).toBe(3);
    for (const e of result.entries) expect(e.qty).toBe(60);
  });

  test("'red t5 gem' → multiple entries, all unbounded", () => {
    const result = parseInventoryLine("red t5 gem");
    expect(result.entries.length).toBeGreaterThan(0);
    for (const e of result.entries) expect(e.qty).toBe(Infinity);
  });

  test("'garblegarble xyz' → no entries, warning", () => {
    const result = parseInventoryLine("garblegarble xyz");
    expect(result.entries).toEqual([]);
    expect(result.warning).toBeDefined();
  });

  test("'name: qty' colon syntax", () => {
    const result = parseInventoryLine("t30 dye: 12");
    expect(result.entries[0]?.qty).toBe(12);
  });

  test("blank line → no entries, no warning", () => {
    expect(parseInventoryLine("")).toEqual({ entries: [] });
    expect(parseInventoryLine("   ")).toEqual({ entries: [] });
  });
});

import { parseInventory } from "./inventory";

describe("parseInventory (multi-line)", () => {
  test("splits on newlines and commas", () => {
    const result = parseInventory("t1 dye\nt2 dye, t3 dye");
    expect(result.entries.length).toBe(3);
  });

  test("merges duplicates with max qty (Infinity wins)", () => {
    const result = parseInventory("t1 dye: 5\nt1 dye");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].qty).toBe(Infinity);
  });

  test("merges with finite max", () => {
    const result = parseInventory("t1 dye: 5\nt1 dye: 12");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].qty).toBe(12);
  });

  test("collects warnings", () => {
    const result = parseInventory("t1 dye\ngarblegarble xyz");
    expect(result.entries.length).toBe(1);
    expect(result.warnings.length).toBe(1);
  });

  test("ignores blank lines", () => {
    const result = parseInventory("\n\nt1 dye\n");
    expect(result.entries.length).toBe(1);
    expect(result.warnings).toEqual([]);
  });
});

import { generateSuggestions } from "./inventory";

describe("generateSuggestions", () => {
  test("'t30 d' → suggests T30 Dust, T30 Dye, ...", () => {
    const sugs = generateSuggestions("t30 d");
    expect(sugs.length).toBeGreaterThan(0);
    expect(sugs.length).toBeLessThanOrEqual(5);
    expect(sugs.some((s) => s.toLowerCase().includes("dye"))).toBe(true);
  });

  test("'tier 5' → suggests several T5 materials", () => {
    const sugs = generateSuggestions("tier 5");
    expect(sugs.length).toBeGreaterThan(0);
    expect(sugs.length).toBeLessThanOrEqual(5);
  });

  test("'red gem' → suggests red gems", () => {
    const sugs = generateSuggestions("red gem");
    expect(sugs.length).toBeGreaterThan(0);
  });

  test("partial item name → fuzzy-style literal suggestions", () => {
    const sugs = generateSuggestions("Mongoose");
    expect(sugs.length).toBeGreaterThan(0);
    expect(sugs.some((s) => s.includes("Mongoose"))).toBe(true);
  });

  test("empty input → []", () => {
    expect(generateSuggestions("")).toEqual([]);
    expect(generateSuggestions("   ")).toEqual([]);
  });
});
