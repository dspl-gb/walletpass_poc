import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/config/env";
import { configurationMissing } from "@/lib/wallet/common/errors";

let cachedClient: SupabaseClient | null = null;

/**
 * Service-role Supabase client.
 *
 * This key bypasses RLS, so it must only ever be constructed inside server
 * code. Ownership is enforced explicitly in `lib/db/passes.ts`.
 */
export function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const config = getSupabaseConfig();
  if (!config) {
    throw configurationMissing(
      "The database is not configured yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your environment.",
    );
  }

  cachedClient = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "wallet-pass-demo" } },
  });

  return cachedClient;
}

export function isDatabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
