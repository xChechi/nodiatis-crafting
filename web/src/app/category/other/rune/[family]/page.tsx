import { notFound } from "next/navigation";
import { Suspense } from "react";
import { allItems } from "@/lib/data";
import { findCategoryBySlug } from "@/lib/categories";
import { allRuneFamilies, runeFamilyOf } from "@/lib/subtypes";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "../../../[slug]/CategoryClient";

export function generateStaticParams() {
  return allRuneFamilies().map((s) => ({ family: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family } = await params;
  const summary = allRuneFamilies().find((s) => s.slug === family);
  if (!summary) return {};
  return {
    title: `${summary.name} — Runes`,
    description: `Browse all ${summary.count} ${summary.name} ranks.`,
    alternates: { canonical: `/category/other/rune/${family}` },
  };
}

export default async function RuneFamilyPage({
  params,
}: {
  params: Promise<{ family: string }>;
}) {
  const { family } = await params;
  const summary = allRuneFamilies().find((s) => s.slug === family);
  if (!summary) notFound();
  const cat = findCategoryBySlug("other");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) =>
      i.Type === "Rune" &&
      runeFamilyOf(i.Name) === summary.name &&
      !isUptierVariant(i.Name),
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={summary.name}
        breadcrumbCrumbs={[
          { label: "Other", href: "/category/other" },
          { label: "Rune", href: "/category/other/rune" },
          { label: summary.name },
        ]}
      />
    </Suspense>
  );
}
