import "server-only";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import {
  OWNER_COOKIE,
  OWNER_COOKIE_MAX_AGE,
  ownerCookieOptions,
  readOwnerIdFromCookieHeader,
} from "@/lib/owner-cookie";

/**
 * This build intentionally has no login/registration flow.
 *
 * Instead, every visitor is issued an opaque owner id in an httpOnly cookie by
 * `middleware.ts`. The server treats that id exactly like an authenticated user
 * id: it is written to `passes.user_id` and checked on every wallet
 * request. Because the cookie is httpOnly it cannot be read or forged from
 * client-side JavaScript, and no wallet credential is ever derived from it.
 *
 * Swapping this for Supabase Auth later only requires changing
 * `getOwnerId()` to return `session.user.id`.
 */
export { OWNER_COOKIE, OWNER_COOKIE_MAX_AGE, ownerCookieOptions };

export async function getOwnerId(): Promise<string | null> {
  const store = await cookies();
  return store.get(OWNER_COOKIE)?.value ?? null;
}

/** Reads the owner id from a Request Cookie header (fallback for Route Handlers). */
export function getOwnerIdFromRequest(request: Request): string | null {
  return readOwnerIdFromCookieHeader(request.headers.get("cookie"));
}

/**
 * Preferred way to read the owner id inside Route Handlers.
 * Prefer the request Cookie header (middleware injects the new owner there)
 * before the Next.js cookie store, so we never mint a second id on the same request.
 */
export async function getOwnerIdFromRouteHandler(request: Request): Promise<string | null> {
  const fromHeader = getOwnerIdFromRequest(request);
  if (fromHeader) return fromHeader;
  const store = await cookies();
  return store.get(OWNER_COOKIE)?.value ?? null;
}

/**
 * Returns the anonymous owner id for Route Handlers, creating the httpOnly
 * cookie when middleware did not run or the browser has not persisted it yet.
 */
export async function ensureOwnerId(request: Request): Promise<string> {
  const existing = await getOwnerIdFromRouteHandler(request);
  if (existing) return existing;

  const ownerId = randomUUID();
  const store = await cookies();
  store.set({ name: OWNER_COOKIE, value: ownerId, ...ownerCookieOptions });
  return ownerId;
}
