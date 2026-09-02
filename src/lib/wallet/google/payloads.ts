import type { CommonPass } from "@/lib/wallet/common/schema";

export interface LocalizedString {
  defaultValue: { language: string; value: string };
}

export interface GoogleGenericClass {
  id: string;
  hexBackgroundColor: string;
  issuerName: string;
  reviewStatus?: "UNDER_REVIEW" | "APPROVED";
  classTemplateInfo: {
    cardTemplateOverride: {
      cardRowTemplateInfos: unknown[];
    };
  };
  logo?: GoogleImage;
}

export interface GoogleImage {
  sourceUri: { uri: string };
  contentDescription: LocalizedString;
}

export interface GoogleGenericObject {
  id: string;
  classId: string;
  genericType: "GENERIC_TYPE_UNSPECIFIED";
  hexBackgroundColor: string;
  cardTitle: LocalizedString;
  header: LocalizedString;
  subheader: LocalizedString;
  barcode?: {
    type: string;
    value: string;
    alternateText: string;
  };
  textModulesData: Array<{ id: string; header: string; body: string }>;
  logo?: GoogleImage;
  validTimeInterval?: {
    start?: { date: string };
    end?: { date: string };
  };
  locations?: Array<{ latitude: number; longitude: number }>;
  state: "ACTIVE" | "EXPIRED" | "INACTIVE";
}

export function buildSaveJwtClaims(input: {
  issuerEmail: string;
  origins: string[];
  genericObject: GoogleGenericObject;
  issuedAt?: number;
}): Record<string, unknown> {
  return {
    iss: input.issuerEmail,
    aud: "google",
    typ: "savetowallet",
    iat: input.issuedAt ?? Math.floor(Date.now() / 1000),
    origins: input.origins,
    payload: {
      genericObjects: [input.genericObject],
    },
  };
}

export function buildSaveUrl(token: string): string {
  return `https://pay.google.com/gp/v/save/${token}`;
}

/** @deprecated Use mapCommonPassToGoogleWallet from @/lib/wallet/mappers/google */
export { mapCommonPassToGoogleWallet as buildGenericObject, mapCommonPassToGoogleClass as buildGenericClass } from "@/lib/wallet/mappers/google";

export type { CommonPass };
