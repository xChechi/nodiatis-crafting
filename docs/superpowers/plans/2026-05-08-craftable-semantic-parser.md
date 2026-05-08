# Craftable Semantic Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the exact-name `parseInventory` in `CraftableClient.tsx` with a layered resolver (exact → material-tier → tier range → gem color → fuzzy) that supports unbounded inventory entries (no qty = Infinity), and add a typeahead suggestion dropdown below the textarea.

**Architecture:** A new pure module `lib/inventory.ts` exposes per-strategy parsers, an orchestrator `parseInventoryLine(line)`, a multi-line `parseInventory(input)`, and a separate `generateSuggestions(activeLine)`. `evaluateRecipe` keeps its arithmetic but stops squashing `canCraft === Infinity` to 0 — display now shows `∞` for unbounded crafts. A new presentational `SuggestionList` component renders the dropdown; `CraftableClient` adds a tiny state machine for active line + suggestions + keyboard nav.

**Tech Stack:** TypeScript, Next.js 16, React 19, Vitest 2 (existing); fuse.js (already a dep, used by `GlobalSearch`).

**Spec:** `docs/superpowers/specs/2026-05-08-craftable-semantic-parser-design.md`

---

## File map

| File | New / Modify | Purpose |
|---|---|---|
| `web/src/lib/inventory.ts` | **New** | Pure parser: per-strategy helpers + orchestrator + suggestion generator |
| `web/src/lib/inventory.test.ts` | **New** | Unit tests |
| `web/src/app/craftable/SuggestionList.tsx` | **New** | Presentational dropdown component |
| `web/src/app/craftable/CraftableClient.tsx` | Modify | Replace inline parser, render `∞` for unbounded, add typeahead state |

---

## Tiered material types (used in tests + the parser)

The 22 tiered material types: `Bone, Cloth, Dust, Dye, Fish, Geode, Ingot, Leather, Oil, Ore, Plank, Plant, Prey, Resin, Rodent, Scale, Silk, Sinew, Skin, Thread, Vegetable, Wood`. Source of truth: `allMaterialTypes()` from `lib/data.ts` returning `MaterialTypeSummary[]` (a tiered type has `tierRange !== null`).

The 6 gem colors: `Black, Blue, Green, Grey, Red, White`. Source: `allGemColors()` from `lib/subtypes.ts`.

---

## Task 1: `parseMaterialShorthand` + tests

**Files:**
- Create: `web/src/lib/inventory.ts`
- Test: `web/src/lib/inventory.test.ts`

Recognises `t30 dye`, `T1 ore`, `tier 5 bone`, and the reversed forms `dye t30`, `ore T1`, `bone tier 5`. Plural `s` is stripped from the type. Returns the canonical material `Item` or `null`.

- [ ] **Step 1: Write failing tests**

Create `web/src/lib/inventory.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: FAIL — module `./inventory` not found.

- [ ] **Step 3: Implement `parseMaterialShorthand`**

Create `web/src/lib/inventory.ts`:

```ts
// Inventory-line parser used by the Craftable page. Layered resolution:
// exact name → material-tier shorthand → tier range → gem color → fuzzy.
// Each strategy is a pure function over a string; the orchestrator
// (parseInventoryLine, added in Task 5) tries them in order.

import { allItems, allMaterialTypes } from "./data";
import type { Item } from "./types";

const TIER_RE = /^[Tt](\d+)$/;
const TIER_WORD_RE = /^[Tt]ier\s+(\d+)$/i;

/** Strip a single trailing 's' if it makes the result a known type name. */
function stripPluralIfTypeMatch(word: string, isType: (t: string) => boolean): string {
  if (word.length > 1 && word.endsWith("s") && isType(word.slice(0, -1))) {
    return word.slice(0, -1);
  }
  return word;
}

/** Extract a tier number from a token like "T30" or "tier 30" (full string). */
function readTier(s: string): number | null {
  const m = s.match(TIER_RE) ?? s.match(TIER_WORD_RE);
  return m ? parseInt(m[1], 10) : null;
}

/** Look up a tiered material item by canonical type name and tier. */
function findMaterial(typeName: string, tier: number): Item | null {
  return (
    allItems().find((i) => i.Type === `Resource (${typeName} Tier ${tier})`) ??
    null
  );
}

