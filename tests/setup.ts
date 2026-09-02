import { beforeEach, vi } from "vitest";

import { memoryReset } from "@/lib/db/memory";

beforeEach(() => {
  memoryReset();
  vi.unstubAllEnvs();
  process.env.MOCK_WALLET_MODE = "true";
  process.env.APP_BASE_URL = "http://localhost:3000";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.APPLE_TEAM_ID;
  delete process.env.APPLE_PASS_TYPE_IDENTIFIER;
  delete process.env.APPLE_CERTIFICATE_PATH;
  delete process.env.APPLE_PRIVATE_KEY_PATH;
  delete process.env.APPLE_WWDR_CERTIFICATE_PATH;
  delete process.env.GOOGLE_ISSUER_ID;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
});
