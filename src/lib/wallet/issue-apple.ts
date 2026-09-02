import "server-only";

import { z } from "zod";

import { getApplePassIdentity } from "@/lib/config/env";
import { recordWalletEvent } from "@/lib/db/events";
import { loadOwnedPass, upsertWalletInfo } from "@/lib/db/passes";
import { invalidRequest } from "@/lib/wallet/common/errors";
import { generateAppleSerialNumber } from "@/lib/wallet/common/identifiers";
import type { CommonPass } from "@/lib/wallet/common/schema";
import type { AppleGenerationResult } from "@/lib/wallet/common/types";
import { APPLE_PASS_CONTENT_TYPE, issueApplePass } from "@/lib/wallet/apple";

export const passIdSchema = z.object({
  passId: z.string().uuid("passId must be a UUID"),
});

export function parsePassId(input: unknown): string {
  const parsed = passIdSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidRequest("A valid passId is required.", parsed.error.flatten());
  }
  return parsed.data.passId;
}

export async function issueAppleForOwner(
  passId: string,
  ownerId: string | null,
): Promise<{ pass: CommonPass; result: AppleGenerationResult }> {
  await recordWalletEvent({
    passId,
    platform: "apple",
    eventType: "apple_button_clicked",
  });

  try {
    const pass = await loadOwnedPass(passId, ownerId);
    const serialNumber = pass.walletInfo?.appleSerialNumber ?? generateAppleSerialNumber();
    const identity = getApplePassIdentity();

    const result = await issueApplePass(pass, { serialNumber });

    await upsertWalletInfo(pass.id, {
      passId: pass.id,
      appleSerialNumber: serialNumber,
      applePassTypeIdentifier: identity.passTypeIdentifier,
      appleGeneratedAt: new Date().toISOString(),
    });

    await recordWalletEvent({
      passId: pass.id,
      platform: "apple",
      eventType: "apple_pass_generated",
      metadata: { mode: result.mode, serialNumber: result.serialNumber },
    });

    return { pass, result };
  } catch (error) {
    await recordWalletEvent({
      passId,
      platform: "apple",
      eventType: "apple_pass_generation_failed",
      metadata: { failed: true },
    });
    throw error;
  }
}

export { APPLE_PASS_CONTENT_TYPE };
