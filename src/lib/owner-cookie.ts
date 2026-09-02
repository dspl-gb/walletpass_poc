/**
 * Shared anonymous-owner cookie constants.
 * Kept free of `server-only` so Edge middleware can import them.
 */
export const OWNER_COOKIE = "wpd_owner";
export const OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const ownerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Vercel is always HTTPS; local `next start` may be HTTP even when NODE_ENV=production.
  secure: process.env.VERCEL === "1",
  path: "/",
  maxAge: OWNER_COOKIE_MAX_AGE,
};

export function readOwnerIdFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === OWNER_COOKIE) return decodeURIComponent(rest.join("=")) || null;
  }
  return null;
}
