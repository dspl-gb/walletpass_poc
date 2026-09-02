import type { CommonPass } from "@/lib/wallet/common/schema";
import { passExpired } from "./errors";

export function isPassExpired(
  pass: Pick<CommonPass, "validity">,
  now = new Date(),
): boolean {
  const { validity } = pass;
  if (!validity.expirationDateEnabled || !validity.expirationDate) return false;
  const expiry = new Date(validity.expirationDate);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() < now.getTime();
}

export function isPassUsable(pass: Pick<CommonPass, "status" | "validity">): boolean {
  return pass.status === "published" && !isPassExpired(pass);
}

export type WalletBlockReason = "draft" | "expired" | "archived" | null;

/** Why wallet buttons should be disabled, if at all. */
export function getWalletBlockReason(
  pass: Pick<CommonPass, "status" | "validity">,
): WalletBlockReason {
  if (pass.status === "archived") return "archived";
  if (pass.status === "draft") return "draft";
  if (isPassExpired(pass)) return "expired";
  return null;
}

/** Throws a user-safe error when a pass may not be added to a wallet. */
export function assertPassIsIssuable(pass: Pick<CommonPass, "status" | "validity">): void {
  if (pass.status === "archived") {
    throw passExpired("This pass has been archived and can no longer be added to a wallet.");
  }
  if (pass.status === "draft") {
    throw passExpired("Publish this pass before adding it to a wallet.");
  }
  if (isPassExpired(pass)) {
    throw passExpired();
  }
}

export function formatExpirationDate(value: string | null): string {
  if (!value) return "No expiry";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No expiry";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function monthsFromNow(months: number, from = new Date()): Date {
  const date = new Date(from.getTime());
  date.setUTCMonth(date.getUTCMonth() + months);
  return date;
}
