import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders the hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Design wallet passes/i }),
    ).toBeVisible();
  });

  test("displays the Create a pass button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Create a pass/i }),
    ).toBeVisible();
  });

  test("shows the status banner", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Mock mode")).toBeVisible();
  });

  test("navigates to dashboard via link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Open dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
