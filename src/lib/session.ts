import "server-only";

import { cookies } from "next/headers";

/**
 * This build intentionally has no login/registration flow.
 *
 * Instead, every visitor is issued an opaque owner id in an httpOnly cookie by
 * `middleware.ts`. The server treats that id exactly like an authenticated user
 * id: it is written to `wallet_passes.user_id` and checked on every wallet
 * request. Because the cookie is httpOnly it cannot be read or forged from
 * client-side JavaScript, and no wallet credential is ever derived from it.
 *
 * Swapping this for Supabase Auth later only requires changing
 * `getOwnerId()` to return `session.user.id`.
 */
export const OWNER_COOKIE = "wpd_owner";
export const OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getOwnerId(): Promise<string | null> {
  const store = await cookies();
  return store.get(OWNER_COOKIE)?.value ?? null;
}

/** Reads the owner id from a Request Cookie header (fallback for Route Handlers). */
export function getOwnerIdFromRequest(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === OWNER_COOKIE) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}

/**
 * Preferred way to read the owner id inside Route Handlers.
 * Uses Next.js cookie APIs first, then falls back to manual header parsing.
 */
export async function getOwnerIdFromRouteHandler(request: Request): Promise<string | null> {
  const store = await cookies();
  const fromStore = store.get(OWNER_COOKIE)?.value;
  if (fromStore) return fromStore;
  return getOwnerIdFromRequest(request);
}
