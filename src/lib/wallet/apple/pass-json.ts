import { hexToRgba } from "./png";

/**
 * Apple Wallet pass.json types and serialisation helpers.
 */

export type ApplePassStyle = "storeCard" | "generic" | "coupon" | "eventTicket" | "boardingPass";

export interface AppleField {
  key: string;
  label?: string;
  value: string;
  textAlignment?: "PKTextAlignmentLeft" | "PKTextAlignmentCenter" | "PKTextAlignmentRight";
  dateStyle?: "PKDateStyleNone" | "PKDateStyleShort" | "PKDateStyleMedium" | "PKDateStyleLong";
  timeStyle?: "PKDateStyleNone" | "PKDateStyleShort";
  changeMessage?: string;
}

export interface AppleBarcode {
  format: "PKBarcodeFormatQR" | "PKBarcodeFormatPDF417" | "PKBarcodeFormatAztec" | "PKBarcodeFormatCode128";
  message: string;
  messageEncoding: string;
  altText?: string;
}

export interface ApplePassFields {
  headerFields: AppleField[];
  primaryFields: AppleField[];
  secondaryFields: AppleField[];
  auxiliaryFields: AppleField[];
  backFields: AppleField[];
}

export interface ApplePassProps {
  formatVersion: 1;
  passTypeIdentifier: string;
  teamIdentifier: string;
  serialNumber: string;
  organizationName: string;
  description: string;
  logoText: string;
  foregroundColor: string;
  backgroundColor: string;
  labelColor: string;
  sharingProhibited: boolean;
}

export interface AppleLocation {
  latitude: number;
  longitude: number;
  relevantText?: string;
}

export interface ApplePassStructure {
  style: ApplePassStyle;
  props: ApplePassProps;
  fields: ApplePassFields;
  barcodes: AppleBarcode[];
  expirationDate?: string;
  relevantDate?: string;
  locations?: AppleLocation[];
}

/** Apple expects CSS-style RGB triples, not hex, in pass.json. */
export function toAppleColor(hex: string): string {
  const { r, g, b } = hexToRgba(hex);
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Serialises a structure into the object that becomes pass.json. */
export function toPassJson(structure: ApplePassStructure): Record<string, unknown> {
  const json: Record<string, unknown> = {
    ...structure.props,
    barcodes: structure.barcodes,
    [structure.style]: structure.fields,
  };

  if (structure.barcodes.length > 0) {
    json.barcode = structure.barcodes[0];
  }

  if (structure.expirationDate) json.expirationDate = structure.expirationDate;
  if (structure.relevantDate) json.relevantDate = structure.relevantDate;
  if (structure.locations && structure.locations.length > 0) {
    json.locations = structure.locations;
  }

  return json;
}

/** @deprecated Use mapCommonPassToAppleWallet from @/lib/wallet/mappers/apple */
export { mapCommonPassToAppleWallet as buildPassStructure } from "@/lib/wallet/mappers/apple";
