import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item, Mat, RawRecipe } from "./types";

// Mock the data module so crafting.ts doesn't pull in the full 4 MB JSON.
// Each test can register a fresh lookup table via `setItems()`.
const itemMap = new Map<string, Item>();

vi.mock("./data", () => ({
  getItemByName: (name: string) => itemMap.get(name),
}));

// Import AFTER vi.mock so the mock takes effect.
import {
  aggregatePlannerMats,
  expandToBaseMats,
  matsForItemAtDepth,
} from "./crafting";

function setItems(items: Item[]) {
  itemMap.clear();
  for (const i of items) itemMap.set(i.Name, i);
}

function makeItem(
  name: string,
  consumable: Mat[] = [],
  finished: Mat[] = [],
): Item {
  const recipe: RawRecipe | null =
    consumable.length === 0 && finished.length === 0
      ? null
      : {
          itemType: "Test",
          rarity: 0,
          level: 1,
          cost: 0,
          items: [name],
          consumable,
          finished,
        };
  return {
    Name: name,
    Type: "Test",
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    rarityLabel: "Common",
    imageUrl: null,
    tier: null,
    recipe,
    usedInSlugs: [],
  };
}

beforeEach(() => itemMap.clear());

describe("expandToBaseMats", () => {
  it("returns empty for empty input", () => {
    expect(expandToBaseMats([])).toEqual([]);
  });

  it("returns base mats unchanged when they have no recipe", () => {
    setItems([makeItem("Wood")]); // no recipe
    const out = expandToBaseMats([{ name: "Wood", tier: 1, qty: 5 }]);
    expect(out).toEqual([{ name: "Wood", tier: 1, qty: 5 }]);
  });

  it("keeps the intermediate mat AND its base children (additive expansion)", () => {
    // Cloth is craftable from 2 Thread per craft
    setItems([
      makeItem("Cloth", [{ name: "Thread", tier: 1, qty: 2 }]),
      makeItem("Thread"),
    ]);
    const out = expandToBaseMats([{ name: "Cloth", tier: 2, qty: 1 }]);
    // Both layers present: Cloth (intermediate) and Thread (base)
    expect(out).toContainEqual({ name: "Cloth", tier: 2, qty: 1 });
    expect(out).toContainEqual({ name: "Thread", tier: 1, qty: 2 });
    expect(out).toHaveLength(2);
  });

  it("scales child quantities by the parent quantity", () => {
    // Need 3 Cloth, each Cloth needs 2 Thread → 6 Thread total
    setItems([
      makeItem("Cloth", [{ name: "Thread", tier: 1, qty: 2 }]),
      makeItem("Thread"),
    ]);
    const out = expandToBaseMats([{ name: "Cloth", tier: 2, qty: 3 }]);
    expect(out).toContainEqual({ name: "Cloth", tier: 2, qty: 3 });
    expect(out).toContainEqual({ name: "Thread", tier: 1, qty: 6 });
  });

  it("merges the same (name, tier) reached via different paths", () => {
    // Robe needs 1 Cloth + 1 Thread directly.
    // Cloth itself needs 2 Thread.
    // So expanding [Robe] should yield Cloth=1, Thread=1+2=3.
    setItems([
      makeItem("Robe", [
        { name: "Cloth", tier: 2, qty: 1 },
        { name: "Thread", tier: 1, qty: 1 },
      ]),
      makeItem("Cloth", [{ name: "Thread", tier: 1, qty: 2 }]),
      makeItem("Thread"),
    ]);
    const out = expandToBaseMats([{ name: "Robe", tier: 3, qty: 1 }]);
    expect(out).toContainEqual({ name: "Thread", tier: 1, qty: 3 });
    expect(out).toContainEqual({ name: "Cloth", tier: 2, qty: 1 });
    expect(out).toContainEqual({ name: "Robe", tier: 3, qty: 1 });
  });

  it("keeps same name but different tiers as separate entries", () => {
    setItems([makeItem("Bone")]);
    const out = expandToBaseMats([
      { name: "Bone", tier: 1, qty: 4 },
      { name: "Bone", tier: 3, qty: 2 },
    ]);
    expect(out).toContainEqual({ name: "Bone", tier: 1, qty: 4 });
    expect(out).toContainEqual({ name: "Bone", tier: 3, qty: 2 });
    expect(out).toHaveLength(2);
  });

  it("does not infinite-loop on a self-referencing recipe", () => {
    // Pathological: Goo's recipe needs 1 Goo + 1 Sand
    setItems([
      makeItem("Goo", [
        { name: "Goo", tier: 1, qty: 1 },
        { name: "Sand", tier: 1, qty: 1 },
      ]),
      makeItem("Sand"),
    ]);
    const out = expandToBaseMats([{ name: "Goo", tier: 1, qty: 1 }]);
    // Self-referencing recipe is detected → Goo is returned without expanding
    expect(out).toContainEqual({ name: "Goo", tier: 1, qty: 1 });
    // Sand is NOT pulled in because we bail before recursing
    expect(out.find((m) => m.name === "Sand")).toBeUndefined();
  });

  it("sorts results by tier desc, then name asc", () => {
    setItems([makeItem("A"), makeItem("B")]);
    const out = expandToBaseMats([
      { name: "B", tier: 1, qty: 1 },
      { name: "A", tier: 3, qty: 1 },
      { name: "A", tier: 1, qty: 1 },
    ]);
    expect(out.map((m) => `${m.name}T${m.tier}`)).toEqual([
      "AT3",
      "AT1",
      "BT1",
    ]);
  });

  it("treats items with empty consumable list as base", () => {
    setItems([
      makeItem("Strange", [], [{ name: "Mystery", tier: 1, qty: 5 }]),
      makeItem("Mystery"),
    ]);
    const out = expandToBaseMats([{ name: "Strange", tier: 2, qty: 1 }]);
    expect(out).toEqual([{ name: "Strange", tier: 2, qty: 1 }]);
  });
});

