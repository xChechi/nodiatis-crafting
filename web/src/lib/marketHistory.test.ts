import { describe, expect, test, vi } from "vitest";

vi.mock("@/data/market-history.json", () => ({
  default: {
    "diamond-geode": [
      { month: "2026-05", ask: 30577 },
      { month: "2026-04", ask: 28500 },
    ],
    "citrine-geode": [{ month: "2026-05", ask: 48 }],
  },
}));

import { getHistoryForSlug, getAllSlugsWithHistory } from "./marketHistory";

describe("marketHistory", () => {
  test("returns the history entries newest-first for a known slug", () => {
    expect(getHistoryForSlug("diamond-geode")).toEqual([
      { month: "2026-05", ask: 30577 },
      { month: "2026-04", ask: 28500 },
    ]);
  });

  test("returns an empty array for an unknown slug", () => {
    expect(getHistoryForSlug("nonexistent-item")).toEqual([]);
  });

  test("getAllSlugsWithHistory lists every slug that has at least one reading", () => {
    expect(getAllSlugsWithHistory().sort()).toEqual([
      "citrine-geode",
      "diamond-geode",
    ]);
  });
});
