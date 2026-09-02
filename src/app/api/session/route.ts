import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { ensureOwnerId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirms the anonymous owner cookie is available for authenticated API calls. */
export async function GET(request: Request) {
  try {
    const ownerId = await ensureOwnerId(request);
    return jsonResponse({ ready: true, ownerId });
  } catch (error) {
    return errorResponse(error, { route: "GET /api/session" });
  }
}