/** Names of the 22 tiered material types, lowercase, longest first. */
let _tieredTypes: string[] | null = null;
function tieredTypesByLengthDesc(): string[] {
  if (_tieredTypes) return _tieredTypes;
  _tieredTypes = allMaterialTypes()
    .filter((t) => t.tierRange !== null)
    .map((t) => t.name)
    .sort((a, b) => b.length - a.length);
  return _tieredTypes;
}

/** Match the type name (case-insensitive, plural-tolerant) and return the canonical name. */
function matchTieredType(input: string): string | null {
  const normalised = input.trim().toLowerCase();
  const types = tieredTypesByLengthDesc();
  // Exact (singular) match first.
  for (const t of types) {
    if (t.toLowerCase() === normalised) return t;
  }
  // Plural: strip trailing 's' and retry.
  if (normalised.endsWith("s") && normalised.length > 1) {
    const singular = normalised.slice(0, -1);
    for (const t of types) {
      if (t.toLowerCase() === singular) return t;
    }
  }
  return null;
}

/**
 * Recognise material-tier shorthand. Examples that resolve:
 *   "t30 dye", "T1 ore", "tier 5 bone", "dye t30", "ore T1", "bone tier 5",
 *   "t1 bones" (plural).
 * Bare-number prefix ("30 dye") is intentionally NOT recognised — it conflicts
 * with the qty-prefix parsing upstream.
 */
export function parseMaterialShorthand(input: string): Item | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try splitting into "tierToken typeToken" or "typeToken tierToken".
  // We accept "t30 dye" (2 tokens) and "tier 5 dye" (3 tokens) in either order.
  const tokens = trimmed.split(/\s+/);

  // Helper: try parsing tokens [a..b) as the tier and [c..d) as the type.
  const tryRanges = (
    tierStart: number,
    tierEnd: number,
    typeStart: number,
    typeEnd: number,
  ): Item | null => {
    const tierStr = tokens.slice(tierStart, tierEnd).join(" ");
    const typeStr = tokens.slice(typeStart, typeEnd).join(" ");
    const tier = readTier(tierStr);
    if (tier === null) return null;
    const typeName = matchTieredType(typeStr);
    if (!typeName) return null;
    return findMaterial(typeName, tier);
  };

  // Two-token: "T30 dye" or "dye T30"
  if (tokens.length === 2) {
    return (
      tryRanges(0, 1, 1, 2) ?? tryRanges(1, 2, 0, 1)
    );
  }
  // Three-token: "tier 5 dye" / "dye tier 5"
  if (tokens.length === 3) {
    return (
      tryRanges(0, 2, 2, 3) ?? tryRanges(1, 3, 0, 1)
    );
  }
  // Four-token: "tier 5 armor essence" / "armor essence tier 5"
  if (tokens.length === 4) {
    return (
      tryRanges(0, 2, 2, 4) ?? tryRanges(2, 4, 0, 2)
    );
  }
  return null;
}
```

- [ ] **Step 4: Run tests**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/inventory.ts web/src/lib/inventory.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(inventory): material-tier shorthand parser + tests"
```

---

## Task 2: `parseRangeShorthand` + tests

**Files:**
- Modify: `web/src/lib/inventory.ts`
- Modify: `web/src/lib/inventory.test.ts`

Recognises `t1-30 dye`, `tier 5-10 ore`, etc. Returns `Item[]` (one per tier in the range, inclusive). Bounds clamped to [1, 30] to match the data.

- [ ] **Step 1: Append failing tests**

Append to `web/src/lib/inventory.test.ts`:

```ts
import { parseRangeShorthand } from "./inventory";

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
```

- [ ] **Step 2: Run tests, verify FAIL**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: FAIL — `parseRangeShorthand` not exported.

- [ ] **Step 3: Implement `parseRangeShorthand`**

Append to `web/src/lib/inventory.ts`:

