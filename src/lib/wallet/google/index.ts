import { getAppBaseUrl, isMockWalletMode } from "@/lib/config/env";
import { assertPassIsIssuable } from "@/lib/wallet/common/pass";
import type { GoogleGenerationResult } from "@/lib/wallet/common/types";
import type { CommonPass } from "@/lib/wallet/common/schema";

import { isGoogleConfigured, requireGoogleConfig } from "./auth";
import { classIdFor, ensureGenericClass } from "./class";
import { ensureGenericObject, objectIdFor } from "./object";
import { createGoogleSaveUrl } from "./save-url";

export { isGoogleConfigured, requireGoogleConfig } from "./auth";
export { mapCommonPassToGoogleWallet, mapCommonPassToGoogleClass } from "@/lib/wallet/mappers/google";
export { buildSaveJwtClaims, buildSaveUrl } from "./payloads";
export { createGoogleSaveUrl } from "./save-url";
export { objectIdFor } from "./object";

export const MOCK_MODE_REASON =
  "MOCK_WALLET_MODE is enabled, so no Google Wallet pass was created. Configure a Google Wallet issuer and service account to issue a real pass.";

export function mockGoogleSaveUrl(passId: string): string {
  const origin = getAppBaseUrl().replace(/\/$/, "");
  return `${origin}/demo/google-mock?passId=${encodeURIComponent(passId)}`;
}

export async function issueGooglePass(
  pass: CommonPass,
  options: { objectId?: string } = {},
): Promise<GoogleGenerationResult> {
  assertPassIsIssuable(pass);

  if (isMockWalletMode()) {
    const objectId = options.objectId ?? `mock.${pass.serialNumber}`;
    return {
      mode: "mock",
      saveUrl: mockGoogleSaveUrl(pass.id),
      objectId,
      reason: MOCK_MODE_REASON,
    };
  }

  const config = requireGoogleConfig();
  const walletClass = await ensureGenericClass(config, pass);
  const object = await ensureGenericObject(pass, config, walletClass.id);
  const saveUrl = createGoogleSaveUrl(config, object);

  return {
    mode: "real",
    saveUrl,
    objectId: object.id,
    classId: walletClass.id,
  };
}

export function peekGoogleObjectId(pass: CommonPass): string | null {
  if (!isGoogleConfigured() || isMockWalletMode()) return pass.walletInfo?.googleObjectId ?? null;
  const config = requireGoogleConfig();
  return objectIdFor(pass, config);
}

export { classIdFor };
