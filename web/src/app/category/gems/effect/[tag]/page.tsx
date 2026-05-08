import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findCategoryBySlug } from "@/lib/categories";
import { gemsByEffectTag } from "@/lib/subtypes";
import { CategoryClient } from "../../../[slug]/CategoryClient";

const EFFECT_LABELS: Record<string, string> = {
  dd: "DD",
  dot: "DoT",
  aura: "Aura",
  heal: "Heal",
  debuff: "Debuff",
};

export function generateStaticParams() {
  return Object.keys(EFFECT_LABELS).map((tag) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const label = EFFECT_LABELS[tag];
  const items = gemsByEffectTag(tag);
  if (!label || !items) return {};
  return {
    title: `${label} Gems`,
    description: `${items.length} gems tagged ${label}.`,
    alternates: { canonical: `/category/gems/effect/${tag}` },
  };
}

export default async function GemsByEffectPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const label = EFFECT_LABELS[tag];
  if (!label) notFound();
  const items = gemsByEffectTag(tag);
  if (!items) notFound();

  const cat = findCategoryBySlug("gems");
  if (!cat) notFound();

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        lockedSubtype={label}
        breadcrumbCrumbs={[
          { label: "Gems", href: "/category/gems" },
          { label: "Effect" },
          { label },
        ]}
      />
    </Suspense>
  );
}
