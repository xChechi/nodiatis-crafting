import { CategoryLanding } from "@/app/_landings/CategoryLanding";
import { allRuneFamilies } from "@/lib/subtypes";

export const metadata = {
  title: "Runes — Other",
  description: "Browse all rune families.",
  alternates: { canonical: "/category/other/rune" },
};

export default function RuneFamiliesPage() {
  const families = allRuneFamilies();
  return (
    <CategoryLanding
      category={{ slug: "rune", label: "Runes" }}
      primary={{ title: "By family", cards: families, basePath: "/category/other/rune" }}
      backHref="/category/other"
      backLabel="Back to Other"
    />
  );
}
