/** Common pass schema — single source of truth for form, DB, and wallet mappers. */

export const PASS_TYPES = [
  "generic",
  "loyalty",
  "coupon",
  "eventTicket",
  "boardingPass",
] as const;

export type PassType = (typeof PASS_TYPES)[number];

export const PASS_STATUSES = ["draft", "published", "archived"] as const;
export type PassStatus = (typeof PASS_STATUSES)[number];

export const FIELD_GROUPS = ["header", "primary", "secondary", "auxiliary", "back"] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

export const TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
export type TextAlignment = (typeof TEXT_ALIGNMENTS)[number];

export const BARCODE_TYPES = ["QR", "PDF417", "Aztec", "Code128"] as const;
export type BarcodeType = (typeof BARCODE_TYPES)[number];

export interface PassField {
  id?: string;
  key: string;
  label: string;
  value: string;
  textAlignment: TextAlignment;
  sortOrder: number;
}

export interface PassLocation {
  id?: string;
  latitude: number;
  longitude: number;
  relevantText: string;
}

export interface PassBarcode {
  type: BarcodeType;
  value: string;
  altText: string;
}

export interface PassValidity {
  relevantDate: string | null;
  expirationDate: string | null;
  validFrom: string | null;
  validUntil: string | null;
  relevantDateEnabled: boolean;
  expirationDateEnabled: boolean;
  validFromEnabled: boolean;
  validUntilEnabled: boolean;
}

export interface PassAppearance {
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  logo: string | null;
  strip: string | null;
  thumbnail: string | null;
  background: string | null;
}

export interface PassOrganization {
  name: string;
  description: string;
  logoText: string;
}

export interface PassFields {
  header: PassField[];
  primary: PassField[];
  secondary: PassField[];
  auxiliary: PassField[];
  back: PassField[];
}

export interface WalletGenerationInfo {
  id?: string;
  passId: string;
  applePassUrl: string | null;
  appleSerialNumber: string | null;
  applePassTypeIdentifier: string | null;
  appleGeneratedAt: string | null;
  googleClassId: string | null;
  googleObjectId: string | null;
  googleSaveUrl: string | null;
  googleGeneratedAt: string | null;
}

/** The unified pass object used across form, API, and wallet generation. */
export interface CommonPass {
  id: string;
  userId: string | null;
  name: string;
  passType: PassType;
  organization: PassOrganization;
  appearance: PassAppearance;
  fields: PassFields;
  barcode: PassBarcode;
  validity: PassValidity;
  locations: PassLocation[];
  serialNumber: string;
  status: PassStatus;
  createdAt: string;
  updatedAt: string;
  walletInfo?: WalletGenerationInfo | null;
}

export type CommonPassInput = Omit<CommonPass, "id" | "createdAt" | "updatedAt" | "walletInfo"> & {
  id?: string;
};

/** Maps pass type to Apple Wallet style key. */
export function passTypeToAppleStyle(passType: PassType): string {
  const map: Record<PassType, string> = {
    generic: "generic",
    loyalty: "storeCard",
    coupon: "coupon",
    eventTicket: "eventTicket",
    boardingPass: "boardingPass",
  };
  return map[passType];
}

/** Human-readable pass type label. */
export function passTypeLabel(passType: PassType): string {
  const map: Record<PassType, string> = {
    generic: "Generic",
    loyalty: "Loyalty / Store Card",
    coupon: "Coupon / Offer",
    eventTicket: "Event Ticket",
    boardingPass: "Boarding Pass",
  };
  return map[passType];
}
