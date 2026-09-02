import "server-only";

/**
 * Central, server-only access to configuration.
 *
 * Nothing in this module may ever be imported from a Client Component. Every
 * value here is read from `process.env` without a NEXT_PUBLIC_ prefix, so it
 * stays on the server even if that rule is accidentally broken.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import type { WalletConfigStatus } from "@/lib/wallet/common/types";

import { looksLikePemMaterial } from "./pem-material";

export type WalletPlatform = "apple" | "google";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readBool(name: string, fallback = false): boolean {
  const value = read(name);
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function resolveEnvPath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function hasReadableSource(source: { base64?: string; path?: string }): boolean {
  if (looksLikePemMaterial(source.base64)) return true;
  if (!source.path) return false;
  return existsSync(resolveEnvPath(source.path));
}

/**
 * In mock mode the wallet endpoints return clearly marked demo responses so the
 * UI can be developed without any Apple or Google credentials.
 */
export function isMockWalletMode(): boolean {
  return readBool("MOCK_WALLET_MODE", false);
}

export function getAppBaseUrl(): string {
  return (
    read("APP_BASE_URL") ??
    (read("VERCEL_URL") ? `https://${read("VERCEL_URL")}` : undefined) ??
    "http://localhost:3000"
  );
}

export interface BrandConfig {
  name: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
}

export function getBrandConfig(): BrandConfig {
  return {
    name: read("BRAND_NAME") ?? "Demo Company",
    backgroundColor: read("BRAND_BACKGROUND_COLOR") ?? "#0D5C3D",
    foregroundColor: read("BRAND_FOREGROUND_COLOR") ?? "#FFFFFF",
    labelColor: read("BRAND_LABEL_COLOR") ?? "#B7E4C7",
  };
}

/* -------------------------------------------------------------------------- */
/* Supabase                                                                    */
/* -------------------------------------------------------------------------- */

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  anonKey?: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = read("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRoleKey = read("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return { url, serviceRoleKey, anonKey: read("SUPABASE_ANON_KEY") };
}

/* -------------------------------------------------------------------------- */
/* Apple Wallet                                                                */
/* -------------------------------------------------------------------------- */

export interface AppleConfig {
  teamIdentifier: string;
  passTypeIdentifier: string;
  certificate: { base64?: string; path?: string };
  privateKey: { base64?: string; path?: string };
  wwdr: { base64?: string; path?: string };
  privateKeyPassword?: string;
}

/**
 * Team ID and Pass Type ID used inside pass.json.
 * These do not require certificate files — signing material is separate.
 */
export function getApplePassIdentity(): { teamIdentifier: string; passTypeIdentifier: string } {
  return {
    teamIdentifier: read("APPLE_TEAM_ID") ?? "0000000000",
    passTypeIdentifier: read("APPLE_PASS_TYPE_IDENTIFIER") ?? "pass.com.example.membership",
  };
}

/**
 * Returns the Apple configuration, or null when it is not fully configured.
 * Never returns the decoded key material itself - see `lib/wallet/apple/certificates`.
 */
export function getAppleConfig(): AppleConfig | null {
  const teamIdentifier = read("APPLE_TEAM_ID");
  const passTypeIdentifier = read("APPLE_PASS_TYPE_IDENTIFIER");

  const certificate = {
    base64: read("APPLE_CERTIFICATE_BASE64"),
    path: read("APPLE_CERTIFICATE_PATH"),
  };
  const privateKey = {
    base64: read("APPLE_PRIVATE_KEY_BASE64"),
    path: read("APPLE_PRIVATE_KEY_PATH"),
  };
  const wwdr = {
    base64: read("APPLE_WWDR_CERTIFICATE_BASE64"),
    path: read("APPLE_WWDR_CERTIFICATE_PATH"),
  };

  const hasCertificate = hasReadableSource(certificate);
  const hasPrivateKey = hasReadableSource(privateKey);
  const hasWwdr = hasReadableSource(wwdr);

  if (!teamIdentifier || !passTypeIdentifier || !hasCertificate || !hasPrivateKey || !hasWwdr) {
    return null;
  }

  return {
    teamIdentifier,
    passTypeIdentifier,
    certificate,
    privateKey,
    wwdr,
    privateKeyPassword: read("APPLE_PRIVATE_KEY_PASSWORD"),
  };
}

/** True when the Pass Type certificate file/base64 is present (key may still be missing). */
export function hasAppleSignerCertificate(): boolean {
  return hasReadableSource({
    base64: read("APPLE_CERTIFICATE_BASE64"),
    path: read("APPLE_CERTIFICATE_PATH"),
  });
}

/** True when the matching private key file/base64 is present. */
export function hasAppleSignerKey(): boolean {
  return hasReadableSource({
    base64: read("APPLE_PRIVATE_KEY_BASE64"),
    path: read("APPLE_PRIVATE_KEY_PATH"),
  });
}

/* -------------------------------------------------------------------------- */
/* Google Wallet                                                               */
/* -------------------------------------------------------------------------- */

export interface GoogleConfig {
  issuerId: string;
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  classSuffix: string;
  logoUrl?: string;
}

export function getGoogleConfig(): GoogleConfig | null {
  const issuerId = read("GOOGLE_ISSUER_ID");
  const serviceAccountEmail = read("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!issuerId || !serviceAccountEmail || !rawKey) return null;

  // Deployment platforms commonly store the PEM with literal "\n" sequences.
  const serviceAccountPrivateKey = rawKey.replace(/\\n/g, "\n").replace(/^"|"$/g, "").trim();
  if (!serviceAccountPrivateKey.includes("BEGIN")) return null;

  return {
    issuerId,
    serviceAccountEmail,
    serviceAccountPrivateKey,
    classSuffix: read("GOOGLE_WALLET_CLASS_SUFFIX") ?? "wallet_pass_demo_generic",
    logoUrl: read("GOOGLE_WALLET_LOGO_URL"),
  };
}

/* -------------------------------------------------------------------------- */
/* Status (safe to send to the browser - booleans only)                        */
/* -------------------------------------------------------------------------- */

export type { WalletConfigStatus };

export function getWalletConfigStatus(): WalletConfigStatus {
  return {
    mockMode: isMockWalletMode(),
    supabaseConfigured: getSupabaseConfig() !== null,
    appleConfigured: getAppleConfig() !== null,
    googleConfigured: getGoogleConfig() !== null,
  };
}
