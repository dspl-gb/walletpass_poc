import { getWalletConfigStatus } from "@/lib/config/env";
import { jsonResponse } from "@/lib/api/responses";
import { isUsingMemoryStore } from "@/lib/db/passes";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getWalletConfigStatus();
  return jsonResponse({
    ...status,
    memoryStore: isUsingMemoryStore(),
    loginRequired: false,
  });
}
