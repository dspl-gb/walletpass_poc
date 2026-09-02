import { test, expect } from "@playwright/test";

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
  test("home page loads and returns 200", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /Design wallet passes/i }),
    ).toBeVisible();
  });

  test("dashboard page loads and returns 200", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /Your passes/i }),
    ).toBeVisible();
  });

  test("API health: demo pass endpoint responds", async ({ request }) => {
    const response = await request.post("/api/passes/demo", { maxRedirects: 0 });
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    expect([307, 308]).toContain(response.status());
  });

  test("offline page is accessible", async ({ page }) => {
    const response = await page.goto("/offline");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: /You're offline/i }),
    ).toBeVisible();
  });
});
