import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { recordWalletEvent } from "@/lib/db/events";
import {
  assertPassOwnership,
  deletePass,
  getPassById,
  publishPass,
  updatePass,
} from "@/lib/db/passes";
import { getOwnerIdFromRouteHandler } from "@/lib/session";
import { normalizePassInput, parseCommonPassInput } from "@/lib/wallet/common/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = await getOwnerIdFromRouteHandler(_request);
    const pass = await getPassById(id);
    if (!pass) return jsonResponse({ error: { message: "Pass not found." } }, { status: 404 });
    assertPassOwnership(pass, ownerId);
    return jsonResponse({ pass });
  } catch (error) {
    return errorResponse(error, { route: "GET /api/passes/[id]" });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = await getOwnerIdFromRouteHandler(request);
    const existing = await getPassById(id);
    if (!existing) return jsonResponse({ error: { message: "Pass not found." } }, { status: 404 });
    assertPassOwnership(existing, ownerId);

    const raw = normalizePassInput((await request.json()) as Record<string, unknown>);
    const input = parseCommonPassInput(raw);
    const pass = await updatePass(id, input, input.status ?? existing.status);

    await recordWalletEvent({
      passId: pass.id,
      platform: "system",
      eventType: "pass_updated",
    });

    return jsonResponse({ pass });
  } catch (error) {
    return errorResponse(error, { route: "PUT /api/passes/[id]" });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const ownerId = await getOwnerIdFromRouteHandler(request);
    const existing = await getPassById(id);
    if (!existing) return jsonResponse({ error: { message: "Pass not found." } }, { status: 404 });
    assertPassOwnership(existing, ownerId);
    await deletePass(id);
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error, { route: "DELETE /api/passes/[id]" });
  }
}
