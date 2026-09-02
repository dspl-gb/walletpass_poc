import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { recordWalletEvent } from "@/lib/db/events";
import { assertPassOwnership, getPassById, publishPass } from "@/lib/db/passes";
import { getOwnerIdFromRequest } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = getOwnerIdFromRequest(request);
    const existing = await getPassById(id);
    if (!existing) return jsonResponse({ error: { message: "Pass not found." } }, { status: 404 });
    assertPassOwnership(existing, ownerId);

    const pass = await publishPass(id);

    await recordWalletEvent({
      passId: pass.id,
      platform: "system",
      eventType: "pass_published",
    });

    return jsonResponse({ pass });
  } catch (error) {
    return errorResponse(error, { route: "POST /api/passes/[id]/publish" });
  }
}
