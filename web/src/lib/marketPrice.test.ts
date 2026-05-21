import { describe, expect, test } from "vitest";
import { currentMarketPrice } from "./marketPrice";
import type { Item } from "./types";

function fakeItem(over: Partial<Item>): Item {
  return {
    Name: "x",
    Type: "Resource (Geode Tier 1)",
    Rarity: 0,
    Cost: 0,
    slug: "x",
    rarityLabel: "Common",
    imageUrl: null,
    tier: 1,
    tags: [],
    recipe: null,
    usedInSlugs: [],
    ...over,
  };
}

describe("currentMarketPrice", () => {
  test("returns the newest entry from MarketHistory when present", () => {
    const item = fakeItem({ Cost: 4, MarketHistory: [48, 47, 50] });
    expect(currentMarketPrice(item)).toBe(48);
  });

  test("falls back to Cost when MarketHistory is missing", () => {
    const item = fakeItem({ Cost: 5, MarketHistory: undefined });
    expect(currentMarketPrice(item)).toBe(5);
  });

  test("falls back to Cost when MarketHistory is an empty array", () => {
    const item = fakeItem({ Cost: 5, MarketHistory: [] });
    expect(currentMarketPrice(item)).toBe(5);
  });

  test("returns 0 when neither MarketHistory nor Cost is set", () => {
    const item = fakeItem({ Cost: undefined, MarketHistory: undefined });
    expect(currentMarketPrice(item)).toBe(0);
  });

  test("handles a null/undefined item gracefully", () => {
    expect(currentMarketPrice(null)).toBe(0);
    expect(currentMarketPrice(undefined)).toBe(0);
  });
});
