import { notFound } from "next/navigation";
import {
  allItemSlugs,
  getItemByName,
  getItemBySlug,
  getRankSeries,
  getUptierChain,
} from "@/lib/data";
import { getRankNumber, getUptierRoman, romanToInt } from "@/lib/uptier";
import { buildCraftingTree, buildFinishedTree } from "@/lib/craftingTree";
import { categoryForType } from "@/lib/categories";
import type { Item } from "@/lib/types";
import {
  ItemDetailClient,
  type RankSibling,
  type UptierSibling,
} from "./ItemDetailClient";

/** Sum buyable gold cost for the base-mats layer. Returns 0 if no recipe. */
function computeBaseMatsCost(item: Item): number {
  if (!item.recipe) return 0;
  let total = 0;
  for (const mat of item.recipe.finished) {
    const matItem = getItemByName(mat.name);
    const unit = matItem?.Cost ?? 0;
    if (unit > 0) total += unit * mat.qty;
  }
  return total;
}

const SITE = "https://nodiatis-crafting.vercel.app";

export function generateStaticParams() {
  return allItemSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (!item) return { title: "Item not found" };
  return {
    title: item.Name,
    description:
      item.Description ?? `${item.Name} — ${item.Type}, level ${item.Level ?? "?"}`,
    alternates: { canonical: `/items/${slug}` },
    openGraph: {
      title: item.Name,
      description:
        item.Description ?? `${item.Name} — ${item.Type}, level ${item.Level ?? "?"}`,
      images: [
        {
          url: `${SITE}/api/og/items/${slug}`,
          width: 1200,
          height: 630,
          alt: item.Name,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: item.Name,
      description:
        item.Description ?? `${item.Name} — ${item.Type}, level ${item.Level ?? "?"}`,
      images: [`${SITE}/api/og/items/${slug}`],
    },
  };
}

function buildJsonLd(item: Item) {
  const additionalProperty: Array<{ "@type": "PropertyValue"; name: string; value: string | number }> = [];
  if (item.Type) additionalProperty.push({ "@type": "PropertyValue", name: "Type", value: item.Type });
  if (item.rarityLabel) additionalProperty.push({ "@type": "PropertyValue", name: "Rarity", value: item.rarityLabel });
  if (item.Level) additionalProperty.push({ "@type": "PropertyValue", name: "Level", value: item.Level });
  if (item.tier !== null) additionalProperty.push({ "@type": "PropertyValue", name: "Tier", value: item.tier });
  if (item.Damage) additionalProperty.push({ "@type": "PropertyValue", name: "Damage", value: item.Damage });
  if (item.ArmorClass) additionalProperty.push({ "@type": "PropertyValue", name: "Armor Class", value: item.ArmorClass });
  if (item.Energy) additionalProperty.push({ "@type": "PropertyValue", name: "Energy", value: item.Energy });
  if (item.Mana) additionalProperty.push({ "@type": "PropertyValue", name: "Mana", value: item.Mana });
  if (item.Weight) additionalProperty.push({ "@type": "PropertyValue", name: "Weight", value: item.Weight });
  if (item.Prereq && item.Prereq !== "None") additionalProperty.push({ "@type": "PropertyValue", name: "Prereq", value: item.Prereq });

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: item.Name,
    description:
      item.Description ?? `${item.Name} — ${item.Type}, level ${item.Level ?? "?"}`,
    image: item.imageUrl ? `${SITE}${item.imageUrl}` : undefined,
    category: item.Type,
    sku: item.slug,
    url: `${SITE}/items/${item.slug}`,
    additionalProperty,
    ...(item.Cost && item.Cost > 0
      ? {
          offers: {
            "@type": "Offer",
            price: item.Cost,
            priceCurrency: "XGP", // Nodiatis in-game gold — non-real currency
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getItemBySlug(slug);
  if (!item) notFound();

  const jsonLd = buildJsonLd(item);
  const cat = categoryForType(item.Type);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "All categories",
        item: `${SITE}/`,
      },
      ...(cat
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: cat.label,
              item: `${SITE}/category/${cat.slug}`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: item.Name,
              item: `${SITE}/items/${item.slug}`,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 2,
              name: item.Name,
              item: `${SITE}/items/${item.slug}`,
            },
          ]),
    ],
  };

  // Compute uptier siblings server-side (full data is here; client only
  // needs the slim display info).
  const siblings: UptierSibling[] = getUptierChain(item)
    .map((s) => {
      const roman = getUptierRoman(s.Name) ?? "";
      return {
        slug: s.slug,
        name: s.Name,
        roman,
        rank: romanToInt(roman),
        rarityLabel: s.rarityLabel,
        level: s.Level ?? 0,
        stats: s.Stats ?? null,
        description: s.Description ?? null,
        armorClass: s.ArmorClass ?? null,
        damage: s.Damage ?? null,
        cost: s.Cost ?? 0,
      };
    })
    .sort((a, b) => a.rank - b.rank);

  // Rank-N siblings (Allevium Rank 1 / Rank 2 / ...)
  const rankSiblings: RankSibling[] = getRankSeries(item)
    .map((s) => ({
      slug: s.slug,
      name: s.Name,
      rank: getRankNumber(s.Name) ?? 0,
      rarityLabel: s.rarityLabel,
      level: s.Level ?? 0,
      stats: s.Stats ?? null,
      description: s.Description ?? null,
      cost: s.Cost ?? 0,
      hasRecipe: s.recipe !== null,
    }))
    .sort((a, b) => a.rank - b.rank);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ItemDetailClient
        item={item}
        uptierSiblings={siblings}
        rankSiblings={rankSiblings}
        baseMatsCost={computeBaseMatsCost(item)}
        craftingTree={buildCraftingTree(item)}
        finishedTree={buildFinishedTree(item)}
      />
    </>
  );
}