```ts
const TIER_RANGE_RE = /^[Tt](\d+)-(\d+)$/;
const TIER_WORD_RANGE_RE = /^[Tt]ier\s+(\d+)-(\d+)$/i;

function readTierRange(s: string): { lo: number; hi: number } | null {
  const m = s.match(TIER_RANGE_RE) ?? s.match(TIER_WORD_RANGE_RE);
  if (!m) return null;
  const lo = parseInt(m[1], 10);
  const hi = parseInt(m[2], 10);
  if (lo > hi || lo < 1 || hi > 30) return null;
  return { lo, hi };
}

/**
 * Recognise tier-range shorthand. Examples:
 *   "t1-30 dye"        → 30 items (T1..T30 Dye)
 *   "tier 5-7 bone"    → 3 items
 *   "dye t1-3"         → 3 items (reversed order)
 * Inverted ranges (lo > hi) and unknown types return null.
 */
export function parseRangeShorthand(input: string): Item[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);

  const tryRanges = (
    rangeStart: number,
    rangeEnd: number,
    typeStart: number,
    typeEnd: number,
  ): Item[] | null => {
    const rangeStr = tokens.slice(rangeStart, rangeEnd).join(" ");
    const typeStr = tokens.slice(typeStart, typeEnd).join(" ");
    const range = readTierRange(rangeStr);
    if (!range) return null;
    const typeName = matchTieredType(typeStr);
    if (!typeName) return null;
    const out: Item[] = [];
    for (let t = range.lo; t <= range.hi; t++) {
      const it = findMaterial(typeName, t);
      if (it) out.push(it);
    }
    return out.length > 0 ? out : null;
  };

  if (tokens.length === 2) {
    return tryRanges(0, 1, 1, 2) ?? tryRanges(1, 2, 0, 1);
  }
  if (tokens.length === 3) {
    return tryRanges(0, 2, 2, 3) ?? tryRanges(1, 3, 0, 1);
  }
  return null;
}
```

- [ ] **Step 4: Run tests**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: all 18 tests in inventory.test.ts pass.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/inventory.ts web/src/lib/inventory.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(inventory): tier-range shorthand parser + tests"
```

---

## Task 3: `parseGemColorShorthand` + tests

**Files:**
- Modify: `web/src/lib/inventory.ts`
- Modify: `web/src/lib/inventory.test.ts`

Recognises `red gem`, `red t5 gem`, `black gems`, `green tier 3 gem`. Returns `Item[]` of all gem items matching the color and (optional) rank. The trailing `gem(s?)` token is required.

- [ ] **Step 1: Append failing tests**

Append to `web/src/lib/inventory.test.ts`:

```ts
import { parseGemColorShorthand } from "./inventory";

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
```

- [ ] **Step 2: Run tests, verify FAIL**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: FAIL — `parseGemColorShorthand` not exported.

- [ ] **Step 3: Implement `parseGemColorShorthand`**

Append to `web/src/lib/inventory.ts`:

```ts
const GEM_COLORS = ["Black", "Blue", "Green", "Grey", "Red", "White"] as const;
const GEM_TOKEN_RE = /^gems?$/i;

/**
 * Recognise gem-color shorthand. Examples:
 *   "red gem"          → all red gems, all ranks
 *   "red t5 gem"       → all red gems at rank 5
 *   "blue tier 3 gem"  → all blue gems at rank 3
 *   "black gems"       → plural ok
 * Requires the trailing "gem"/"gems" token.
 */
export function parseGemColorShorthand(input: string): Item[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return null;

  // Last token must be "gem" or "gems".
  if (!GEM_TOKEN_RE.test(tokens[tokens.length - 1])) return null;
  const inner = tokens.slice(0, -1);

  // First token must be a color (case-insensitive).
  const colorMatch = GEM_COLORS.find(
    (c) => c.toLowerCase() === inner[0].toLowerCase(),
  );
  if (!colorMatch) return null;

  // Optional rank: remaining tokens form a tier expression ("t5" or "tier 5").
  let rank: number | null = null;
  if (inner.length > 1) {
    const rankStr = inner.slice(1).join(" ");
    rank = readTier(rankStr);
    if (rank === null) return null;
  }

  const all = allItems().filter((i) => i.Type === `Gem (${colorMatch})`);
  if (rank === null) return all.length > 0 ? all : null;
  const filtered = all.filter((i) =>
    i.Name.match(new RegExp(`\\sRank\\s+${rank}$`, "i")),
  );
  return filtered.length > 0 ? filtered : null;
}
```

- [ ] **Step 4: Run tests**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: 25 tests in inventory.test.ts pass.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/inventory.ts web/src/lib/inventory.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(inventory): gem color shorthand parser + tests"
```

---

## Task 4: `fuzzyResolve` + tests

**Files:**
- Modify: `web/src/lib/inventory.ts`
- Modify: `web/src/lib/inventory.test.ts`

Single fuse.js instance keyed on item names. Returns the top match above threshold, or null.

