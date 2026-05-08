import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allOtherSubtypes, typeParensSubtype } from "@/lib/subtypes";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allOtherSubtypes().map((s) => ({ subtype: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allOtherSubtypes().find((s) => s.slug === subtype);
  if (!summary) return {};
  return {
    title: `${summary.name} — Other`,
    description: `Browse all ${summary.count} ${summary.name} items.`,
  };
}

export default async function OtherSubtypePage({
  params,
}: {
  params: Promise<{ subtype: string }>;
}) {
  const { subtype } = await params;
  const summary = allOtherSubtypes().find((s) => s.slug === subtype);
  if (!summary) notFound();
  const cat = findCategoryBySlug("other");
  if (!cat) notFound();

  // Reuse the category's matches function (it already encodes the inverse-of-other-7 logic)
  const items = allItems().filter(
    (i) => cat.matches(i.Type) && typeParensSubtype(i.Type) === summary.name,
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
