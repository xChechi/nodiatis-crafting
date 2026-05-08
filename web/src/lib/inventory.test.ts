import { describe, expect, test } from "vitest";
import { parseMaterialShorthand, parseRangeShorthand } from "./inventory";

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
