import { Suspense } from "react";
import { PlannerClient } from "./PlannerClient";

const SITE = "https://nodiatis-crafting.vercel.app";

export const metadata = {
  title: "Planner",
  description:
    "Add Nodiatis items to a crafting planner and get a single aggregated shopping list of all base materials needed.",
  alternates: { canonical: "/planner" },
};

const plannerJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Nodiatis Crafting Planner",
  url: `${SITE}/planner`,
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  description:
    "Plan crafting projects across the Nodiatis recipe tree. Aggregates base materials, tracks unit prices, and produces a single shopping list.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function PlannerPage() {
  return (
    <Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(plannerJsonLd) }}
      />
      <PlannerClient />
    </Suspense>
  );
}
