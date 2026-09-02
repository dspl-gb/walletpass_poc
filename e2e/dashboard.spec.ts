import { test, expect } from "@playwright/test";

test.describe("Dashboard page", () => {
  test("renders the dashboard heading", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Your passes/i }),
    ).toBeVisible();
  });

  test("shows empty state when no passes exist", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/No passes yet/i)).toBeVisible();
  });

  test("has Create pass button", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("link", { name: /Create pass/i }),
    ).toBeVisible();
  });
});
