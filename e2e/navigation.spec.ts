import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("header links navigate correctly", async ({ page }) => {
    await page.goto("/");

    // Dashboard link
    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Home link (logo)
    await page.locator("header a[href='/']").click();
    await expect(page).toHaveURL("/");
  });

  test("404 page renders for unknown routes", async ({ page }) => {
    await page.goto("/nonexistent-page");
    await expect(page.getByText(/404|not found/i)).toBeVisible();
  });
});
