import "server-only";

import { JWT } from "google-auth-library";

import { getGoogleConfig, type GoogleConfig } from "@/lib/config/env";
import { configurationMissing, invalidCredentials } from "@/lib/wallet/common/errors";

const WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";

let cachedClient: JWT | null = null;
let cachedKeyFingerprint: string | null = null;

export function requireGoogleConfig(): GoogleConfig {
  const config = getGoogleConfig();
  if (!config) {
    throw configurationMissing(
      "Google Wallet is not configured on this deployment yet.",
      "Missing GOOGLE_ISSUER_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    );
  }
  return config;
}

export function isGoogleConfigured(): boolean {
  return getGoogleConfig() !== null;
}

function fingerprint(config: GoogleConfig): string {
  return `${config.serviceAccountEmail}:${config.serviceAccountPrivateKey.length}`;
}

export function getGoogleAuthClient(config = requireGoogleConfig()): JWT {
  const key = fingerprint(config);
  if (cachedClient && cachedKeyFingerprint === key) return cachedClient;

  try {
    cachedClient = new JWT({
      email: config.serviceAccountEmail,
      key: config.serviceAccountPrivateKey,
      scopes: [WALLET_SCOPE],
    });
    cachedKeyFingerprint = key;
    return cachedClient;
  } catch (error) {
    throw invalidCredentials(
      "The Google Wallet service account is not valid. Please contact support.",
      error,
    );
  }
}

export async function getGoogleAccessToken(config = requireGoogleConfig()): Promise<string> {
  const client = getGoogleAuthClient(config);
  try {
    const token = await client.authorize();
    if (!token.access_token) {
      throw invalidCredentials(
        "Google Wallet could not be authorized with the configured service account.",
        "authorize() returned no access_token",
      );
    }
    return token.access_token;
  } catch (error) {
    throw invalidCredentials(
      "Google Wallet could not be authorized with the configured service account.",
      error,
    );
  }
}
