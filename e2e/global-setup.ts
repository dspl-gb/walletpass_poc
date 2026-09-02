import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type FullConfig } from "@playwright/test";

const AUTH_DIR = path.join(__dirname, ".auth");
const AUTH_FILE = path.join(AUTH_DIR, "deployment.json");

/**
 * Prime Vercel Deployment Protection bypass cookies before smoke tests run
 * against a live deployment.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

  if (!process.env.BASE_URL || !baseURL || !bypassSecret) {
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    extraHTTPHeaders: {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    },
  });

  try {
    const page = await context.newPage();
    const response = await page.goto(baseURL, { waitUntil: "domcontentloaded" });

    if (!response?.ok()) {
      throw new Error(
        `Deployment at ${baseURL} returned HTTP ${response?.status() ?? "unknown"}.`,
      );
    }

    const protectionGate = page.getByRole("heading", { name: /Log in to Vercel/i });
    if (await protectionGate.isVisible().catch(() => false)) {
      throw new Error(
        "Vercel Deployment Protection bypass failed. Enable Protection Bypass for Automation in the Vercel project and set VERCEL_AUTOMATION_BYPASS_SECRET in GitHub Actions secrets to the same value.",
      );
    }

    const appMarker = page.getByRole("link", { name: /Wallet Pass/i });
    await appMarker.waitFor({ state: "visible", timeout: 15_000 });

    await mkdir(AUTH_DIR, { recursive: true });
    await context.storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}

export { AUTH_FILE };
