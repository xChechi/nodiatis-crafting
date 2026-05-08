"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function WeaponsLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "weapons", label: "Weapons" }}
      primary={{ title: "By weapon type", cards: subtypes, basePath: "/category/weapons" }}
    />
  );
}
