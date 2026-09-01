import { notFound } from "next/navigation";
import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import { GEM_RARITY_SLUGS, gemIdentitiesByRarity } from "@/lib/subtypes";

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function generateStaticParams() {
  return GEM_RARITY_SLUGS.map((rarity) => ({ rarity }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ rarity: string }>;
}) {
  const { rarity } = await params;
  const label = RARITY_LABELS[rarity];
  const cards = gemIdentitiesByRarity(rarity);
  if (!label || !cards) return {};
  return {
    title: `${label} Gems`,
    description: `${cards.length} ${label.toLowerCase()} gem families.`,
    alternates: { canonical: `/category/gems/rarity/${rarity}` },
  };
}

export default async function GemsByRarityPage({
  params,
}: {
  params: Promise<{ rarity: string }>;
}) {
  const { rarity } = await params;
  const label = RARITY_LABELS[rarity];
  if (!label) notFound();
  const cards = gemIdentitiesByRarity(rarity);
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
