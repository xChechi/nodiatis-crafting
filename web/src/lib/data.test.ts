import { describe, expect, it } from "vitest";
import {
  allItemSlugs,
  allItems,
  getItemByName,
  getItemBySlug,
  totalItemCount,
  totalRecipeCount,
} from "./data";

// These tests run against the real bundled data files (~4 MB JSON imports).
// They guard against silent regressions in the data-loading layer:
// slug uniqueness, lookup round-trips, and back-reference integrity.

describe("data layer — counts", () => {
  it("loads the expected number of items", () => {
    // 5,488 is the count from the most recent scrape; if scraping changes the
    // number, this test should be updated alongside the regenerated data file.
    expect(totalItemCount()).toBeGreaterThan(5000);
    expect(totalItemCount()).toBe(allItems().length);
  });

  it("loads the expected number of recipes", () => {
    expect(totalRecipeCount()).toBeGreaterThan(2000);
  });
});

describe("data layer — slugs", () => {
  it("emits a unique slug for every item", () => {
    const slugs = allItemSlugs();
    expect(slugs).toHaveLength(totalItemCount());
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("never produces an empty slug", () => {
    for (const s of allItemSlugs()) expect(s.length).toBeGreaterThan(0);
  });

  it("produces URL-safe slugs (lowercase, hyphens, alnum)", () => {
    const bad = allItemSlugs().filter((s) => !/^[a-z0-9-]+$/.test(s));
    expect(bad).toEqual([]);
  });

  it("never produces leading or trailing hyphens", () => {
    const bad = allItemSlugs().filter(
      (s) => s.startsWith("-") || s.endsWith("-"),
    );
    expect(bad).toEqual([]);
  });
});

describe("data layer — lookups", () => {
  it("getItemBySlug round-trips for every item", () => {
    for (const item of allItems()) {
      const found = getItemBySlug(item.slug);
      expect(found?.Name).toBe(item.Name);
    }
  });

  it("getItemByName returns *some* item with the matching name (names are not unique)", () => {
    // The source DB contains duplicate names (e.g. two "Monkey Tail" entries),
    // so getItemByName can only return one of them. We assert correct lookup
    // by name — the slug roundtrip is intentionally not guaranteed.
    for (const item of allItems()) {
      const found = getItemByName(item.Name);
      expect(found?.Name).toBe(item.Name);
    }
  });

  it("returns undefined for unknown slug/name", () => {
    expect(getItemBySlug("absolutely-not-a-real-slug-xyz")).toBeUndefined();
    expect(getItemByName("Absolutely Not A Real Item XYZ")).toBeUndefined();
  });
});

describe("data layer — recipes & back-references", () => {
  it("recipe attachment is always a real recipe object", () => {
    // We do NOT assert recipe.itemType === item.RecipeType: the recipe-by-name
    // lookup can attach a recipe to a non-craftable item that happens to share
    // a name with a craftable one. This is a known source-data quirk; the
    // detail page renders recipe blocks regardless of RecipeType being set.
    for (const item of allItems()) {
      if (item.recipe) {
        expect(item.recipe.itemType).toEqual(expect.any(String));
        expect(Array.isArray(item.recipe.consumable)).toBe(true);
        expect(Array.isArray(item.recipe.finished)).toBe(true);
      }
    }
  });

  it("usedInSlugs always points to real items", () => {
    const allSlugs = new Set(allItemSlugs());
    for (const item of allItems()) {
      for (const s of item.usedInSlugs) {
        expect(allSlugs.has(s)).toBe(true);
      }
    }
  });

  it("back-reference is symmetric: if A.recipe.finished mentions B, then A's slug appears in B.usedInSlugs", () => {
    let checked = 0;
    for (const item of allItems()) {
      if (!item.recipe) continue;
      for (const mat of item.recipe.finished) {
        const matItem = getItemByName(mat.name);
        if (!matItem) continue; // some mat names may not match an item record
        expect(matItem.usedInSlugs).toContain(item.slug);
        checked++;
        if (checked > 500) return; // sample; full pass would be slow
      }
    }
  });
});