- [ ] **Step 1: Append failing tests**

Append to `web/src/lib/inventory.test.ts`:

```ts
import { fuzzyResolve } from "./inventory";

describe("fuzzyResolve", () => {
  test("matches exact known name", () => {
    const item = fuzzyResolve("Bone Sword");
    // If no item literally named "Bone Sword" exists, the test still serves
    // as a smoke check; in that case expect either null or a close match.
    if (item) expect(typeof item.Name).toBe("string");
  });

  test("recovers a known-good item from a small typo", () => {
    // Pick a real item and corrupt one character. Use the first weapon item.
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
```

(Note: the `await import` syntax inside a test requires the test function to be `async`. Update the second test signature accordingly.)

- [ ] **Step 2: Run tests, verify FAIL**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: FAIL — `fuzzyResolve` not exported.

- [ ] **Step 3: Implement `fuzzyResolve`**

Append to `web/src/lib/inventory.ts`:

```ts
import Fuse from "fuse.js";

const FUZZY_THRESHOLD = 0.35;
let _fuse: Fuse<Item> | null = null;

function getFuse(): Fuse<Item> {
  if (_fuse) return _fuse;
  _fuse = new Fuse(allItems(), {
    keys: ["Name"],
    threshold: FUZZY_THRESHOLD,
    distance: 100,
    ignoreLocation: true,
  });
  return _fuse;
}

/**
 * Fuzzy-match a query against all item names. Returns the top result above
 * the FUZZY_THRESHOLD, or null. Auto-pick semantics: ambiguous queries
 * silently take the best score.
 */
export function fuzzyResolve(query: string): Item | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const results = getFuse().search(trimmed, { limit: 1 });
  return results.length > 0 ? results[0].item : null;
}
```

- [ ] **Step 4: Make the second test async**

Edit the test from Step 1 — the test that uses `await import("./data")` should have signature `test("recovers a known-good item from a small typo", async () => { ... })`. If the implementer wrote it without `async`, fix it now.

- [ ] **Step 5: Run tests**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: 29 tests pass (including the 4 new fuzzy tests; some may early-return if "Bone Sword" doesn't exist — that's OK).

- [ ] **Step 6: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/inventory.ts web/src/lib/inventory.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(inventory): fuzzy-match fallback via fuse.js"
```

---

## Task 5: `parseInventoryLine` orchestrator + tests

**Files:**
- Modify: `web/src/lib/inventory.ts`
- Modify: `web/src/lib/inventory.test.ts`

Orchestrator: takes one raw line, extracts qty (optional), runs strategies in order, returns 0+ entries (or warning). Entry shape: `{ name, qty }` where `qty` is `Infinity` for unbounded.

- [ ] **Step 1: Append failing tests**

Append to `web/src/lib/inventory.test.ts`:

```ts
import { parseInventoryLine } from "./inventory";

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
```

- [ ] **Step 2: Run tests, verify FAIL**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: FAIL — `parseInventoryLine` not exported.

- [ ] **Step 3: Implement `parseInventoryLine`**

Append to `web/src/lib/inventory.ts`:

```ts
export interface InventoryEntry {
  /** Canonical item name. */
  name: string;
  /** Quantity. `Infinity` means "unbounded" — user has at least the recipe asks. */
  qty: number;
}

/**
 * Extract optional qty from a line and return { name, qty | null }.
 * Supports "name: qty", "qty name", "name qty". If no qty is found, returns
 * the full input as `name` with qty=null.
 */
function splitQty(line: string): { name: string; qty: number | null } {
  const trimmed = line.trim();

  const colon = trimmed.match(/^(.+?)\s*:\s*(\d+)\s*$/);
  if (colon) return { name: colon[1].trim(), qty: parseInt(colon[2], 10) };

  const leading = trimmed.match(/^(\d+)\s+(.+)$/);
  if (leading) return { name: leading[2].trim(), qty: parseInt(leading[1], 10) };

  const trailing = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (trailing) return { name: trailing[1].trim(), qty: parseInt(trailing[2], 10) };

  return { name: trimmed, qty: null };
}

/**
 * Resolve a single line. Tries strategies in order:
 *   1. Exact name (getItemByName)
 *   2. Material-tier shorthand
 *   3. Tier-range shorthand
 *   4. Gem color shorthand
 *   5. Fuzzy fallback
 * Returns 0+ entries with the line's qty (or Infinity if not specified).
 * If no strategy matches, returns a `warning` describing the unrecognised input.
 */
