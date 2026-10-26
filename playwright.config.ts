import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a production build: the store, and the same store
 * in public demo mode, each on its own server.
 *
 *   npm run test:e2e            build, then run everything (throwaway local stores)
 *   npx playwright test         run again without rebuilding
 *
 * Against a real Supabase project (keys in the environment or .env.local):
 *   E2E_BACKEND=supabase E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npx playwright test
 * Test orders and test items are removed afterwards (global-teardown.ts).
 *
 * Browsers: `npx playwright install chromium` once, or use an installed
 * Chrome with PLAYWRIGHT_CHANNEL=chrome.
 */

const port = Number(process.env.E2E_PORT ?? 3311);
const demoPort = port + 1;
const store = `http://localhost:${port}`;
const demo = `http://localhost:${demoPort}`;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "tests/.artifacts/results",
  // The tests share each store (one server, one data folder), so they run in order.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /owner\.setup\.ts$/, use: { baseURL: store } },
    {
      name: "store",
      dependencies: ["setup"],
      testIgnore: /public-demo\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: store, storageState: "tests/.artifacts/owner.json" },
    },
    {
      name: "public-demo",
      // After the store project: on Supabase both servers share one database.
      dependencies: ["store"],
      testMatch: /public-demo\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: demo },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/server.mjs",
      url: store,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { E2E_PORT: String(port) },
    },
    {
      command: "node tests/e2e/server.mjs --public-demo",
      url: demo,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { E2E_PORT: String(demoPort) },
    },
  ],
});
