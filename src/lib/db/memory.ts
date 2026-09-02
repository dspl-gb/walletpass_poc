import { randomUUID } from "node:crypto";

import { createGreenbackPassInput } from "@/lib/branding/greenback";
import { createEmptyPass } from "@/lib/wallet/common/defaults";
import { databaseError, notFound } from "@/lib/wallet/common/errors";
import { generateMemberId } from "@/lib/wallet/common/identifiers";
import type { CommonPass } from "@/lib/wallet/common/schema";
import type { WalletGenerationInfo } from "@/lib/wallet/common/schema";
import type { CommonPassInputParsed } from "@/lib/wallet/common/validation";
import type { WalletEvent, WalletEventPlatform, WalletEventType } from "@/lib/wallet/common/types";

/**
 * Process-local store used when Supabase is not configured.
 */

const passes = new Map<string, CommonPass>();
const events: WalletEvent[] = [];
const serialIndex = new Map<string, string>();

function clonePass(pass: CommonPass): CommonPass {
  return structuredClone(pass);
}

export function memoryListPassesForOwner(ownerId: string | null): CommonPass[] {
  return [...passes.values()]
    .filter((pass) =>
      ownerId ? pass.userId === ownerId || pass.userId === null : pass.userId === null,
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(clonePass);
}

export function memoryGetPassById(passId: string): CommonPass | null {
  const pass = passes.get(passId);
  return pass ? clonePass(pass) : null;
}

export function memoryCreatePass(
  input: CommonPassInputParsed,
  userId: string | null,
  status: "draft" | "published" = "draft",
): CommonPass {
  const serialNumber = input.serialNumber?.trim() || generateMemberId("PASS");
  if (serialIndex.has(serialNumber)) {
    throw databaseError("A pass with that serial number already exists.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const pass: CommonPass = {
    id,
    userId,
    name: input.name,
    passType: input.passType,
    organization: input.organization,
    appearance: {
      backgroundColor: input.appearance.backgroundColor,
      foregroundColor: input.appearance.foregroundColor,
      labelColor: input.appearance.labelColor,
      logo: input.appearance.logo ?? null,
      strip: input.appearance.strip ?? null,
      thumbnail: input.appearance.thumbnail ?? null,
      background: input.appearance.background ?? null,
    },
    fields: structuredClone(input.fields),
    barcode: input.barcode,
    validity: input.validity,
    locations: structuredClone(input.locations),
    serialNumber,
    status,
    createdAt: now,
    updatedAt: now,
    walletInfo: null,
  };

  passes.set(id, pass);
  serialIndex.set(serialNumber, id);
  return clonePass(pass);
}

export function memoryUpdatePass(
  passId: string,
  input: CommonPassInputParsed,
  status?: "draft" | "published" | "archived",
  ownerId?: string | null,
): CommonPass {
  const existing = passes.get(passId);
  if (!existing) throw notFound();

  const userId = existing.userId ?? ownerId ?? null;
  const updated: CommonPass = {
    ...existing,
    userId,
    name: input.name,
    passType: input.passType,
    organization: input.organization,
    appearance: {
      backgroundColor: input.appearance.backgroundColor,
      foregroundColor: input.appearance.foregroundColor,
      labelColor: input.appearance.labelColor,
      logo: input.appearance.logo ?? null,
      strip: input.appearance.strip ?? null,
      thumbnail: input.appearance.thumbnail ?? null,
      background: input.appearance.background ?? null,
    },
    fields: structuredClone(input.fields),
    barcode: input.barcode,
    validity: input.validity,
    locations: structuredClone(input.locations),
    serialNumber: input.serialNumber?.trim() || existing.serialNumber,
    status: status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };

  passes.set(passId, updated);
  return clonePass(updated);
}

export function memoryDeletePass(passId: string): void {
  const existing = passes.get(passId);
  if (existing) {
    serialIndex.delete(existing.serialNumber);
    passes.delete(passId);
  }
}

export function memoryUpdateWalletInfo(passId: string, info: Partial<WalletGenerationInfo>): void {
  const existing = passes.get(passId);
  if (!existing) return;
  existing.walletInfo = {
    passId,
    applePassUrl: info.applePassUrl ?? existing.walletInfo?.applePassUrl ?? null,
    appleSerialNumber: info.appleSerialNumber ?? existing.walletInfo?.appleSerialNumber ?? null,
    applePassTypeIdentifier: info.applePassTypeIdentifier ?? existing.walletInfo?.applePassTypeIdentifier ?? null,
    appleGeneratedAt: info.appleGeneratedAt ?? existing.walletInfo?.appleGeneratedAt ?? null,
    googleClassId: info.googleClassId ?? existing.walletInfo?.googleClassId ?? null,
    googleObjectId: info.googleObjectId ?? existing.walletInfo?.googleObjectId ?? null,
    googleSaveUrl: info.googleSaveUrl ?? existing.walletInfo?.googleSaveUrl ?? null,
    googleGeneratedAt: info.googleGeneratedAt ?? existing.walletInfo?.googleGeneratedAt ?? null,
    ...existing.walletInfo,
    ...info,
  };
  existing.updatedAt = new Date().toISOString();
}

export function memoryRecordEvent(input: {
  passId: string;
  platform: WalletEventPlatform;
  eventType: WalletEventType;
  metadata?: Record<string, unknown> | null;
}): void {
  events.unshift({
    id: randomUUID(),
    pass_id: input.passId,
    platform: input.platform,
    event_type: input.eventType,
    metadata: input.metadata ?? null,
    created_at: new Date().toISOString(),
  });
}

export function memoryListEventsForPass(passId: string, limit = 25): WalletEvent[] {
  return events.filter((event) => event.pass_id === passId).slice(0, limit);
}

export function memoryReset(): void {
  passes.clear();
  events.length = 0;
  serialIndex.clear();
}

/** Creates a starter pass for the homepage preview (Greenback + Aeropay demo). */
export function memoryCreatePreviewPass(): CommonPass {
  return createEmptyPass(randomUUID(), null, createGreenbackPassInput());
}
