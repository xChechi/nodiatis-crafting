# Craftable parser — semantic shorthand + fuzzy + typeahead

**Date:** 2026-05-08
**Status:** Design approved, ready for implementation plan
**Scope:** Replace the exact-name `parseInventory` in `CraftableClient.tsx` with a layered resolver that recognises material-tier shorthand, tier ranges, gem color shorthand, and fuzzy-matches typos. Add a typeahead suggestion dropdown below the inventory textarea. Recipe-matching gains an "unbounded" qty mode.

## Context

The current Craftable parser (`CraftableClient.tsx::parseInventory`) splits the textarea on commas/newlines, extracts `name + qty` via three regex patterns, then looks up the item with `getItemByName(name)` — exact match. Stefan typed `6 t30 dyes` and `t30 dust` and both failed: `t30 dyes` is not a literal item name (the actual T30 Dye item has a specific name), and `t30 dust` was rejected for not having a qty.

The page exists to answer "what can I craft from my inventory?" — a sufficiency check across all recipes. With shorthand and fuzzy matching, the user can type fast and still get accurate matches. With "unbounded" entries (no qty given), the page also answers a softer question: "what recipes use these mats at all?"

## Decisions

Locked during brainstorming:

1. **Material-tier shorthand only for materials** — `T30 dye`, `tier 5 bone`, `t1 ore`, etc. No bare-number shorthand (`30 dye` stays unrecognised). Plural `s` is stripped.
2. **Multi-tier ranges** — `t1-30 dye` expands to 30 entries (one per tier). Qty replicates per tier.
3. **Gem color shorthand** — `red t5 gem`, `black gem` (no rank → all ranks of that color). Returns multiple entries (one per gem identity in the matching color/rank).
4. **Fuzzy fallback via fuse.js** — typos and partial names. **Auto-pick top result silently** — no disambiguation prompt, faster UX, accept the small risk of mis-matches when typos are wild.
5. **No qty = unbounded** — entry counts as "I have enough". Recipe matching ignores it as a constraint; canCraft displays as `∞` if all required mats are unbounded.
6. **Typeahead dropdown below the textarea, full-width** — operates on the last (active) line; arrow keys + Enter to accept; click to replace line.

## Resolution strategy

For each non-empty line in the textarea, after extracting optional qty:

| # | Strategy | Example | Output |
|---|---|---|---|
| 1 | Exact name match | `Mongoose Leg Bone` | 1 entry |
| 2 | Material-tier shorthand | `t30 dye`, `dye t30`, `tier 5 ore` | 1 entry |
| 3 | Tier-range shorthand | `t1-30 dye` | 30 entries |
| 4 | Gem color shorthand | `red t5 gem`, `black gem` | N entries |
| 5 | Fuzzy fallback (fuse.js) | `Mongoose leg boen` (typo) | 1 entry (top match) |
| — | Unrecognised | `garblegarble` | warning, 0 entries |

Strategies are tried in order. First success wins.

## Parser details

### Patterns

- Tier: `^[Tt](\d+)$` or `^[Tt]ier\s+(\d+)$`
- Tier range: `^[Tt](\d+)-(\d+)$` or `^[Tt]ier\s+(\d+)-(\d+)$`
- Plural strip: trailing `s` removed if removing it produces a known type name.
- Word order: shorthand accepted in either order — `t30 dye` and `dye t30` both resolve.

### Tiered material types (22)

`Bone, Cloth, Dust, Dye, Fish, Geode, Ingot, Leather, Oil, Ore, Plank, Plant, Prey, Resin, Rodent, Scale, Silk, Sinew, Skin, Thread, Vegetable, Wood`. Source: `allMaterialTypes()` from `lib/data.ts`. Match is case-insensitive, longest match wins, plural-tolerant.

### Gem colors (6)

`Black, Blue, Green, Grey, Red, White`. Color names are reserved tokens — they may appear before or after the rank shorthand. `red gem` (no rank) returns one entry per gem identity in the red collection across all ranks. `red t5 gem` returns one entry per red gem identity at rank 5.

### Fuzzy threshold

Use the existing `searchIndex` (loaded in `GlobalSearch.tsx`) — same fuse.js index, same threshold (`0.35`). The fuzzy resolver imports the index data, builds its own Fuse instance with `keys: ["name"]` only (no type/tag weighting needed for inventory parsing). Top result above threshold is accepted; below threshold → unrecognised warning.

### `parseInventory` orchestrator

Returns `{ entries: InventoryEntry[]; warnings: string[] }`. The new `InventoryEntry` shape:

```ts
interface InventoryEntry {
  name: string;        // canonical item name
  qty: number;         // Infinity for unbounded
}
```

Multiple lines targeting the same item merge: take the **max** of their qtys (so `t1 dye, 5 t1 dye` → 5; `t1 dye, t1 dye` → ∞).

## Recipe matching changes

`evaluateRecipe` is updated to read inventory as `Map<string, number>` where some values may be `Infinity`:

