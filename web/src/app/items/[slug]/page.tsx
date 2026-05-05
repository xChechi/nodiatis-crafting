import { notFound } from "next/navigation";
import { allItemSlugs, getItemBySlug } from "@/lib/data";
import { ItemDetailClient } from "./ItemDetailClient";

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
    description: item.Description ?? `${item.Name} — ${item.Type}, level ${item.Level ?? "?"}`,
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
  return <ItemDetailClient item={item} />;
}
