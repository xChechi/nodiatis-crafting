"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function ArmorLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "armor", label: "Armor" }}
      primary={{ title: "By slot", cards: subtypes, basePath: "/category/armor" }}
    />
  );
}