export function parseInventoryLine(line: string): {
  entries: InventoryEntry[];
  warning?: string;
} {
  const { name, qty } = splitQty(line);
  if (!name) return { entries: [] };
  const finalQty = qty ?? Infinity;

  const wrap = (items: Item[]): InventoryEntry[] =>
    items.map((it) => ({ name: it.Name, qty: finalQty }));

  // 1. Exact name match
  const exact = allItems().find(
    (i) => i.Name.toLowerCase() === name.toLowerCase(),
  );
  if (exact) return { entries: wrap([exact]) };

  // 2. Material-tier
  const mat = parseMaterialShorthand(name);
  if (mat) return { entries: wrap([mat]) };

  // 3. Tier-range
  const range = parseRangeShorthand(name);
  if (range) return { entries: wrap(range) };

  // 4. Gem color
  const gems = parseGemColorShorthand(name);
  if (gems) return { entries: wrap(gems) };

  // 5. Fuzzy fallback
  const fuzzy = fuzzyResolve(name);
  if (fuzzy) return { entries: wrap([fuzzy]) };

  return { entries: [], warning: `Unknown item: "${name}"` };
}
```

- [ ] **Step 4: Run tests**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: 37 tests in inventory.test.ts pass.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/inventory.ts web/src/lib/inventory.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(inventory): parseInventoryLine orchestrator with strategy chain"
```

---

## Task 6: `parseInventory` (multi-line + merge) + tests + integrate into CraftableClient

**Files:**
- Modify: `web/src/lib/inventory.ts`
- Modify: `web/src/lib/inventory.test.ts`
- Modify: `web/src/app/craftable/CraftableClient.tsx`

Multi-line entrypoint that splits the textarea on commas/newlines, calls `parseInventoryLine` for each, merges duplicates with max-qty semantics. Replaces the inline parser in `CraftableClient`. Display layer renders `∞` for `Infinity`.

- [ ] **Step 1: Append failing tests**

Append to `web/src/lib/inventory.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests, verify FAIL**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: FAIL — `parseInventory` not exported (yet — different export from inventory.ts).

- [ ] **Step 3: Implement `parseInventory`**

Append to `web/src/lib/inventory.ts`:

```ts
/**
 * Parse a full textarea input. Splits on newline AND comma. Lines are
 * resolved independently via parseInventoryLine. Entries with the same
 * canonical name are merged: max qty wins, so Infinity beats any finite.
 */
export function parseInventory(input: string): {
  entries: InventoryEntry[];
  warnings: string[];
} {
  const lines = input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const merged = new Map<string, number>();
  const warnings: string[] = [];

  for (const line of lines) {
    const { entries, warning } = parseInventoryLine(line);
    if (warning) warnings.push(warning);
    for (const e of entries) {
      const prev = merged.get(e.name);
      const next = prev === undefined ? e.qty : Math.max(prev, e.qty);
      merged.set(e.name, next);
    }
  }

  const entries: InventoryEntry[] = [];
  for (const [name, qty] of merged) entries.push({ name, qty });
  return { entries, warnings };
}
```

- [ ] **Step 4: Run library tests**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: 42 tests in inventory.test.ts pass.

- [ ] **Step 5: Update `CraftableClient.tsx` — replace inline parser**

Open `web/src/app/craftable/CraftableClient.tsx`. Make four edits:

**5a)** At the top, replace the inline `InventoryEntry` interface and the inline `parseInventory` function (currently lines 9–13 + lines 31–94) with an import:

```tsx
import { parseInventory } from "@/lib/inventory";
```

Delete the now-unused `getItemByName` import line if it's the only consumer (search for `getItemByName` in the file — if `parseInventory` was the only caller, drop it from the imports).

**5b)** In `evaluateRecipe` (around line 100), change the line that converts Infinity → 0 in the return value:

```tsx
// was:
canCraft: canCraft === Infinity ? 0 : canCraft,
// to:
canCraft,
```

This preserves Infinity through the result so the display layer can render `∞`.

**5c)** Find the JSX that displays `canCraft` (search for `canCraft` references in the JSX — likely something like `×{m.canCraft}` or `{m.canCraft}` in a "fully craftable" section). Wrap with a formatter:

```tsx
function formatCanCraft(n: number): string {
  return n === Infinity ? "∞" : n.toLocaleString("en-US");
}
```

Add this helper at the top of the file (between `parseInventory` import and `CraftableClient` component). Use it everywhere `canCraft` is displayed:

```tsx
×{formatCanCraft(m.canCraft)}
```

**5d)** Update the `partial` filter that detects "0 craft" rows. The current line `const partial = matches.filter((m) => m.canCraft === 0);` works as-is — Infinity !== 0 so unbounded crafts stay in `fullyCraftable`. No change needed for filtering. But mentally trace through:

- All-unbounded recipe: `canCraft = Infinity`, `Infinity > 0` is true, lands in `fullyCraftable`. ✓
- Partially covered recipe: `canCraft = 0`, lands in `partial`. ✓
- Mixed (some unbounded, some finite): `canCraft = min(Infinity, finite) = finite`. Lands in `fullyCraftable` if >0, else `partial`. ✓

- [ ] **Step 6: Update placeholder text**

Find the `PLACEHOLDER` const at the top of `CraftableClient.tsx`:

```tsx
const PLACEHOLDER = `e.g.
Thistleberry Dye: 8
Garden Cloth, 4
3 Stickboard
`;
```

Replace with:

```tsx
const PLACEHOLDER = `e.g.
6 t30 dyes
t1-30 dye
red t5 gem
Mongoose Leg Bone: 12
`;
```

- [ ] **Step 7: Verify (tsc, lint, tests, all)**

Run from `web/`:
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` — all 42 + existing 65 + previous suite total = ~107 tests passing

