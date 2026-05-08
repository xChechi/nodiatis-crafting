import { describe, expect, test } from "vitest";
import { parseMaterialShorthand } from "./inventory";

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
