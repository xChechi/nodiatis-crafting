import { Suspense } from "react";
import { notFound } from "next/navigation";
import { allItems, allMaterialTypes } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { parseMaterialType } from "@/lib/materials";
import { CategoryClient } from "../../[slug]/CategoryClient";
import { TierCostSparkline } from "@/components/TierCostSparkline";
import type { Item } from "@/lib/types";

function buildTierCostPoints(items: Item[]): Array<{ tier: number; cost: number }> {
  const byTier = new Map<number, number>();
  for (const item of items) {
    if (item.tier === null) continue;
    if (!item.Cost || item.Cost <= 0) continue;
    if (!byTier.has(item.tier)) byTier.set(item.tier, item.Cost);
  }
  return Array.from(byTier.entries())
    .map(([tier, cost]) => ({ tier, cost }))
    .sort((a, b) => a.tier - b.tier);
}

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
    alternates: { canonical: `/category/materials/${type}` },
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
  const tierPoints = buildTierCostPoints(items);

  return (
    <Suspense>
      {tierPoints.length >= 2 && (
        <div className="max-w-7xl mx-auto px-6 pt-6 -mb-2">
          <TierCostSparkline points={tierPoints} materialName={summary.name} />
        </div>
      )}
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
      />
    </Suspense>
  );
}
