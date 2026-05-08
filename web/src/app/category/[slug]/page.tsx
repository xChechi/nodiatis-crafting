import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CATEGORIES, findCategoryBySlug } from "@/lib/categories";
import { allItems } from "@/lib/data";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "./CategoryClient";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const cat = findCategoryBySlug(slug);
    if (!cat) return { title: "Category not found" };
    return {
      title: cat.label,
      description: `Browse all ${cat.label.toLowerCase()} from the Nodiatis database.`,
    };
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = findCategoryBySlug(slug);
  if (!cat) notFound();

  // Drop uptier variants (}II{, }III{, ...) — only the }I{ base is a fresh
  // craft. Variants are surfaced on the base item's detail page instead.
  const items = allItems().filter(
    (i) => cat.matches(i.Type) && !isUptierVariant(i.Name),
  );

  // Strip the `matches` function before passing to a Client Component
  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient category={catSerializable} items={items} />
    </Suspense>
  );
}
