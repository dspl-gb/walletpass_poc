import { isMockWalletMode } from "@/lib/config/env";
import { assertPassIsIssuable } from "@/lib/wallet/common/pass";
import type { AppleGenerationResult } from "@/lib/wallet/common/types";
import type { CommonPass } from "@/lib/wallet/common/schema";

import { isAppleConfigured } from "./certificates";
import { APPLE_PASS_CONTENT_TYPE, buildFileName, generateApplePass } from "./generate";

export { APPLE_PASS_CONTENT_TYPE, isAppleConfigured };
export { mapCommonPassToAppleWallet } from "@/lib/wallet/mappers/apple";
export { toPassJson, toAppleColor } from "./pass-json";
export { generateAppleSerialNumber } from "@/lib/wallet/common/identifiers";

export const MOCK_MODE_REASON =
  "MOCK_WALLET_MODE is enabled, so no signed pass was produced. Configure the Apple Wallet certificates to issue a real pass.";

export async function issueApplePass(
  pass: CommonPass,
  options: { serialNumber: string },
): Promise<AppleGenerationResult> {
  assertPassIsIssuable(pass);

  if (isMockWalletMode()) {
    return {
      mode: "mock",
      fileName: buildFileName(pass),
      serialNumber: options.serialNumber,
      reason: MOCK_MODE_REASON,
    };
  }

  const generated = await generateApplePass(pass, { serialNumber: options.serialNumber });

  return {
    mode: "real",
    buffer: generated.buffer,
    fileName: generated.fileName,
    serialNumber: generated.serialNumber,
    signed: generated.signed,
  };
}
