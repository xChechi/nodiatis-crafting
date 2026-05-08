"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  subtypes: SubtypeSummary[];
}

export function OtherLanding({ subtypes }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "other", label: "Other" }}
      primary={{ title: "By kind", cards: subtypes, basePath: "/category/other" }}
    />
  );
}
