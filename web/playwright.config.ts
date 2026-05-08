import { defineConfig, devices } from "@playwright/test";

// One-shot smoke harness. Boots `npm run dev` (which builds the data shards
// first, so the first run is slow), points at it, and runs the e2e/ tests.
// CI-friendly: reuses an existing dev server if one's already up locally.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // smoke is one-flow, parallel buys nothing
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000, // build:data is slow on first cold start
  },
});
