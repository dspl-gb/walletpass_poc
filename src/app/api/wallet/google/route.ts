import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { getOwnerIdFromRequest } from "@/lib/session";
import { parsePassId } from "@/lib/wallet/issue-apple";
import { issueGoogleForOwner } from "@/lib/wallet/issue-google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const passId = parsePassId(body);
    const ownerId = getOwnerIdFromRequest(request);
    const { result } = await issueGoogleForOwner(passId, ownerId);

    return jsonResponse(
      result.mode === "mock"
        ? {
            saveUrl: result.saveUrl,
            mock: true,
            reason: result.reason,
          }
        : {
            saveUrl: result.saveUrl,
          },
      {
        headers: {
          "Cache-Control": "no-store",
          ...(result.mode === "mock" ? { "X-Wallet-Mock": "true" } : {}),
        },
      },
    );
  } catch (error) {
    return errorResponse(error, { route: "POST /api/wallet/google" });
  }
}
