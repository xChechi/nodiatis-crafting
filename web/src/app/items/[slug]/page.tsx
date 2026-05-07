import { notFound } from "next/navigation";
import { allItemSlugs, getItemBySlug } from "@/lib/data";
import type { Item } from "@/lib/types";
import { ItemDetailClient } from "./ItemDetailClient";

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
    openGraph: {
      title: item.Name,
      description:
        item.Description ?? `${item.Name} — ${item.Type}, level ${item.Level ?? "?"}`,
      images: [
        {
          url: `/api/og/items/${slug}`,
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
      images: [`/api/og/items/${slug}`],
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ItemDetailClient item={item} />
    </>
  );
}
