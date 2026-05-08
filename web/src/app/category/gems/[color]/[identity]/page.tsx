import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allGemColors, gemIdentitiesForColor } from "@/lib/subtypes";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "../../../[slug]/CategoryClient";

export function generateStaticParams() {
  const params: { color: string; identity: string }[] = [];
  for (const color of allGemColors()) {
    const identities = gemIdentitiesForColor(color.slug) ?? [];
    for (const id of identities) {
      params.push({ color: color.slug, identity: id.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ color: string; identity: string }>;
}) {
  const { color, identity } = await params;
  const colorSummary = allGemColors().find((c) => c.slug === color);
  const idSummary = colorSummary
    ? gemIdentitiesForColor(color)?.find((i) => i.slug === identity)
    : undefined;
  if (!colorSummary || !idSummary) return {};
  return {
    title: `${idSummary.name} — ${colorSummary.name} Gems`,
    description: `All ${idSummary.count} ranks of ${idSummary.name}.`,
    alternates: { canonical: `/category/gems/${color}/${identity}` },
  };
}

export default async function GemIdentityPage({
  params,
}: {
  params: Promise<{ color: string; identity: string }>;
}) {
  const { color, identity } = await params;
  const colorSummary = allGemColors().find((c) => c.slug === color);
  if (!colorSummary) notFound();
  const idList = gemIdentitiesForColor(color);
  if (!idList) notFound();
  const idSummary = idList.find((i) => i.slug === identity);
  if (!idSummary) notFound();

  const cat = findCategoryBySlug("gems");
  if (!cat) notFound();

  // Items: same gem identity (name-without-rank) and same color.
  const items = allItems().filter(
    (i) =>
      i.Type === `Gem (${colorSummary.name})` &&
      i.Name.replace(/\s+Rank\s+\d+$/i, "").trim() === idSummary.name &&
      !isUptierVariant(i.Name),
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={idSummary.name}
        breadcrumbCrumbs={[
          { label: "Gems", href: "/category/gems" },
          { label: colorSummary.name, href: `/category/gems/${color}` },
          { label: idSummary.name },
        ]}
      />
    </Suspense>
  );
}
