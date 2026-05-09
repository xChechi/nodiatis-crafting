import { notFound } from "next/navigation";
import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import { gemIdentitiesByEffectTag } from "@/lib/subtypes";

const EFFECT_LABELS: Record<string, string> = {
  dd: "DD",
  aoe: "AoE",
  dot: "DoT",
  aura: "Aura",
  heal: "Heal",
  debuff: "Debuff",
  recastable: "Recastable",
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
  const cards = gemIdentitiesByEffectTag(tag);
  if (!label || !cards) return {};
  return {
    title: `${label} Gems`,
    description: `${cards.length} gem families tagged ${label}.`,
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
  const cards = gemIdentitiesByEffectTag(tag);
  if (!cards) notFound();

  return (
    <CategoryLanding
      category={{ slug: "gems", label: `${label} Gems` }}
      primary={{ title: "By gem", cards, basePath: "/category/gems" }}
      backHref="/category/gems"
      backLabel="Back to Gems"
    />
  );
}
