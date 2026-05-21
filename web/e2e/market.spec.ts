import { test, expect } from "@playwright/test";

test("market page lists the seeded geodes and links to detail", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: "Market" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Diamond Geode/ })).toBeVisible();
  await expect(page.getByText("30,577")).toBeVisible();
});

test("item detail page shows price history for a seeded item", async ({ page }) => {
  await page.goto("/items/diamond-geode");
  await expect(page.getByRole("heading", { name: "Price history" })).toBeVisible();
});

test("item detail page omits price history for an item without market data", async ({ page }) => {
  // aliangel-armor-essence is a real material with no MarketHistory data
  await page.goto("/items/aliangel-armor-essence");
  await expect(page.getByRole("heading", { name: "Price history" })).not.toBeVisible();
});
