import type { Metadata } from "next";
import { allItems } from "@/lib/data";
import { getAllSlugsWithHistory } from "@/lib/marketHistory";
import { currentMarketPrice } from "@/lib/marketPrice";
import { MarketClient, type MarketRow } from "./MarketClient";

export const metadata: Metadata = {
  title: "Market — Nodiatis Crafting",
  description:
    "Live in-game market ask prices across materials, with monthly history.",
  alternates: { canonical: "/market" },
};

function buildRows(): MarketRow[] {
  const slugsWithHistory = new Set(getAllSlugsWithHistory());
  return allItems()
    .filter((i) => slugsWithHistory.has(i.slug))
    .map((i) => {
      const history = i.MarketHistory ?? [];
      const current = currentMarketPrice(i);
      const previous = history.length >= 2 ? history[1] : null;
      const changePct =
        previous && previous > 0 ? ((current - previous) / previous) * 100 : null;
      return {
        slug: i.slug,
        name: i.Name,
        type: i.Type,
        tier: i.tier,
        imageUrl: i.imageUrl,
        current,
        history,
        changePct,
      };
    });
}

export default function MarketPage() {
  const rows = buildRows();
  return (
    <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
      <h1 className="text-2xl font-semibold mb-1 text-[var(--color-fg-1)]">Market</h1>
      <p className="text-sm text-[var(--color-fg-3)] mb-6">
        Latest in-game ask prices captured monthly. Click an item for the full
        history chart.
      </p>
      <MarketClient rows={rows} />
    </main>
  );
}
