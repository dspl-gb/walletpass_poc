import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Wallet Pass Demo.
 *
 * Set BASE_URL to target a deployed environment (e.g. your Vercel preview):
 *   BASE_URL=https://my-app.vercel.app npx playwright test
 *
 * When BASE_URL is not set, Playwright launches the local Next.js dev server
 * automatically via `webServer`.
 */

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const useDevServer = !process.env.BASE_URL;

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results/playwright",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["junit", { outputFile: "test-results/playwright-results.xml" }]]
    : [["html", { open: "on-failure" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start a local dev server only when no BASE_URL is provided.
  webServer: useDevServer
    ? {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        env: {
          MOCK_WALLET_MODE: "true",
        },
        timeout: 60_000,
      }
    : undefined,
});
