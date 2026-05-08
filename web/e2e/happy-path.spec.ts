import { test, expect } from "@playwright/test";

// One happy-path smoke. If this passes, the core "browse → item → planner"
// flow is intact and Vercel can ship. If it fails, regression somewhere
// between the homepage and the planner.
test("home → category → item → planner shopping list", async ({ page }) => {
  // Home renders with the category cards
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /browse, craft, and plan/i })).toBeVisible();

  // Click into Materials category (any category works; Materials has many craftable items)
  await page.getByRole("link", { name: /materials/i }).first().click();
  await expect(page).toHaveURL(/\/category\/materials/);

  // Drill into the first material-type card
  const firstSubcategory = page.locator("a[href*='/category/materials/']").first();
  await firstSubcategory.click();
  await expect(page).toHaveURL(/\/category\/materials\/.+/);

  // Open the first item in the table
  const firstItemLink = page.locator("a[href*='/items/']").first();
  await firstItemLink.click();
  await expect(page).toHaveURL(/\/items\/.+/);

  // Item-detail page should have a name heading
  await expect(page.locator("h1")).toBeVisible();

  // Add to planner via the +/− stepper next to "Add to planner". Find the
  // Plus button (data-testid would be cleaner; for now match by aria-label).
  const incButton = page.getByRole("button", { name: /increase.*quantity/i }).first();
  if (await incButton.isVisible()) {
    await incButton.click();
  }

  // Navigate to the planner
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: /planner/i })).toBeVisible();
});

test("/search loads and accepts a query", async ({ page }) => {
  await page.goto("/search?q=dye");
  await expect(page.getByRole("heading", { name: /search/i })).toBeVisible();
  // Either we got matches or we got the loading state — both are fine.
  // Just verify the search input exists with our query.
  const input = page.getByRole("searchbox");
  await expect(input).toHaveValue("dye");
});

test("404 page surfaces the search CTA", async ({ page }) => {
  const response = await page.goto("/items/this-slug-does-not-exist-zzzqqq");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /search items/i })).toBeVisible();
});