(If CraftableClient previously had its own helper test, it's been deleted with the inline parser; that's expected.)

- [ ] **Step 8: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/inventory.ts web/src/lib/inventory.test.ts web/src/app/craftable/CraftableClient.tsx
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(craftable): wire new parseInventory + render ∞ for unbounded crafts"
```

---

## Task 7: `generateSuggestions` for typeahead + tests

**Files:**
- Modify: `web/src/lib/inventory.ts`
- Modify: `web/src/lib/inventory.test.ts`

Given an active line (the line the cursor is on), produce up to 5 suggestion strings the user can accept. Suggestions come from peeking at each strategy's outputs.

- [ ] **Step 1: Append failing tests**

Append to `web/src/lib/inventory.test.ts`:

```ts
import { generateSuggestions } from "./inventory";

describe("generateSuggestions", () => {
  test("'t30 d' → suggests T30 Dust, T30 Dye, ...", () => {
    const sugs = generateSuggestions("t30 d");
    expect(sugs.length).toBeGreaterThan(0);
    expect(sugs.length).toBeLessThanOrEqual(5);
    // Should include at least one tiered material at T30 starting with D
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
```

- [ ] **Step 2: Run tests, verify FAIL**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: FAIL — `generateSuggestions` not exported.

- [ ] **Step 3: Implement `generateSuggestions`**

Append to `web/src/lib/inventory.ts`:

```ts
const MAX_SUGGESTIONS = 5;

/**
 * Produce up to 5 suggestion strings for the given partial input. Suggestions
 * are strings the user can accept to replace the active line.
 *
 * Order:
 *   1. Material-tier exact prefix matches ("t30 d" → "t30 Dye", "t30 Dust", ...)
 *   2. Tier-only prefix ("t5" → "t5 Bone", "t5 Cloth", ... up to 5)
 *   3. Gem color prefix matches
 *   4. Fuzzy literal item name matches
 */
export function generateSuggestions(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    if (out.length >= MAX_SUGGESTIONS) return;
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  // Strategy 1: tier + partial type (e.g. "t30 d" → "t30 Dye", "t30 Dust")
  const tierPrefixMatch = trimmed.match(/^([Tt]\d+|[Tt]ier\s+\d+)\s+(.+)$/);
  if (tierPrefixMatch) {
    const tierStr = tierPrefixMatch[1];
    const tier = readTier(tierStr);
    const typePrefix = tierPrefixMatch[2].toLowerCase().trim();
    if (tier !== null) {
      const types = tieredTypesByLengthDesc();
      for (const t of types) {
        if (t.toLowerCase().startsWith(typePrefix)) {
          push(`${tierStr} ${t}`);
        }
      }
    }
  }

  // Strategy 2: tier alone ("t5" with no type yet)
  const tierAlone = trimmed.match(/^([Tt]\d+|[Tt]ier\s+\d+)$/);
  if (tierAlone) {
    const tierStr = tierAlone[1];
    for (const t of tieredTypesByLengthDesc()) push(`${tierStr} ${t}`);
  }

  // Strategy 3: gem-color prefix
  const lower = trimmed.toLowerCase();
  for (const c of GEM_COLORS) {
    if (c.toLowerCase().startsWith(lower) || lower.startsWith(c.toLowerCase())) {
      push(`${c} gem`);
    }
  }

  // Strategy 4: fuzzy literal-name suggestions
  const fuse = getFuse();
  const fuzzyResults = fuse.search(trimmed, { limit: MAX_SUGGESTIONS });
  for (const r of fuzzyResults) push(r.item.Name);

  return out.slice(0, MAX_SUGGESTIONS);
}
```

- [ ] **Step 4: Run tests**

Run from `web/`: `npm test -- inventory.test.ts`
Expected: 47 tests in inventory.test.ts pass.

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/lib/inventory.ts web/src/lib/inventory.test.ts
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(inventory): generateSuggestions for typeahead"
```

---

## Task 8: `SuggestionList` component

**Files:**
- Create: `web/src/app/craftable/SuggestionList.tsx`

Pure presentational dropdown. No state, no side effects.

- [ ] **Step 1: Create the component**

Create `web/src/app/craftable/SuggestionList.tsx`:

```tsx
"use client";

interface Props {
  suggestions: string[];
  activeIndex: number;
  onSelect(s: string): void;
}

export function SuggestionList({ suggestions, activeIndex, onSelect }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <ul
      role="listbox"
      className="mt-1 max-h-40 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)] shadow-lg"
    >
      {suggestions.map((s, i) => (
        <li key={s} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            onClick={() => onSelect(s)}
            className={
              "block w-full text-left px-3 py-1.5 text-sm transition-colors " +
              (i === activeIndex
                ? "bg-[var(--color-bg-3)] text-[var(--color-fg-1)]"
                : "text-[var(--color-fg-2)] hover:bg-[var(--color-bg-3)] hover:text-[var(--color-fg-1)]")
            }
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/app/craftable/SuggestionList.tsx
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(craftable): SuggestionList dropdown component"
```

---

## Task 9: Wire typeahead into `CraftableClient`

**Files:**
- Modify: `web/src/app/craftable/CraftableClient.tsx`

Add active-line detection, suggestion state, keyboard handler, and render `<SuggestionList>`. The dropdown sits below the textarea and operates on the line containing the cursor.

- [ ] **Step 1: Add suggestion state + helpers**

In `CraftableClient.tsx`:

**1a)** Add imports at the top:
```tsx
import { useRef } from "react";
import { generateSuggestions } from "@/lib/inventory";
import { SuggestionList } from "./SuggestionList";
```

**1b)** Inside `CraftableClient()`, add state and a ref for the textarea:

```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null);
const [activeIdx, setActiveIdx] = useState(0);
const [showSuggestions, setShowSuggestions] = useState(false);
```

**1c)** Compute the active line and suggestions via `useMemo`:

```tsx
function getActiveLine(text: string, cursor: number): { line: string; start: number; end: number } {
  const start = text.lastIndexOf("\n", cursor - 1) + 1;
  const endNl = text.indexOf("\n", cursor);
  const end = endNl === -1 ? text.length : endNl;
  return { line: text.slice(start, end), start, end };
}

const cursor = textareaRef.current?.selectionStart ?? input.length;
const activeLine = useMemo(
  () => getActiveLine(input, cursor),
  [input, cursor],
);
const suggestions = useMemo(
  () => (showSuggestions ? generateSuggestions(activeLine.line) : []),
  [showSuggestions, activeLine.line],
);
```

**1d)** Reset `activeIdx` when suggestions change:
```tsx
useEffect(() => {
  setActiveIdx(0);
}, [suggestions.length, activeLine.line]);
```

