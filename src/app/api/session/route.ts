import { jsonResponse } from "@/lib/api/responses";
import { getOwnerIdFromRouteHandler } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirms the anonymous owner cookie is available for authenticated API calls. */
export async function GET(request: Request) {
  const ownerId = await getOwnerIdFromRouteHandler(request);
  return jsonResponse({ ready: true, ownerId });
}
