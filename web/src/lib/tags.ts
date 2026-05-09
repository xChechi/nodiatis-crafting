// Spell-mechanic tag extraction. Used at module init in data.ts to enrich
// each Item with a list of tags derived from its Description. The same rule
// set (kept in sync) is also used by build-search-index.mjs for the global
// search payload.
//
// Tags are deliberately broad — granular CC types (stun, blind, taunt, root,
// snare) all roll up to "debuff", and protective effects (shield, absorb,
// resist) all roll up to "buff". This keeps the chip list short and useful;
// users who want a specific keyword can still type it into the search box.

interface TagRule {
  tag: string;
  patterns: RegExp[];
}

export const TAG_RULES: ReadonlyArray<TagRule> = [
  // Direct damage (single hit)
  { tag: "dd", patterns: [/\bdd\b/i, /direct damage/i, /\bnuke\b/i] },
  // Area-of-effect — fires "to all enemies"
  { tag: "aoe", patterns: [/\ball enemies\b/i] },
  // Damage over time
  { tag: "dot", patterns: [/\bdot\b/i, /damage over time/i] },
  // Healing & restoration — folds in cure (removes negative effects) since
  // both are "good defensive things you cast on yourself / allies"
  {
    tag: "heal",
    patterns: [
      /\bheal(?:s|ing|er)?\b/i,
      /\bregen(?:eration)?\b/i,
      /hitpoint heal/i,
      /\bcure(?:s)?\b/i,
      /removes?[^.]*\bdot/i,
    ],
  },
  // Auras (passive area effects)
  { tag: "aura", patterns: [/\baura(?:s)?\b/i] },
  // Crowd-control / negative effects on target — folds in stun, blind, taunt,
  // root, snare, slow, weakness, listless, regen-reduction.
  {
    tag: "debuff",
    patterns: [
      /\bdebuff/i,
      /\btaunt\b/i,
      /forces[^.]*to target/i,
      /\bstun(?:s|ned)?\b/i,
      /\bblind(?:s|ness)?\b/i,
      /\broot(?:s|ed)?\b/i,
      /prevents?[^.]*escape/i,
      /immobiliz/i,
      /\bsnare(?:s|d)?\b/i,
      /\bslow(?:s|ed)?\b/i,
      /listless/i,
      /reduces?[^.]*regen/i,
      /weak(?:en|ness)/i,
    ],
  },
  // Positive enhancements — folds in shield, absorb, resist.
  {
    tag: "buff",
    patterns: [
      /\bbuff/i,
      /grants?[^.]*\bbonus/i,
      /increase(?:s|d)?[^.]*chance/i,
      /\babsorb(?:er|s)?\b/i,
      /damage absorber/i,
      /\bshield\b/i,
      /\bresistance\b/i,
      /\bresist(?:s|ant)?\b/i,
    ],
  },
  // Resource-specific
  { tag: "mana", patterns: [/\bmana\b/i] },
  { tag: "energy", patterns: [/\benergy\b/i] },
  // Context tags
  { tag: "arena", patterns: [/\barena\b/i] },
  { tag: "pvp", patterns: [/\bpvp\b/i, /\bplayer vs/i] },
  { tag: "xp", patterns: [/\bexp\b/i, /\bexperience\b/i, /\bxp\b/i] },
  { tag: "recastable", patterns: [/\brecastable\b/i] },
];

export function extractTags(
  description: string | null | undefined,
  name: string | null | undefined = "",
): string[] {
  if (!description && !name) return [];
  // Match against both name + description so items whose name carries the
  // semantic word (e.g. "Flame Call Aura") get tagged even when the
  // description doesn't repeat it.
  const text = `${name ?? ""}\n${description ?? ""}`;
  const out: string[] = [];
  for (const rule of TAG_RULES) {
    if (rule.patterns.some((p) => p.test(text))) out.push(rule.tag);
  }
  return out;
}
