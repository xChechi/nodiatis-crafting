import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allWeaponSubtypes, typeParensSubtype } from "@/lib/subtypes";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allWeaponSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allWeaponSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Weapons`,
    description: `Browse all ${summary.count} ${summary.name} weapons.`,
    alternates: { canonical: `/category/weapons/${subtype}` },
  };
}

export default async function WeaponSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allWeaponSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("weapons");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      (i.Type.startsWith("Weapon") || i.Type.startsWith("Archery")) &&
      typeParensSubtype(i.Type) === summary.name &&
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
