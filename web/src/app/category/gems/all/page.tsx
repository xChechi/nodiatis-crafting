import { Suspense } from "react";
import { notFound } from "next/navigation";
import { findCategoryBySlug } from "@/lib/categories";
import { allItems } from "@/lib/data";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "@/app/category/[slug]/CategoryClient";

export const metadata = {
  title: "All Gems",
  description:
    "Browse every gem in one filterable list — combine color, rarity, effect, and level filters.",
  alternates: { canonical: "/category/gems/all" },
};

export default function AllGemsPage() {
  const cat = findCategoryBySlug("gems");
  if (!cat) notFound();

  const items = allItems().filter(
    (i) => cat.matches(i.Type) && !isUptierVariant(i.Name),
  );

  const catSerializable = { slug: cat.slug, label: cat.label, icon: cat.icon };

  return (
    <Suspense>
      <CategoryClient
        category={catSerializable}
        items={items}
        breadcrumbCrumbs={[
          { label: "Gems", href: "/category/gems" },
          { label: "All gems" },
        ]}
      />
    </Suspense>
  );
}
