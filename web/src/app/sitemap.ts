import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { allItemSlugs } from "@/lib/data";

const SITE = "https://nodiatis-crafting.vercel.app";

// Build-time stamp: frozen at module load so all routes get the same lastModified
// across one deploy. This avoids per-request churn that triggers needless re-crawls.
const BUILD_TIME = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const now = BUILD_TIME;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/favorites`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE}/planner`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${SITE}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const itemRoutes: MetadataRoute.Sitemap = allItemSlugs().map((slug) => ({
    url: `${SITE}/items/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...itemRoutes];
}
