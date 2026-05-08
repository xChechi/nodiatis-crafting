import { describe, expect, test } from "vitest";
import {
  typeParensSubtype,
  subtypeSlug,
  summariseSubtypes,
} from "./subtypes";
import type { Item } from "./types";

function fakeItem(over: Partial<Item>): Item {
  return {
    Name: "x",
    Type: "Weapon (1H Slash)",
    Rarity: 0,
    Cost: 0,
    Level: 0,
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

describe("typeParensSubtype", () => {
  test("extracts content from parens", () => {
    expect(typeParensSubtype("Weapon (1H Slash)")).toBe("1H Slash");
    expect(typeParensSubtype("Armor (Breastplate)")).toBe("Breastplate");
  });

  test("returns the whole input when no parens", () => {
    expect(typeParensSubtype("Trophy")).toBe("Trophy");
    expect(typeParensSubtype("Shield")).toBe("Shield");
  });

  test("trims whitespace inside parens", () => {
    expect(typeParensSubtype("Weapon (  1H Slash  )")).toBe("1H Slash");
  });
});

describe("subtypeSlug", () => {
  test("lowercases and hyphenates", () => {
    expect(subtypeSlug("1H Slash")).toBe("1h-slash");
    expect(subtypeSlug("Travel Gear")).toBe("travel-gear");
    expect(subtypeSlug("Potion of Blessings")).toBe("potion-of-blessings");
  });

  test("collapses repeated whitespace", () => {
    expect(subtypeSlug("Travel   Gear")).toBe("travel-gear");
  });
});

describe("summariseSubtypes", () => {
  test("groups items, picks highest-level item for image", () => {
    const items = [
      fakeItem({ Name: "Sword L1", Type: "Weapon (1H Slash)", Level: 1, imageUrl: "/img/s1.png" }),
      fakeItem({ Name: "Sword L50", Type: "Weapon (1H Slash)", Level: 50, imageUrl: "/img/s50.png" }),
      fakeItem({ Name: "Sword L20", Type: "Weapon (1H Slash)", Level: 20, imageUrl: "/img/s20.png" }),
      fakeItem({ Name: "Bow L10", Type: "Archery (Bow)", Level: 10, imageUrl: "/img/b10.png" }),
    ];
    const result = summariseSubtypes(
      items,
      (i) => i.Type.startsWith("Weapon") || i.Type.startsWith("Archery"),
      (i) => typeParensSubtype(i.Type),
    );
    expect(result).toEqual([
      { name: "1H Slash", slug: "1h-slash", count: 3, imageUrl: "/img/s50.png" },
      { name: "Bow", slug: "bow", count: 1, imageUrl: "/img/b10.png" },
    ]);
  });

  test("falls back to highest-rarity then first-encountered when levels tie", () => {
    const items = [
      fakeItem({ Name: "A", Type: "Other", Level: 5, Rarity: 1, imageUrl: "/a.png" }),
      fakeItem({ Name: "B", Type: "Other", Level: 5, Rarity: 3, imageUrl: "/b.png" }),
      fakeItem({ Name: "C", Type: "Other", Level: 5, Rarity: 3, imageUrl: "/c.png" }),
    ];
    const result = summariseSubtypes(items, () => true, (i) => typeParensSubtype(i.Type));
    expect(result[0].imageUrl).toBe("/b.png");
  });

  test("imageUrl is null when no item in subtype has an image", () => {
    const items = [
      fakeItem({ Type: "Weapon (Bow)", imageUrl: null }),
      fakeItem({ Type: "Weapon (Bow)", imageUrl: null }),
    ];
    const result = summariseSubtypes(items, () => true, (i) => typeParensSubtype(i.Type));
    expect(result[0].imageUrl).toBeNull();
  });

  test("ignores items where matches() is false", () => {
    const items = [
      fakeItem({ Type: "Weapon (Bow)" }),
      fakeItem({ Type: "Resource (Bone Tier 1)" }),
    ];
    const result = summariseSubtypes(items, (i) => i.Type.startsWith("Weapon"), (i) => typeParensSubtype(i.Type));
    expect(result).toHaveLength(1);
  });

  test("sorts results alphabetically by name", () => {
    const items = [
      fakeItem({ Type: "Weapon (Sword)" }),
      fakeItem({ Type: "Weapon (Axe)" }),
      fakeItem({ Type: "Weapon (Bow)" }),
    ];
    const result = summariseSubtypes(items, () => true, (i) => typeParensSubtype(i.Type));
    expect(result.map((s) => s.name)).toEqual(["Axe", "Bow", "Sword"]);
  });
});

describe("per-category accessors", () => {
  test("allWeaponSubtypes returns 11 entries with expected names", async () => {
    const { allWeaponSubtypes } = await import("./subtypes");
    const result = allWeaponSubtypes();
    expect(result).toHaveLength(11);
    expect(result.map((s) => s.name)).toEqual([
      "1H Crush", "1H Pierce", "1H Slash", "1H Whip",
      "2H Crush", "2H Pierce", "2H Slash", "2H Staff",
      "Arrow", "Bow", "Quiver",
    ]);
  });

  test("allArmorSubtypes returns 5 entries", async () => {
    const { allArmorSubtypes } = await import("./subtypes");
    const result = allArmorSubtypes();
    expect(result.map((s) => s.name)).toEqual([
      "Breastplate", "Helmet", "Legging", "Shield", "Sleeve",
    ]);
  });

  test("allOtherSubtypes returns 4 entries", async () => {
    const { allOtherSubtypes } = await import("./subtypes");
    const result = allOtherSubtypes();
    expect(result.map((s) => s.name)).toEqual([
      "Purchase", "Rune", "Travel Gear", "Trophy",
    ]);
  });

  test("allPotionSubtypes contains 'Agility' and 'Other'", async () => {
    const { allPotionSubtypes } = await import("./subtypes");
    const result = allPotionSubtypes();
    const names = result.map((s) => s.name);
    expect(names).toContain("Agility");
    expect(names).toContain("Other");
    // 32 distinct potion subtypes total (per spec).
    expect(result.length).toBe(32);
  });

  test("subtype summaries carry imageUrl from a real item", async () => {
    const { allWeaponSubtypes } = await import("./subtypes");
    const slash = allWeaponSubtypes().find((s) => s.name === "1H Slash");
    expect(slash).toBeDefined();
    // Every weapon-1H-Slash row in the data has a non-null imageUrl, so
    // the picked representative will too.
    expect(typeof slash!.imageUrl).toBe("string");
  });
});

describe("gem accessors", () => {
  test("allGemColors returns the 6 gem colors", async () => {
    const { allGemColors } = await import("./subtypes");
    const result = allGemColors();
    expect(result.map((s) => s.name)).toEqual([
      "Black", "Blue", "Green", "Grey", "Red", "White",
    ]);
  });

  test("gemIdentitiesForColor returns identities for a known color", async () => {
    const { gemIdentitiesForColor } = await import("./subtypes");
    const result = gemIdentitiesForColor("black");
    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    // Each identity name has had its " Rank N" suffix stripped.
    for (const id of result!) {
      expect(id.name).not.toMatch(/\s+Rank\s+\d+$/i);
    }
  });

  test("gemIdentitiesForColor returns null for an unknown color", async () => {
    const { gemIdentitiesForColor } = await import("./subtypes");
    expect(gemIdentitiesForColor("octarine")).toBeNull();
  });

  test("gemsByEffectTag returns items tagged with the given mechanic", async () => {
    const { gemsByEffectTag } = await import("./subtypes");
    const heal = gemsByEffectTag("heal");
    expect(heal).not.toBeNull();
    expect(heal!.length).toBeGreaterThan(0);
    for (const item of heal!) {
      expect(item.Type.startsWith("Gem")).toBe(true);
      expect(item.tags).toContain("heal");
    }
  });

  test("gemsByEffectTag returns null for a tag with no matches", async () => {
    const { gemsByEffectTag } = await import("./subtypes");
    expect(gemsByEffectTag("nonexistent-tag")).toBeNull();
  });
});