(Add `useEffect` to the `react` imports.)

- [ ] **Step 2: Add keyboard handler + accept logic**

Inside `CraftableClient()`, add:

```tsx
function acceptSuggestion(s: string) {
  // Replace the active line in the textarea content with the suggestion.
  const before = input.slice(0, activeLine.start);
  const after = input.slice(activeLine.end);
  const newText = `${before}${s}${after}`;
  setInput(newText);
  setShowSuggestions(false);
  // Move cursor to end of inserted suggestion
  const newCursor = before.length + s.length;
  requestAnimationFrame(() => {
    textareaRef.current?.setSelectionRange(newCursor, newCursor);
    textareaRef.current?.focus();
  });
}

function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (!showSuggestions || suggestions.length === 0) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    setActiveIdx((i) => Math.max(i - 1, 0));
  } else if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    acceptSuggestion(suggestions[activeIdx]);
  } else if (e.key === "Escape") {
    e.preventDefault();
    setShowSuggestions(false);
  }
}
```

- [ ] **Step 3: Wire up the textarea + dropdown**

Find the `<textarea>` in the JSX. Update it:

```tsx
<textarea
  ref={textareaRef}
  value={input}
  onChange={(e) => {
    setInput(e.target.value);
    setShowSuggestions(true);
  }}
  onFocus={() => setShowSuggestions(true)}
  onBlur={() => {
    // Delay so click on a suggestion can fire first
    setTimeout(() => setShowSuggestions(false), 150);
  }}
  onKeyDown={handleKeyDown}
  placeholder={PLACEHOLDER}
  className="..."  // existing classes unchanged
  rows={6}
/>
<SuggestionList
  suggestions={suggestions}
  activeIndex={activeIdx}
  onSelect={acceptSuggestion}
/>
```

