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
    await expect(
      page.getByText(/No passes yet|Create a demo/i),
    ).toBeVisible();
  });

  test("has Create Demo Pass button", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("button", { name: /Create Demo Pass/i }),
    ).toBeVisible();
  });
});