describe("matsForItemAtDepth", () => {
  it("returns empty for items with no recipe", () => {
    const item = makeItem("Wood");
    expect(matsForItemAtDepth(item, "consumable")).toEqual([]);
    expect(matsForItemAtDepth(item, "finished")).toEqual([]);
    expect(matsForItemAtDepth(item, "base")).toEqual([]);
  });

  it("returns the consumable list when depth=consumable", () => {
    const item = makeItem(
      "Sword",
      [{ name: "Steel", tier: 3, qty: 1 }],
      [{ name: "Iron Ore", tier: 1, qty: 5 }],
    );
    expect(matsForItemAtDepth(item, "consumable")).toEqual([
      { name: "Steel", tier: 3, qty: 1 },
    ]);
  });

  it("returns the finished list when depth=finished", () => {
    const item = makeItem(
      "Sword",
      [{ name: "Steel", tier: 3, qty: 1 }],
      [{ name: "Iron Ore", tier: 1, qty: 5 }],
    );
    expect(matsForItemAtDepth(item, "finished")).toEqual([
      { name: "Iron Ore", tier: 1, qty: 5 },
    ]);
  });

  it("expands the consumable layer when depth=base", () => {
    setItems([
      makeItem("Steel", [{ name: "Iron Ore", tier: 1, qty: 2 }]),
      makeItem("Iron Ore"),
    ]);
    const item = makeItem("Sword", [{ name: "Steel", tier: 3, qty: 1 }]);
    const out = matsForItemAtDepth(item, "base");
    expect(out).toContainEqual({ name: "Steel", tier: 3, qty: 1 });
    expect(out).toContainEqual({ name: "Iron Ore", tier: 1, qty: 2 });
  });
});

describe("aggregatePlannerMats", () => {
  it("returns empty for empty entries", () => {
    expect(aggregatePlannerMats([], "consumable")).toEqual([]);
  });

  it("scales single-entry mats by the planner quantity", () => {
    const item = makeItem("Arrow", [{ name: "Wood", tier: 1, qty: 2 }]);
    const out = aggregatePlannerMats([{ item, quantity: 5 }], "consumable");
    expect(out).toEqual([{ name: "Wood", tier: 1, qty: 10 }]);
  });

  it("merges identical mats across multiple entries", () => {
    const sword = makeItem("Sword", [{ name: "Iron", tier: 2, qty: 3 }]);
    const dagger = makeItem("Dagger", [{ name: "Iron", tier: 2, qty: 1 }]);
    const out = aggregatePlannerMats(
      [
        { item: sword, quantity: 2 },
        { item: dagger, quantity: 4 },
      ],
      "consumable",
    );
    // 2*3 + 4*1 = 10
    expect(out).toEqual([{ name: "Iron", tier: 2, qty: 10 }]);
  });

  it("respects depth=finished (does not recurse)", () => {
    const item = makeItem(
      "Robe",
      [{ name: "Cloth", tier: 2, qty: 1 }],
      [{ name: "Thread", tier: 1, qty: 4 }],
    );
    setItems([
      makeItem("Cloth", [{ name: "Thread", tier: 1, qty: 2 }]),
      makeItem("Thread"),
    ]);
    const out = aggregatePlannerMats([{ item, quantity: 3 }], "finished");
    // 'finished' uses the recipe's stock breakdown — 4 Thread × 3 = 12
    expect(out).toEqual([{ name: "Thread", tier: 1, qty: 12 }]);
  });

  it("expands recursively when depth=base across entries", () => {
    setItems([
      makeItem("Cloth", [{ name: "Thread", tier: 1, qty: 2 }]),
      makeItem("Thread"),
    ]);
    const robe = makeItem("Robe", [{ name: "Cloth", tier: 2, qty: 1 }]);
    const tunic = makeItem("Tunic", [{ name: "Cloth", tier: 2, qty: 2 }]);
    const out = aggregatePlannerMats(
      [
        { item: robe, quantity: 1 },
        { item: tunic, quantity: 1 },
      ],
      "base",
    );
    // Cloth: 1*1 + 1*2 = 3
    // Thread: 3 cloth * 2 thread = 6
    expect(out).toContainEqual({ name: "Cloth", tier: 2, qty: 3 });
    expect(out).toContainEqual({ name: "Thread", tier: 1, qty: 6 });
  });

  it("skips planner entries whose items have no recipe", () => {
    const wood = makeItem("Wood"); // no recipe
    const out = aggregatePlannerMats([{ item: wood, quantity: 5 }], "base");
    expect(out).toEqual([]);
  });
});