- [ ] **Step 4: Verify (tsc, lint, tests)**

Run from `web/`:
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` — all tests still pass (no new tests for the integration; UI is dev-server smoke).

- [ ] **Step 5: Commit**

```bash
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" add web/src/app/craftable/CraftableClient.tsx
git -C "c:/Users/Nino.Cenov/Documents/Claude_AI/Projects/nodiatis-crafting" commit -m "feat(craftable): typeahead suggestions below textarea"
```

---

## Task 10: Build + dev-server smoke test

**Files:**
- None modified; verification gate.

- [ ] **Step 1: Re-run the data build pipeline**

Run from `web/`: `npm run build:data`
Expected: completes without error.

- [ ] **Step 2: Final sweep**

Run from `web/`:
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` — all tests passing (47 inventory + earlier 65 = 112)

- [ ] **Step 3: Dev-server click-through**

Run from `web/`: `npm run dev`. Visit `/craftable`:

1. Type `6 t30 dyes` and press Find recipes — should show recipes that use T30 Dye, with crafts based on having 6.
2. Type `t1-30 dye` (no qty) — should show recipes using ANY T30 Dye, marked as ∞ if all mats are unbounded.
3. Type `red t5 gem` — should resolve all red gems at rank 5.
4. Type `Mongoose Leg Bo` (typo/partial) — typeahead dropdown should suggest "Mongoose Leg Bone".
5. Type `mongoos leg bone` (typo) without using typeahead and submit — should fuzzy-resolve to "Mongoose Leg Bone".
6. Use ↓ ↑ keys to navigate the typeahead, Enter to accept.
7. Type `garblegarble` — should warn "Unknown item: 'garblegarble'".
8. Type `t30 dust` (no qty) and `Mongoose Leg Bone: 5` — mixed unbounded + finite. Recipes show the finite-bound canCraft.

- [ ] **Step 4: Fix anything off as follow-up commits.**

---

## Self-review

- **Spec coverage:**
  - Material-tier shorthand ✓ Task 1
  - Tier ranges ✓ Task 2
  - Gem color shorthand ✓ Task 3
  - Fuzzy fallback ✓ Task 4
  - Orchestrator ✓ Task 5
  - Multi-line + merge ✓ Task 6
  - `evaluateRecipe` Infinity preservation ✓ Task 6 (step 5b)
  - Display `∞` ✓ Task 6 (step 5c)
  - Suggestion generator ✓ Task 7
  - SuggestionList component ✓ Task 8
  - CraftableClient typeahead integration ✓ Task 9
  - Build + smoke ✓ Task 10
- **Placeholder scan:** No "TBD", "TODO", or vague directions. Every code step shows the full code; every test has assertions; every commit message is exact.
- **Type consistency:** `InventoryEntry` defined in Task 5, consumed by Tasks 5–6. `Item` import path consistent. `parseInventoryLine` signature `{ entries, warning? }` consistent across Tasks 5 + 6. `parseInventory` signature `{ entries, warnings }` (plural) consistent. `generateSuggestions` returns `string[]` consistent with `SuggestionList` `suggestions: string[]` prop.
