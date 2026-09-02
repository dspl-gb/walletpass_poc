import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { recordWalletEvent } from "@/lib/db/events";
import { createPass, listPassesForOwner } from "@/lib/db/passes";
import { getOwnerIdFromRouteHandler } from "@/lib/session";
import { normalizePassInput, parseCommonPassInput } from "@/lib/wallet/common/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ownerId = await getOwnerIdFromRouteHandler(request);
    const passes = await listPassesForOwner(ownerId);
    return jsonResponse({ passes });
  } catch (error) {
    return errorResponse(error, { route: "GET /api/passes" });
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = await getOwnerIdFromRouteHandler(request);
    const raw = normalizePassInput((await request.json()) as Record<string, unknown>);
    const input = parseCommonPassInput(raw);
    const status = input.status === "published" ? "published" : "draft";
    const pass = await createPass(input, ownerId, status);
    await recordWalletEvent({
      passId: pass.id,
      platform: "system",
      eventType: "pass_created",
      metadata: { name: pass.name, passType: pass.passType },
    });
    return jsonResponse({ pass }, { status: 201 });
  } catch (error) {
    return errorResponse(error, { route: "POST /api/passes" });
  }
}
