import "server-only";

import { randomUUID, randomBytes } from "node:crypto";

/**
 * Apple requires a serial number that is unique within a Pass Type Identifier
 * and stable for the lifetime of the pass (updates are keyed on it).
 */
export function generateAppleSerialNumber(): string {
  return randomUUID();
}

/**
 * Google Wallet object ids must be prefixed with the issuer id and may only
 * contain alphanumerics, `.`, `_` and `-`.
 */
export function generateGoogleObjectId(issuerId: string, memberId: string): string {
  const suffix = sanitizeGoogleIdSegment(`${memberId}-${randomBytes(4).toString("hex")}`);
  return `${issuerId}.${suffix}`;
}

export function buildGoogleClassId(issuerId: string, classSuffix: string): string {
  return `${issuerId}.${sanitizeGoogleIdSegment(classSuffix)}`;
}

export function sanitizeGoogleIdSegment(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-{2,}/g, "-");
  return cleaned.slice(0, 96) || "pass";
}

/** Human friendly member id used by the create-pass form and demo mode. */
export function generateMemberId(prefix = "MEM"): string {
  return `${prefix}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
