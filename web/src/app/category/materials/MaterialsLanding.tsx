"use client";

import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import type { MaterialTypeSummary } from "@/lib/materials";
import type { SubtypeSummary } from "@/lib/subtypes";

interface Props {
  tiered: MaterialTypeSummary[];
  special: MaterialTypeSummary[];
}

function toSubtype(s: MaterialTypeSummary): SubtypeSummary {
  return { name: s.name, slug: s.slug, count: s.count, imageUrl: s.imageUrl };
}

export function MaterialsLanding({ tiered, special }: Props) {
  return (
    <CategoryLanding
      category={{ slug: "materials", label: "Materials" }}
      primary={{
        title: "Tiered (T1–T30)",
        cards: tiered.map(toSubtype),
        basePath: "/category/materials",
      }}
      special={{
        title: "Special",
        cards: special.map(toSubtype),
        basePath: "/category/materials",
      }}
    />
  );
}
