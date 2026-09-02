import "server-only";

import { randomUUID } from "node:crypto";

import { isDatabaseConfigured } from "@/lib/supabase/server";
import { databaseError, notFound } from "@/lib/wallet/common/errors";
import { generateMemberId } from "@/lib/wallet/common/identifiers";
import { normalizeLocations } from "@/lib/wallet/common/normalize";
import type { CommonPass } from "@/lib/wallet/common/schema";
import type { WalletGenerationInfo } from "@/lib/wallet/common/schema";
import type { CommonPassInputParsed } from "@/lib/wallet/common/validation";
import {
  assembleCommonPass,
  type PassBarcodeRow,
  type PassFieldRow,
  type PassLocationRow,
  type PassRow,
  type WalletPassRow,
} from "@/lib/wallet/common/types";

import {
  commonPassToInput,
  fieldsToRows,
  inputToPassRow,
  locationsToRows,
} from "./transform";
import {
  memoryCreatePass,
  memoryDeletePass,
  memoryGetPassById,
  memoryListPassesForOwner,
  memoryUpdatePass,
  memoryUpdateWalletInfo,
} from "./memory";
import { getServiceClient } from "@/lib/supabase/server";

const PASSES_TABLE = "passes";
const FIELDS_TABLE = "pass_fields";
const BARCODES_TABLE = "pass_barcodes";
const LOCATIONS_TABLE = "pass_locations";
const WALLET_TABLE = "wallet_passes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMemoryStore(): boolean {
  return !isDatabaseConfigured();
}

function isOwnerUuid(ownerId: string | null | undefined): ownerId is string {
  return typeof ownerId === "string" && UUID_RE.test(ownerId);
}

function ownerPassesQuery(_ownerId: string | null) {
  // Demo has no real login yet — list recent passes for this deployment.
  // Ownership is still recorded when available and enforced once Auth is added.
  return getServiceClient()
    .from(PASSES_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
}

function explainPassesQueryError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "42P01") {
    return "The passes table is missing. Run supabase/migrations/0002_dynamic_passes.sql in your Supabase project.";
  }
  return "Could not load your passes.";
}

async function loadRelatedData(passId: string): Promise<{
  fields: PassFieldRow[];
  barcode: PassBarcodeRow | null;
  locations: PassLocationRow[];
  wallet: WalletPassRow | null;
}> {
  if (isMemoryStore()) {
    const pass = memoryGetPassById(passId);
    if (!pass) return { fields: [], barcode: null, locations: [], wallet: null };
    // Memory store returns assembled CommonPass directly
    return { fields: [], barcode: null, locations: [], wallet: null };
  }

  const client = getServiceClient();

  const [fieldsRes, barcodeRes, locationsRes, walletRes] = await Promise.all([
    client.from(FIELDS_TABLE).select("*").eq("pass_id", passId).order("sort_order"),
    client.from(BARCODES_TABLE).select("*").eq("pass_id", passId).maybeSingle(),
    client.from(LOCATIONS_TABLE).select("*").eq("pass_id", passId),
    client.from(WALLET_TABLE).select("*").eq("pass_id", passId).maybeSingle(),
  ]);

  if (fieldsRes.error) throw databaseError("Could not load pass fields.", fieldsRes.error);
  if (barcodeRes.error) throw databaseError("Could not load pass barcode.", barcodeRes.error);
  if (locationsRes.error) throw databaseError("Could not load pass locations.", locationsRes.error);
  if (walletRes.error) throw databaseError("Could not load wallet info.", walletRes.error);

  return {
    fields: (fieldsRes.data ?? []) as PassFieldRow[],
    barcode: (barcodeRes.data as PassBarcodeRow | null) ?? null,
    locations: (locationsRes.data ?? []) as PassLocationRow[],
    wallet: (walletRes.data as WalletPassRow | null) ?? null,
  };
}

async function rowToCommonPass(row: PassRow): Promise<CommonPass> {
  const related = await loadRelatedData(row.id);
  return assembleCommonPass(row, related.fields, related.barcode, related.locations, related.wallet);
}

