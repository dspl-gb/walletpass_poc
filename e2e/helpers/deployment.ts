import type { Page } from "@playwright/test";

/** True when Playwright targets a live deployment instead of the local dev server. */
export function isDeployedTarget(): boolean {
  return Boolean(process.env.BASE_URL);
}

/**
 * Fail fast with a clear message when Vercel Deployment Protection is still
 * showing the login gate instead of the app.
 */
export async function assertNotOnVercelProtectionPage(page: Page): Promise<void> {
  const protectionHeading = page.getByRole("heading", { name: /Log in to Vercel/i });
  if (await protectionHeading.isVisible().catch(() => false)) {
    throw new Error(
      "Hit Vercel Deployment Protection instead of the app. Configure VERCEL_AUTOMATION_BYPASS_SECRET in GitHub Actions and enable Protection Bypass for Automation in Vercel.",
    );
  }
}
