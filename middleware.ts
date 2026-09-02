import { NextResponse, type NextRequest } from "next/server";

import { OWNER_COOKIE, ownerCookieOptions } from "@/lib/owner-cookie";

/**
 * Issues the anonymous owner cookie used in place of a login flow.
 *
 * The cookie is httpOnly, so client-side JavaScript can never read it, and the
 * value is a random UUID that carries no personal data and no credentials.
 */
export function middleware(request: NextRequest) {
  const existing = request.cookies.get(OWNER_COOKIE)?.value;
  if (existing) return NextResponse.next();

  const ownerId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  const currentCookie = request.headers.get("cookie");
  requestHeaders.set(
    "cookie",
    currentCookie ? `${currentCookie}; ${OWNER_COOKIE}=${ownerId}` : `${OWNER_COOKIE}=${ownerId}`,
  );

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set({
    name: OWNER_COOKIE,
    value: ownerId,
    ...ownerCookieOptions,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
