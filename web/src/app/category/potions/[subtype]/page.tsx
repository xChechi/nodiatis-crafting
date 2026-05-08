import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allPotionSubtypes, potionSubtypeOf } from "@/lib/subtypes";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allPotionSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allPotionSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Potions`,
    description: `Browse all ${summary.count} ${summary.name} potions.`,
    alternates: { canonical: `/category/potions/${subtype}` },
  };
}

export default async function PotionSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allPotionSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("potions");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      i.Type === "Potion" &&
      potionSubtypeOf(i.Name) === summary.name &&
      !isUptierVariant(i.Name),
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
      />
    </Suspense>
  );
}
