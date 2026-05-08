import { describe, expect, test } from "vitest";
import {
  parseMaterialType,
  materialTypeSlug,
  summariseTypes,
} from "./materials";
import type { Item } from "./types";

function fakeItem(over: Partial<Item>): Item {
  return {
    Name: "x",
    Type: "Resource (Bone Tier 1)",
    Rarity: 0,
    Cost: 0,
    slug: "x",
    rarityLabel: "Common",
    imageUrl: null,
    tier: null,
    tags: [],
    recipe: null,
    usedInSlugs: [],
    ...over,
  };
}

describe("parseMaterialType", () => {
  test("extracts name and tier from a tiered resource type", () => {
    expect(parseMaterialType("Resource (Bone Tier 7)")).toEqual({
      name: "Bone",
      tier: 7,
    });
  });

  test("handles two-word names", () => {
    expect(parseMaterialType("Resource (Armor Essence Tier 3)")).toEqual({
      name: "Armor Essence",
      tier: 3,
    });
  });

  test("returns null tier when the type has no tier suffix", () => {
    expect(parseMaterialType("Resource (Armor Essence)")).toEqual({
      name: "Armor Essence",
      tier: null,
    });
  });

  test("returns the raw inner content if structure is unexpected", () => {
    expect(parseMaterialType("Resource (Junk)")).toEqual({
      name: "Junk",
      tier: null,
    });
  });

  test("returns name='Resource' and tier=null for malformed input", () => {
    expect(parseMaterialType("Resource")).toEqual({
      name: "Resource",
      tier: null,
    });
  });
});

describe("materialTypeSlug", () => {
  test("lowercases single-word names", () => {
    expect(materialTypeSlug("Bone")).toBe("bone");
  });

  test("hyphenates multi-word names", () => {
    expect(materialTypeSlug("Armor Essence")).toBe("armor-essence");
    expect(materialTypeSlug("Heroic Essence")).toBe("heroic-essence");
  });

  test("collapses repeated whitespace", () => {
    expect(materialTypeSlug("Armor   Essence")).toBe("armor-essence");
  });
});

describe("summariseTypes", () => {
  test("groups items by canonical type name and counts them", () => {
    const items = [
      fakeItem({ Type: "Resource (Bone Tier 1)", Name: "a" }),
      fakeItem({ Type: "Resource (Bone Tier 2)", Name: "b" }),
      fakeItem({ Type: "Resource (Ore Tier 1)", Name: "c" }),
      fakeItem({ Type: "Resource (Armor Essence)", Name: "d" }),
    ];
    const result = summariseTypes(items);
    expect(result.find((t) => t.name === "Bone")).toEqual({
      name: "Bone",
      slug: "bone",
      count: 2,
      tierRange: [1, 2],
    });
    expect(result.find((t) => t.name === "Ore")).toEqual({
      name: "Ore",
      slug: "ore",
      count: 1,
      tierRange: [1, 1],
    });
    expect(result.find((t) => t.name === "Armor Essence")).toEqual({
      name: "Armor Essence",
      slug: "armor-essence",
      count: 1,
      tierRange: null,
    });
  });

  test("sorts results alphabetically by name", () => {
    const items = [
      fakeItem({ Type: "Resource (Wood Tier 1)" }),
      fakeItem({ Type: "Resource (Bone Tier 1)" }),
      fakeItem({ Type: "Resource (Ore Tier 1)" }),
    ];
    expect(summariseTypes(items).map((t) => t.name)).toEqual([
      "Bone",
      "Ore",
      "Wood",
    ]);
  });

  test("ignores non-resource items", () => {
    const items = [
      fakeItem({ Type: "Resource (Bone Tier 1)" }),
      fakeItem({ Type: "Weapon (Sword)" }),
      fakeItem({ Type: "Potion" }),
    ];
    expect(summariseTypes(items)).toHaveLength(1);
  });
});
