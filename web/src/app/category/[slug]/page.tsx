import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CATEGORIES, findCategoryBySlug } from "@/lib/categories";
import { allItems, allMaterialTypes } from "@/lib/data";
import { allArmorSubtypes, allOtherSubtypes, allWeaponSubtypes, allPotionSubtypes } from "@/lib/subtypes";
import { isUptierVariant } from "@/lib/uptier";
import { CategoryClient } from "./CategoryClient";
import { MaterialsLanding } from "../materials/MaterialsLanding";
import { ArmorLanding } from "../armor/ArmorLanding";
import { WeaponsLanding } from "../weapons/WeaponsLanding";
import { OtherLanding } from "../other/OtherLanding";
import { PotionsLanding } from "../potions/PotionsLanding";

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

  if (slug === "materials") {
    const summaries = allMaterialTypes();
    const tiered = summaries.filter((s) => s.tierRange !== null);
    const special = summaries.filter((s) => s.tierRange === null);
    return <MaterialsLanding tiered={tiered} special={special} />;
  }

  if (slug === "weapons") {
    const subtypes = allWeaponSubtypes();
    return <WeaponsLanding subtypes={subtypes} />;
  }

  if (slug === "armor") {
    const subtypes = allArmorSubtypes();
    return <ArmorLanding subtypes={subtypes} />;
  }

  if (slug === "other") {
    const subtypes = allOtherSubtypes();
    return <OtherLanding subtypes={subtypes} />;
  }

  if (slug === "potions") {
    const subtypes = allPotionSubtypes();
    return <PotionsLanding subtypes={subtypes} />;
  }

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