export async function listPassesForOwner(ownerId: string | null): Promise<CommonPass[]> {
  if (isMemoryStore()) return memoryListPassesForOwner(ownerId);

  const { data, error } = await ownerPassesQuery(ownerId);

  if (error) throw databaseError(explainPassesQueryError(error), error);

  const rows = (data ?? []) as PassRow[];
  const assembled = await Promise.allSettled(rows.map((row) => rowToCommonPass(row)));
  return assembled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function getPassById(passId: string): Promise<CommonPass | null> {
  if (isMemoryStore()) return memoryGetPassById(passId);

  const { data, error } = await getServiceClient()
    .from(PASSES_TABLE)
    .select("*")
    .eq("id", passId)
    .maybeSingle();

  if (error) throw databaseError("Could not load that pass.", error);
  if (!data) return null;
  return rowToCommonPass(data as PassRow);
}

export async function createPass(
  input: CommonPassInputParsed,
  userId: string | null,
  status: "draft" | "published" = "draft",
): Promise<CommonPass> {
  if (isMemoryStore()) return memoryCreatePass(input, userId, status);

  const serialNumber = input.serialNumber?.trim() || generateMemberId("PASS");
  const passRow = inputToPassRow(
    input,
    isOwnerUuid(userId) ? userId : null,
    serialNumber,
    status,
  );

  const { data: pass, error: passError } = await getServiceClient()
    .from(PASSES_TABLE)
    .insert(passRow)
    .select("*")
    .single();

  if (passError) {
    if (passError.code === "23505") {
      throw databaseError("A pass with that serial number already exists.", passError);
    }
    throw databaseError("Could not create the pass.", passError);
  }

  const passId = (pass as PassRow).id;
  const client = getServiceClient();

  const fieldRows = fieldsToRows(passId, input.fields);
  if (fieldRows.length > 0) {
    const { error } = await client.from(FIELDS_TABLE).insert(fieldRows);
    if (error) throw databaseError("Could not save pass fields.", error);
  }

  const { error: barcodeError } = await client.from(BARCODES_TABLE).insert({
    pass_id: passId,
    barcode_type: input.barcode.type,
    barcode_value: input.barcode.value,
    alt_text: input.barcode.altText,
  });
  if (barcodeError) throw databaseError("Could not save pass barcode.", barcodeError);

  if (normalizeLocations(input.locations).length > 0) {
    const { error } = await client.from(LOCATIONS_TABLE).insert(locationsToRows(passId, input.locations));
    if (error) throw databaseError("Could not save pass locations.", error);
  }

  return rowToCommonPass(pass as PassRow);
}

export async function updatePass(
  passId: string,
  input: CommonPassInputParsed,
  status?: "draft" | "published" | "archived",
  ownerId?: string | null,
): Promise<CommonPass> {
  if (isMemoryStore()) return memoryUpdatePass(passId, input, status, ownerId);

  const existing = await getPassById(passId);
  if (!existing) throw notFound();

  // Keep whatever user_id is already stored. Do not claim null → cookie owner on save;
  // that made passes vanish from the grid when the anonymous cookie rotated.
  const userId = existing.userId;
  const serialNumber = input.serialNumber?.trim() || existing.serialNumber;
  const passRow = inputToPassRow(input, userId, serialNumber, status ?? existing.status);

  const { error: passError } = await getServiceClient()
    .from(PASSES_TABLE)
    .update(passRow)
    .eq("id", passId);

  if (passError) throw databaseError("Could not update the pass.", passError);

  const client = getServiceClient();

  await client.from(FIELDS_TABLE).delete().eq("pass_id", passId);
  const fieldRows = fieldsToRows(passId, input.fields);
  if (fieldRows.length > 0) {
    const { error } = await client.from(FIELDS_TABLE).insert(fieldRows);
    if (error) throw databaseError("Could not update pass fields.", error);
  }

  await client.from(BARCODES_TABLE).delete().eq("pass_id", passId);
  const { error: barcodeError } = await client.from(BARCODES_TABLE).insert({
    pass_id: passId,
    barcode_type: input.barcode.type,
    barcode_value: input.barcode.value,
    alt_text: input.barcode.altText,
  });
  if (barcodeError) throw databaseError("Could not update pass barcode.", barcodeError);

  await client.from(LOCATIONS_TABLE).delete().eq("pass_id", passId);
  if (normalizeLocations(input.locations).length > 0) {
    const { error } = await client.from(LOCATIONS_TABLE).insert(locationsToRows(passId, input.locations));
    if (error) throw databaseError("Could not update pass locations.", error);
  }

  const updated = await getPassById(passId);
  if (!updated) throw notFound();
  return updated;
}

export async function publishPass(passId: string): Promise<CommonPass> {
  const pass = await getPassById(passId);
  if (!pass) throw notFound();
  return updatePass(passId, commonPassToInput(pass), "published");
}

export async function deletePass(passId: string): Promise<void> {
  if (isMemoryStore()) {
    memoryDeletePass(passId);
    return;
  }

  const { error } = await getServiceClient().from(PASSES_TABLE).delete().eq("id", passId);
  if (error) throw databaseError("Could not delete the pass.", error);
}

export async function upsertWalletInfo(
  passId: string,
  info: Partial<WalletGenerationInfo>,
): Promise<void> {
  if (isMemoryStore()) {
    memoryUpdateWalletInfo(passId, info);
    return;
  }

  const patch: Record<string, unknown> = { pass_id: passId };
  if (info.applePassUrl !== undefined) patch.apple_pass_url = info.applePassUrl;
  if (info.appleSerialNumber !== undefined) patch.apple_serial_number = info.appleSerialNumber;
  if (info.applePassTypeIdentifier !== undefined) patch.apple_pass_type_identifier = info.applePassTypeIdentifier;
  if (info.appleGeneratedAt !== undefined) patch.apple_generated_at = info.appleGeneratedAt;
  if (info.googleClassId !== undefined) patch.google_class_id = info.googleClassId;
  if (info.googleObjectId !== undefined) patch.google_object_id = info.googleObjectId;
  if (info.googleSaveUrl !== undefined) patch.google_save_url = info.googleSaveUrl;
  if (info.googleGeneratedAt !== undefined) patch.google_generated_at = info.googleGeneratedAt;

  const { error } = await getServiceClient()
    .from(WALLET_TABLE)
    .upsert(patch, { onConflict: "pass_id" });

  if (error) throw databaseError("Could not save wallet generation info.", error);
}

export function assertPassOwnership(_pass: CommonPass, _ownerId: string | null): void {
  // Temporary: no user_id ownership checks. Re-enable when multi-user auth ships.
}

export async function loadOwnedPass(passId: string, ownerId: string | null): Promise<CommonPass> {
  const pass = await getPassById(passId);
  if (!pass) throw notFound();
  assertPassOwnership(pass, ownerId);
  return pass;
}

export { isMemoryStore as isUsingMemoryStore };
