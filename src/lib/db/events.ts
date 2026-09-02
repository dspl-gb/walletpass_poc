import "server-only";

import { isDatabaseConfigured } from "@/lib/supabase/server";
import { databaseError } from "@/lib/wallet/common/errors";
import type { WalletEvent, WalletEventPlatform, WalletEventType } from "@/lib/wallet/common/types";

import { memoryListEventsForPass, memoryRecordEvent } from "./memory";
import { getServiceClient } from "@/lib/supabase/server";

const TABLE = "wallet_events";

export interface RecordEventInput {
  passId: string;
  platform: WalletEventPlatform;
  eventType: WalletEventType;
  metadata?: Record<string, unknown> | null;
}

export async function recordWalletEvent(input: RecordEventInput): Promise<void> {
  try {
    if (!isDatabaseConfigured()) {
      memoryRecordEvent(input);
      return;
    }

    const { error } = await getServiceClient().from(TABLE).insert({
      pass_id: input.passId,
      platform: input.platform,
      event_type: input.eventType,
      metadata: input.metadata ?? null,
    });
    if (error) throw error;
  } catch (error) {
    console.error("[analytics] failed to record wallet event", {
      passId: input.passId,
      eventType: input.eventType,
      error,
    });
  }
}

export async function listEventsForPass(passId: string, limit = 25): Promise<WalletEvent[]> {
  if (!isDatabaseConfigured()) return memoryListEventsForPass(passId, limit);

  const { data, error } = await getServiceClient()
    .from(TABLE)
    .select("id,pass_id,platform,event_type,metadata,created_at")
    .eq("pass_id", passId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw databaseError("Could not load pass activity.", error);
  return (data ?? []) as WalletEvent[];
}
