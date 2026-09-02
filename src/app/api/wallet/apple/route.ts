import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/responses";
import { getOwnerIdFromRouteHandler } from "@/lib/session";
import { configurationMissing } from "@/lib/wallet/common/errors";
import { APPLE_PASS_CONTENT_TYPE, issueAppleForOwner, parsePassId } from "@/lib/wallet/issue-apple";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(passId: string, request: Request) {
  const ownerId = await getOwnerIdFromRouteHandler(request);
  const { result } = await issueAppleForOwner(passId, ownerId);

  if (result.mode === "mock") {
    return NextResponse.json(
      {
        mock: true,
        message: "This is a mock response. No Apple Wallet pass was generated.",
        reason: result.reason,
        fileName: result.fileName,
        serialNumber: result.serialNumber,
      },
      {
        headers: {
          "X-Wallet-Mock": "true",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!result.signed) {
    return errorResponse(
      configurationMissing(
        "Apple Wallet signing is not configured on this server. Set MOCK_WALLET_MODE=false and add APPLE_*_BASE64 variables on Vercel.",
        "Unsigned pass generation is disabled in production",
      ),
      { route: "wallet/apple" },
    );
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      "Content-Type": APPLE_PASS_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": String(result.buffer.byteLength),
      "Cache-Control": "no-store",
      "X-Wallet-Signed": "true",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const passId = parsePassId(body);
    return await handle(passId, request);
  } catch (error) {
    return errorResponse(error, { route: "POST /api/wallet/apple" });
  }
}

/**
 * GET exists so iOS Safari can navigate directly to a .pkpass URL after the
 * POST has already authorised the request. The handler is otherwise identical.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const passId = parsePassId({ passId: url.searchParams.get("passId") });
    return await handle(passId, request);
  } catch (error) {
    return errorResponse(error, { route: "GET /api/wallet/apple" });
  }
}
