import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allArmorSubtypes, typeParensSubtype } from "@/lib/subtypes";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allArmorSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allArmorSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Armor`,
    description: `Browse all ${summary.count} ${summary.name} items.`,
  };
}

export default async function ArmorSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allArmorSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("armor");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      (i.Type.startsWith("Armor") || i.Type === "Shield") &&
      typeParensSubtype(i.Type) === summary.name,
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
