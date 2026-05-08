import { Suspense } from "react";
import { notFound } from "next/navigation";
import { allItems, allMaterialTypes } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { parseMaterialType } from "@/lib/materials";
import { CategoryClient } from "../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allMaterialTypes().map((t) => ({ type: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const summary = allMaterialTypes().find((t) => t.slug === type);
  if (!summary) return {};
  return {
    title: `${summary.name} — Materials`,
    description: `Browse all ${summary.count} ${summary.name} materials.`,
  };
}

export default async function MaterialTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const summary = allMaterialTypes().find((t) => t.slug === type);
  if (!summary) notFound();

  const cat = findCategoryBySlug("materials");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      i.Type.startsWith("Resource ") &&
      parseMaterialType(i.Type).name === summary.name,
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
