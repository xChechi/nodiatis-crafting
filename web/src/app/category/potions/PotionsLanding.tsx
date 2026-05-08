"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function PotionsLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "potions", label: "Potions" }}
      primary={{ title: "By effect", cards: subtypes, basePath: "/category/potions" }}
    />
  );
}
