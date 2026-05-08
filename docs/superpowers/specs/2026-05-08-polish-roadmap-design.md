# Polish & Ship-Readiness Roadmap

**Date:** 2026-05-08
**Goal:** Final polish sweep before soft launch (no fixed date). Move from "feature-complete" to "I'd be proud to share this in the Nodiatis community."
**Approach:** Layered — five themed work batches, each a focused session that ends in a shippable state. Order is sequenced so each layer's output is input to the next.

---

## Layer 1 — Reliability

The "what happens when something goes wrong" layer. Catch failures, recover from them, see them.

| ID | Task | Notes |
|----|------|-------|
| R1 | Wire error tracking | Sentry free tier OR a minimal `/api/errors` log endpoint. Captures client-side errors that currently disappear into the void. |
| R2 | Polish `error.tsx` global boundary | Friendly message, retry button, link home. Currently the Next.js default. |
| R3 | Polish `not-found.tsx` | Same treatment, plus search box so users land somewhere useful. |
| R4 | Audit server-action failure UX | Craftable + Planner currently `console.error` and either toast or set warnings. Walk every path: what does the user see when the network drops mid-action? |

---

## Layer 2 — Performance & Bundle

| ID | Task | Notes |
|----|------|-------|
| P1 | Refactor `parseInventory` + `generateSuggestions` to `clientIndex.json` | This is the actual ~3.5 MB bundle drop the audit T1 estimated but didn't fully realize. The recipe DB still leaks into Craftable's client bundle via `data.ts → allItems()` calls in `inventory.ts`. |
| P2 | Lighthouse pass on key routes | Home / Category / Item / Planner / Craftable. Capture before+after Performance / A11y / Best Practices / SEO scores in this spec. |
| P3 | Decide image strategy and implement | Currently every `<Image>` is `unoptimized`. Decide: Vercel image optimization on, or roll our own with build-time WebP variants. |
| P4 | CLS audit on item detail | Uptier siblings + crafting tree expand/collapse are likely shifters. |

---

## Layer 3 — Content & Empty States

The "would I be embarrassed if a stranger landed here" layer.

| ID | Task | Notes |
|----|------|-------|
| C1 | Write real `/about` content | What is this, who made it, link to upstream tools.nodiatis.com, license/disclaimer. |
| C2 | Add site-wide footer | Attribution, source-code link, "fan-made, not affiliated with Nodiatis" disclaimer, last-data-refresh timestamp. |
| C3 | Homepage hero/tagline pass | Two-line tagline so first-time visitors know what this is at a glance. |
| C4 | Category page zero-results state | When filters exclude everything, the user shouldn't stare at an empty void. |
| C6 | Repo-root `README.md` | Purpose, dev setup, deploy steps, data refresh process. |
| C7 | LICENSE file | MIT for code; attribution note for the data layer. |
| C8 | Print stylesheet for planner shopping list | Players actually print these. |

(IDs C5 was cut during brainstorming — first-visit Craftable hint was redundant with the existing placeholder text.)

---

## Layer 4 — SEO & Meta

The things crawlers and link-previewers check, not just users.

| ID | Task | Notes |
|----|------|-------|
| S1 | Per-route metadata audit | Every route under `/app` should have `generateMetadata` or static `metadata`. Diff what's missing. |
| S2 | OG image coverage for category + material-type pages | Currently only `/items/*` has OG generation via `/api/og/items/[slug]`. |
| S3 | Canonical URLs on all routes | `alternates.canonical` everywhere — important for items with rank/uptier siblings to avoid duplicate-content flags. |
| S4 | Breadcrumb JSON-LD on item detail | Currently only category has it (via T15). |
| S5 | Favicon set + apple-touch-icon + manifest.json | PWA minimum: name, icons, theme color. |

(IDs S6 was cut during brainstorming — split sitemaps are premature for current URL count.)

---

## Layer 5 — Pre-launch Checklist

| ID | Task | Notes |
|----|------|-------|
| L1 | Cross-browser smoke test | Chrome / Firefox / Safari / Mobile Safari / Mobile Chrome / Edge. Document any per-browser quirks. |
| L2 | Mobile QA pass at 375px (iPhone SE width) | Likely-touch areas: planner shopping list, category filters drawer, crafting tree indentation. |
| L3 | Light-theme parity check | Verify every component renders correctly in both themes. |
| L4 | Privacy-respecting analytics | Plausible or Vercel Analytics. Goal: know which routes get traffic and where users drop off. No cookies, no consent banner needed. |
| L5 | Playwright E2E smoke test | One happy path: home → category → item → add to planner → planner shopping list. Catches future regressions. |
| L6 | Pre-launch dry run | Share the URL with one friendly tester, watch them use it, fix what they trip on. |

---

## Total scope

25 items. Each layer is independent — soft-launchable after any layer. Estimated 4-6 working sessions to land everything.

## What's deliberately not in scope

- **Data quality / coverage work** (drop locations, NPC merchants, missing items) — that's a separate "Reach & SEO" or "Data quality" track.
- **Game-mechanic depth** (character builder, virtues calc, equipment loadouts) — separate "Depth & retention" track.
- **Internationalization** — English-only stays the right call until traffic justifies it.
- **Bundle-size CI budget script** — overkill for a solo soft launch; cut during brainstorming.
- **Sitemap URL splitting** — premature; current URL count fits one sitemap fine.
