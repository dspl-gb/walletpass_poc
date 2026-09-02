import "server-only";

import { recordWalletEvent } from "@/lib/db/events";
import { loadOwnedPass, upsertWalletInfo } from "@/lib/db/passes";
import type { CommonPass } from "@/lib/wallet/common/schema";
import type { GoogleGenerationResult } from "@/lib/wallet/common/types";
import { issueGooglePass } from "@/lib/wallet/google";

export async function issueGoogleForOwner(
  passId: string,
  ownerId: string | null,
): Promise<{ pass: CommonPass; result: GoogleGenerationResult }> {
  await recordWalletEvent({
    passId,
    platform: "google",
    eventType: "google_button_clicked",
  });

  try {
    const pass = await loadOwnedPass(passId, ownerId);
    const result = await issueGooglePass(pass);

    await upsertWalletInfo(pass.id, {
      passId: pass.id,
      googleObjectId: result.objectId,
      googleClassId: result.mode === "real" ? result.classId : pass.walletInfo?.googleClassId ?? null,
      googleSaveUrl: result.saveUrl,
      googleGeneratedAt: new Date().toISOString(),
    });

    await recordWalletEvent({
      passId: pass.id,
      platform: "google",
      eventType: "google_save_url_generated",
      metadata: { mode: result.mode, objectId: result.objectId },
    });

    return { pass, result };
  } catch (error) {
    await recordWalletEvent({
      passId,
      platform: "google",
      eventType: "google_generation_failed",
      metadata: { failed: true },
    });
    throw error;
  }
}
