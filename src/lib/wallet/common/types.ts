import type {
  CommonPass,
  FieldGroup,
  PassBarcode,
  PassField,
  PassFields,
  PassLocation,
  PassType,
  PassValidity,
  WalletGenerationInfo,
} from "@/lib/wallet/common/schema";

/** Row from the `passes` table. */
export interface PassRow {
  id: string;
  user_id: string | null;
  name: string;
  pass_type: PassType;
  organization_name: string;
  description: string;
  logo_text: string;
  background_color: string;
  foreground_color: string;
  label_color: string;
  logo_url: string | null;
  strip_url: string | null;
  thumbnail_url: string | null;
  background_url: string | null;
  serial_number: string;
  relevant_date: string | null;
  expiration_date: string | null;
  valid_from: string | null;
  valid_until: string | null;
  relevant_date_enabled: boolean;
  expiration_date_enabled: boolean;
  valid_from_enabled: boolean;
  valid_until_enabled: boolean;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
}

export interface PassFieldRow {
  id: string;
  pass_id: string;
  field_group: FieldGroup;
  field_key: string;
  label: string;
  value: string;
  text_alignment: "left" | "center" | "right";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PassBarcodeRow {
  id: string;
  pass_id: string;
  barcode_type: PassBarcode["type"];
  barcode_value: string;
  alt_text: string;
  created_at: string;
  updated_at: string;
}

export interface PassLocationRow {
  id: string;
  pass_id: string;
  latitude: number;
  longitude: number;
  relevant_text: string;
  created_at: string;
  updated_at: string;
}

export interface WalletPassRow {
  id: string;
  pass_id: string;
  apple_pass_url: string | null;
  apple_serial_number: string | null;
  apple_pass_type_identifier: string | null;
  apple_generated_at: string | null;
  google_class_id: string | null;
  google_object_id: string | null;
  google_save_url: string | null;
  google_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToPassField(row: PassFieldRow): PassField {
  return {
    id: row.id,
    key: row.field_key,
    label: row.label,
    value: row.value,
    textAlignment: row.text_alignment,
    sortOrder: row.sort_order,
  };
}

export function rowToPassLocation(row: PassLocationRow): PassLocation {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    relevantText: row.relevant_text,
  };
}

export function rowToWalletInfo(row: WalletPassRow): WalletGenerationInfo {
  return {
    id: row.id,
    passId: row.pass_id,
    applePassUrl: row.apple_pass_url,
    appleSerialNumber: row.apple_serial_number,
    applePassTypeIdentifier: row.apple_pass_type_identifier,
    appleGeneratedAt: row.apple_generated_at,
    googleClassId: row.google_class_id,
    googleObjectId: row.google_object_id,
    googleSaveUrl: row.google_save_url,
    googleGeneratedAt: row.google_generated_at,
  };
}

export function assembleCommonPass(
  row: PassRow,
  fields: PassFieldRow[],
  barcode: PassBarcodeRow | null,
  locations: PassLocationRow[],
  wallet: WalletPassRow | null,
): CommonPass {
  const grouped: PassFields = {
    header: [],
    primary: [],
    secondary: [],
    auxiliary: [],
    back: [],
  };

  for (const field of fields.sort((a, b) => a.sort_order - b.sort_order)) {
    grouped[field.field_group].push(rowToPassField(field));
  }

  const validity: PassValidity = {
    relevantDate: row.relevant_date,
    expirationDate: row.expiration_date,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    relevantDateEnabled: row.relevant_date_enabled,
    expirationDateEnabled: row.expiration_date_enabled,
    validFromEnabled: row.valid_from_enabled,
    validUntilEnabled: row.valid_until_enabled,
  };

  const barcodeData: PassBarcode = barcode
    ? { type: barcode.barcode_type, value: barcode.barcode_value, altText: barcode.alt_text }
    : { type: "QR", value: "", altText: "" };

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    passType: row.pass_type,
    organization: {
      name: row.organization_name,
      description: row.description,
      logoText: row.logo_text,
    },
    appearance: {
      backgroundColor: row.background_color,
      foregroundColor: row.foreground_color,
      labelColor: row.label_color,
      logo: row.logo_url,
      strip: row.strip_url,
      thumbnail: row.thumbnail_url,
      background: row.background_url,
    },
    fields: grouped,
    barcode: barcodeData,
    validity,
    locations: locations.map(rowToPassLocation),
    serialNumber: row.serial_number,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    walletInfo: wallet ? rowToWalletInfo(wallet) : null,
  };
}

export type { CommonPass, PassType, PassStatus, FieldGroup, PassField, PassBarcode, PassLocation, WalletGenerationInfo } from "./schema";

export type WalletEventPlatform = "apple" | "google" | "system";

export type WalletEventType =
  | "pass_created"
  | "pass_updated"
  | "pass_published"
  | "apple_button_clicked"
  | "apple_pass_generated"
  | "apple_pass_generation_failed"
  | "google_button_clicked"
  | "google_save_url_generated"
  | "google_generation_failed";

export interface WalletEvent {
  id: string;
  pass_id: string;
  platform: WalletEventPlatform;
  event_type: WalletEventType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WalletConfigStatus {
  mockMode: boolean;
  supabaseConfigured: boolean;
  appleConfigured: boolean;
  googleConfigured: boolean;
}

export type AppleGenerationResult =
  | { mode: "real"; buffer: Buffer; fileName: string; serialNumber: string; signed: boolean }
  | { mode: "mock"; fileName: string; serialNumber: string; reason: string };

export type GoogleGenerationResult =
  | { mode: "real"; saveUrl: string; objectId: string; classId: string }
  | { mode: "mock"; saveUrl: string; objectId: string; reason: string };
