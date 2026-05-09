"use client";

import { Bomb, Flame, Heart, Repeat, Skull, Sparkles, Zap } from "lucide-react";
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

interface Props {
  colors: SubtypeSummary[];
  effectCounts: Record<string, number>;
}

export function GemsLanding({ colors, effectCounts }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "gems", label: "Gems" }}
      primary={{ title: "By color", cards: colors, basePath: "/category/gems" }}
      shortcuts={{
        title: "By effect",
        cards: EFFECT_SHORTCUTS.map((eff) => ({
          slug: eff.tag,
          name: eff.label,
          href: `/category/gems/effect/${eff.tag}`,
          count: effectCounts[eff.tag] ?? 0,
          icon: eff.icon,
        })),
      }}
    />
  );
}