- Mat covered when `inventory.get(mat.name) >= mat.qty`. `Infinity >= n` is `true`.
- `canCraft` calculation: skip mats whose inventory is `Infinity` (don't constrain). If all required mats are unbounded, `canCraft = Infinity` — UI displays `∞`.

## Typeahead UI

### Suggestion source

For the **active line** (the line containing the cursor, or the last line if cursor is at the end), generate up to 5 suggestions. The active line is parsed via the same orchestrator above, but instead of resolving to entries, the orchestrator's intermediate stages emit *suggestion candidates*:

| Active text | Top suggestions (synthesized labels) |
|---|---|
| `t30 d` | `T30 Dust`, `T30 Dye` |
| `tier 5` | `T5 Bone`, `T5 Cloth`, `T5 Dust`, `T5 Dye`, `T5 Fish` |
| `red gem` | `Red Gem (all ranks)`, `Red T1 gem`, `Red T2 gem`, … |
| `bone sw` | `Bone Sword` (fuzzy literal match) |
| `mongoose` | `Mongoose Leg Bone` (literal match) |

Each suggestion is a string the user can accept to replace the active line.

### Component

`SuggestionList.tsx` — controlled by parent. Props: `suggestions: string[]; activeIndex: number; onSelect(s: string); onDismiss()`. Renders a `<ul>` directly below the textarea, full-width, max-height ~10rem with overflow-auto. Each row shows the suggestion text and (where appropriate) a small badge for the resolved canonical item count (`"2 items"` for tier ranges, `"all ranks"` for color-only).

### Keyboard

Inside the textarea:
- `↓` / `↑` — move active suggestion (when list is visible). Otherwise default cursor behaviour.
- `Enter` (when list is visible) — accept active suggestion, replace the current line. **Without** dismissing the textarea (insert a newline at the end of the replaced line so the user can continue).
- `Escape` — dismiss list (line stays as typed).
- `Tab` — accept active suggestion (same as Enter, but no newline insertion).

### When the list is hidden

- Active line is empty.
- Active line was just accepted (until next keystroke).
- Last keystroke was Enter → newline (cursor on a fresh line with no chars yet).

## Architecture / files

| File | New / Modify | Purpose |
|---|---|---|
| `web/src/lib/inventory.ts` | **New** | Pure resolver: orchestrator + per-strategy helpers + suggestion generator |
| `web/src/lib/inventory.test.ts` | **New** | Unit tests for every strategy, edge cases, and suggestion generation |
| `web/src/app/craftable/CraftableClient.tsx` | Modify | Replaces inline `parseInventory`; adds typeahead state + key handler; renders `<SuggestionList>` |
| `web/src/app/craftable/SuggestionList.tsx` | **New** | Presentational dropdown component |

## Edge cases

- **Mixed shorthand and exact**: `6 t30 dyes, Mongoose Leg Bone: 12, Bone t1` — three lines, three different strategies, all succeed.
- **Range with qty**: `60 t1-30 dye` → 30 entries × qty 60 each. Realistic? User probably means "I have 60 of each tier". If not, they can split into individual lines.
- **Plural ambiguity**: `oils` → strip `s` → `oil` → tier required → fails alone. With tier: `t1 oils` → strip plural → "t1 oil" → match.
- **Unknown shorthand component**: `t30 unobtainium` → tier valid, type unknown → falls through to fuzzy → most likely no match → warning.
- **Multiple entries from one line**: a tier range `t1-30 dye` produces 30 inventory entries. The merge step deduplicates only when same canonical item name appears multiple times across DIFFERENT lines, so range-output entries stay distinct.
- **Conflicting qty on same item**: `t30 dye, t30 dye: 5` → first line is unbounded, second is qty 5. Merge takes max → unbounded (`Infinity > 5`). Documented in the merge rule.
- **Gem color with no rank**: `red gem` → all red gem items, all unbounded. Recipe matching uses canonical-name-keyed `Map`; each item is a separate entry.

## Testing

Unit tests in `inventory.test.ts`:
- Each parser strategy: 2-3 cases each (positive + edge).
- Plural stripping correctness.
- Tier range expansion (boundary T1-T30, single tier T15-T15, invalid T30-T1).
- Gem color shorthand: with rank, without rank, unknown color.
- Fuzzy fallback: known typo above threshold, garbage below threshold.
- Merge rule: max qty wins, unbounded beats finite.
- Suggestion generation: returns ≤5 candidates per active query, ordered by parser-strategy precedence.

No component tests for `SuggestionList` (project has no React Testing Library). Smoke-tested via dev server at end of plan.

## Out of scope

- Disambiguation prompts when fuzzy matches multiple close candidates — auto-pick top, accept the small risk.
- Auto-suggest within suggestion list (suggestions only flow from typed input).
- Persisting the textarea content to localStorage across sessions.
- Sharing the inventory via URL.
- Inline suggestions while typing inside the textarea (cursor-anchored popup) — too fiddly for an MVP.
- Splitting the textarea into one-input-per-row.
- Recipe pages displaying the same shorthand back to the user.
