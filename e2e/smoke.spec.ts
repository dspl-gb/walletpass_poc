import { test, expect } from "@playwright/test";

import { assertNotOnVercelProtectionPage, isDeployedTarget } from "./helpers/deployment";

/**
 * Post-deployment smoke tests.
 *
 * These run against a live deployed URL (Vercel preview / production) by
 * setting BASE_URL before running Playwright. They verify critical paths
 * without relying on a local dev server.
 *
 * Usage:
 *   BASE_URL=https://my-app.vercel.app npx playwright test e2e/smoke.spec.ts
 */

test.describe("Post-deployment smoke", () => {
  test.describe.configure({ timeout: isDeployedTarget() ? 30_000 : 10_000 });

  test.beforeAll(() => {
    test.skip(!isDeployedTarget(), "Smoke tests require BASE_URL to target a deployment.");
  });

  test.beforeEach(async ({ context }) => {
    if (isDeployedTarget() && !process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      throw new Error(
        "VERCEL_AUTOMATION_BYPASS_SECRET is required when BASE_URL points at a Vercel deployment with Deployment Protection enabled.",
      );
    }

    if (isDeployedTarget() && process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      await context.setExtraHTTPHeaders({
        "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        "x-vercel-set-bypass-cookie": "true",
      });
    }
  });

  test("home page loads and returns 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await assertNotOnVercelProtectionPage(page);
    await expect(
      page.getByRole("heading", { name: /Design wallet passes/i }),
    ).toBeVisible();
  });

  test("dashboard page loads and returns 200", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);
    await assertNotOnVercelProtectionPage(page);
    await expect(
      page.getByRole("heading", { name: /Your passes/i }),
    ).toBeVisible();
  });

  test("API health: demo pass endpoint responds", async ({ request }) => {
    const response = await request.post("/api/passes/demo", { maxRedirects: 0 });
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect(response.status()).not.toBe(302);
    expect([307, 308]).toContain(response.status());
  });

  test("offline page is accessible", async ({ page }) => {
    const response = await page.goto("/offline");
    expect(response?.status()).toBe(200);
    await assertNotOnVercelProtectionPage(page);
    await expect(
      page.getByRole("heading", { name: /You're offline/i }),
    ).toBeVisible();
  });
});
