import type {
  CommonPass,
  CommonPassInput,
  PassBarcode,
  PassField,
  PassFields,
  PassType,
  PassValidity,
} from "./schema";

export const DEFAULT_COLORS = {
  backgroundColor: "#0D5C3D",
  foregroundColor: "#FFFFFF",
  labelColor: "#B7E4C7",
};

export const DEFAULT_VALIDITY: PassValidity = {
  relevantDate: null,
  expirationDate: null,
  validFrom: null,
  validUntil: null,
  relevantDateEnabled: false,
  expirationDateEnabled: false,
  validFromEnabled: false,
  validUntilEnabled: false,
};

export const DEFAULT_BARCODE: PassBarcode = {
  type: "QR",
  value: "",
  altText: "",
};

export function emptyFields(): PassFields {
  return {
    header: [],
    primary: [],
    secondary: [],
    auxiliary: [],
    back: [],
  };
}

export function createField(
  partial: Partial<PassField> & Pick<PassField, "key" | "label" | "value">,
  sortOrder: number,
): PassField {
  return {
    key: partial.key,
    label: partial.label,
    value: partial.value,
    textAlignment: partial.textAlignment ?? "left",
    sortOrder,
  };
}

/** Default fields for a new pass based on pass type. */
export function defaultFieldsForType(passType: PassType): PassFields {
  const base: PassFields = {
    header: [createField({ key: "header", label: "HEADER", value: "" }, 0)],
    primary: [createField({ key: "primary", label: "TITLE", value: "" }, 0)],
    secondary: [],
    auxiliary: [],
    back: [createField({ key: "info", label: "Information", value: "" }, 0)],
  };

  switch (passType) {
    case "loyalty":
      base.secondary = [
        createField({ key: "memberId", label: "MEMBER ID", value: "" }, 0),
        createField({ key: "tier", label: "TIER", value: "" }, 1),
      ];
      break;
    case "coupon":
      base.primary = [createField({ key: "primary", label: "COUPON", value: "" }, 0)];
      base.secondary = [
        createField({ key: "offer", label: "OFFER", value: "" }, 0),
        createField({ key: "expires", label: "EXPIRES", value: "" }, 1),
      ];
      break;
    case "eventTicket":
      base.secondary = [
        createField({ key: "event", label: "EVENT", value: "" }, 0),
        createField({ key: "date", label: "DATE", value: "" }, 1),
      ];
      break;
    case "boardingPass":
      base.secondary = [
        createField({ key: "origin", label: "FROM", value: "" }, 0),
        createField({ key: "destination", label: "TO", value: "" }, 1),
      ];
      base.auxiliary = [
        createField({ key: "gate", label: "GATE", value: "" }, 0),
        createField({ key: "seat", label: "SEAT", value: "" }, 1),
      ];
      break;
    default:
      base.secondary = [
        createField({ key: "field1", label: "FIELD 1", value: "" }, 0),
        createField({ key: "field2", label: "FIELD 2", value: "" }, 1),
      ];
  }

  return base;
}

export function createEmptyPassInput(
  overrides: Partial<CommonPassInput> = {},
): Omit<CommonPassInput, "userId"> {
  const passType = overrides.passType ?? "generic";
  return {
    name: "",
    passType,
    organization: {
      name: "",
      description: "",
      logoText: "",
      ...overrides.organization,
    },
    appearance: {
      ...DEFAULT_COLORS,
      logo: null,
      strip: null,
      thumbnail: null,
      background: null,
      ...overrides.appearance,
    },
    fields: overrides.fields ?? defaultFieldsForType(passType),
    barcode: { ...DEFAULT_BARCODE, ...overrides.barcode },
    validity: { ...DEFAULT_VALIDITY, ...overrides.validity },
    locations: overrides.locations ?? [],
    serialNumber: overrides.serialNumber ?? "",
    status: overrides.status ?? "draft",
    ...overrides,
  };
}

export function createEmptyPass(
  id: string,
  userId: string | null,
  overrides: Partial<CommonPassInput> = {},
): CommonPass {
  const now = new Date().toISOString();
  const input = createEmptyPassInput(overrides);
  return {
    id,
    userId,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}
