"use client";

import { Bomb, Circle, Crown, Diamond, Flame, Gem, Heart, Repeat, SlidersHorizontal, Skull, Sparkles, Star, Zap } from "lucide-react";
import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

const EFFECT_SHORTCUTS = [
  { tag: "dd", label: "DD", icon: Zap },
  { tag: "aoe", label: "AoE", icon: Bomb },
  { tag: "dot", label: "DoT", icon: Flame },
  { tag: "aura", label: "Aura", icon: Sparkles },
  { tag: "heal", label: "Heal", icon: Heart },
  { tag: "debuff", label: "Debuff", icon: Skull },
  { tag: "recastable", label: "Recastable", icon: Repeat },
] as const;

const RARITY_SHORTCUTS = [
  { slug: "common", label: "Common", icon: Circle },
  { slug: "uncommon", label: "Uncommon", icon: Diamond },
  { slug: "rare", label: "Rare", icon: Star },
  { slug: "epic", label: "Epic", icon: Gem },
  { slug: "legendary", label: "Legendary", icon: Crown },
] as const;

interface Props {
  colors: SubtypeSummary[];
  effectCounts: Record<string, number>;
  rarityCounts: Record<string, number>;
  totalCount: number;
}

export function GemsLanding({ colors, effectCounts, rarityCounts, totalCount }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "gems", label: "Gems" }}
      primary={{ title: "By color", cards: colors, basePath: "/category/gems" }}
      shortcuts={[
        {
          title: "Browse & combine filters",
          cards: [
            {
              slug: "all",
              name: "All gems — filter by color + rarity + effect",
              href: "/category/gems/all",
              count: totalCount,
              icon: SlidersHorizontal,
            },
          ],
        },
        {
          title: "By effect",
          cards: EFFECT_SHORTCUTS.map((eff) => ({
            slug: eff.tag,
            name: eff.label,
            href: `/category/gems/effect/${eff.tag}`,
            count: effectCounts[eff.tag] ?? 0,
            icon: eff.icon,
          })),
        },
        {
          title: "By rarity",
          cards: RARITY_SHORTCUTS.filter((r) => (rarityCounts[r.slug] ?? 0) > 0).map((r) => ({
            slug: r.slug,
            name: r.label,
            href: `/category/gems/rarity/${r.slug}`,
            count: rarityCounts[r.slug] ?? 0,
            icon: r.icon,
          })),
        },
      ]}
    />
  );
}
