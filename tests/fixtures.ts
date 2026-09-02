import type { CommonPass } from "@/lib/wallet/common/schema";
import { defaultFieldsForType } from "@/lib/wallet/common/defaults";

import type { CommonPassInputParsed } from "@/lib/wallet/common/validation";

export const OWNER_A = "11111111-1111-4111-8111-111111111111";
export const OWNER_B = "22222222-2222-4222-8222-222222222222";

export function samplePassInput(overrides: Partial<CommonPassInputParsed> = {}): CommonPassInputParsed {
  const pass = samplePass();
  return {
    name: pass.name,
    passType: pass.passType,
    organization: pass.organization,
    appearance: pass.appearance,
    fields: pass.fields,
    barcode: pass.barcode,
    validity: pass.validity,
    locations: pass.locations,
    serialNumber: pass.serialNumber,
    status: pass.status,
    ...overrides,
  };
}

export function samplePass(overrides: Partial<CommonPass> = {}): CommonPass {
  const now = "2026-08-14T12:00:00.000Z";
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: OWNER_A,
    name: "Premium Membership",
    passType: "loyalty",
    organization: {
      name: "Demo Company",
      description: "Demo Company Premium Membership",
      logoText: "Demo",
    },
    appearance: {
      backgroundColor: "#0D5C3D",
      foregroundColor: "#FFFFFF",
      labelColor: "#B7E4C7",
      logo: null,
      strip: null,
      thumbnail: null,
      background: null,
    },
    fields: {
      ...defaultFieldsForType("loyalty"),
      primary: [{ key: "member", label: "MEMBER", value: "Demo Member", textAlignment: "left", sortOrder: 0 }],
      secondary: [
        { key: "memberId", label: "MEMBER ID", value: "DEMO-001", textAlignment: "left", sortOrder: 0 },
        { key: "passType", label: "MEMBERSHIP", value: "Premium Membership", textAlignment: "right", sortOrder: 1 },
      ],
      header: [{ key: "status", label: "STATUS", value: "Active", textAlignment: "right", sortOrder: 0 }],
    },
    barcode: { type: "QR", value: "MEMBER:DEMO-001", altText: "DEMO-001" },
    validity: {
      relevantDate: null,
      expirationDate: "2027-08-14T12:00:00.000Z",
      validFrom: null,
      validUntil: null,
      relevantDateEnabled: false,
      expirationDateEnabled: true,
      validFromEnabled: false,
      validUntilEnabled: false,
    },
    locations: [],
    serialNumber: "DEMO-001",
    status: "published",
    createdAt: now,
    updatedAt: now,
    walletInfo: null,
    ...overrides,
  };
}
