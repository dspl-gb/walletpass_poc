import type { CommonPass, PassType } from "@/lib/wallet/common/schema";
import { passTypeToAppleStyle } from "@/lib/wallet/common/schema";
import { formatExpirationDate } from "@/lib/wallet/common/pass";
import { isPlaceholderLocation } from "@/lib/wallet/common/normalize";
import { toAppleColor } from "@/lib/wallet/apple/pass-json";
import type {
  AppleBarcode,
  AppleField,
  ApplePassFields,
  ApplePassProps,
  ApplePassStructure,
  ApplePassStyle,
} from "@/lib/wallet/apple/pass-json";

const BARCODE_FORMAT_MAP = {
  QR: "PKBarcodeFormatQR",
  PDF417: "PKBarcodeFormatPDF417",
  Aztec: "PKBarcodeFormatAztec",
  Code128: "PKBarcodeFormatCode128",
} as const;

const ALIGNMENT_MAP = {
  left: "PKTextAlignmentLeft",
  center: "PKTextAlignmentCenter",
  right: "PKTextAlignmentRight",
} as const;

type FieldGroup = keyof CommonPass["fields"];

function resolveFieldValue(
  field: CommonPass["fields"]["header"][number],
  pass: CommonPass,
  group: FieldGroup,
  indexInGroup: number,
): string {
  const trimmed = field.value.trim();
  if (trimmed) return trimmed;

  // Match preview + Google Wallet: the main primary title falls back when empty.
  if (group !== "primary" || indexInGroup !== 0) return "";

  const passName = pass.name.trim();
  if (passName) return passName;

  if (pass.passType === "coupon") {
    const offer = [...pass.fields.secondary]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((f) => f.key === "offer");
    if (offer?.value.trim()) return offer.value.trim();
  }

  const headerValue = [...pass.fields.header]
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    ?.value.trim();
  if (headerValue) return headerValue;

  const description = pass.organization.description?.trim();
  if (description) return description;

  return "";
}

function mapField(
  field: CommonPass["fields"]["header"][number],
  pass: CommonPass,
  group: FieldGroup,
  indexInGroup: number,
): AppleField {
  const appleField: AppleField = {
    key: field.key,
    label: field.label || undefined,
    value: resolveFieldValue(field, pass, group, indexInGroup),
  };
  if (field.textAlignment) {
    appleField.textAlignment = ALIGNMENT_MAP[field.textAlignment];
  }
  return appleField;
}

function mapFields(fields: CommonPass["fields"]["header"], pass: CommonPass, group: FieldGroup): AppleField[] {
  return [...fields]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((field, index) => mapField(field, pass, group, index));
}

function pushBackField(
  backFields: AppleField[],
  usedKeys: Set<string>,
  key: string,
  label: string,
  value: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return;

  let fieldKey = key;
  while (usedKeys.has(fieldKey)) fieldKey = `${fieldKey}_detail`;
  usedKeys.add(fieldKey);

  backFields.push({
    key: fieldKey,
    label,
    value: trimmed,
  });
}

function buildBackFieldFallbacks(pass: CommonPass): AppleField[] {
  const usedKeys = new Set<string>();
  const backFields: AppleField[] = [];

  function appendExplicitBackFields() {
    for (const field of [...pass.fields.back].sort((a, b) => a.sortOrder - b.sortOrder)) {
      pushBackField(backFields, usedKeys, field.key, field.label || "Details", field.value);
    }
  }

  function appendMirroredFields(
    fields: CommonPass["fields"]["header"],
    group: FieldGroup,
    groupLabel: string,
  ) {
    for (const [index, field] of [...fields].sort((a, b) => a.sortOrder - b.sortOrder).entries()) {
      const value = resolveFieldValue(field, pass, group, index);
      if (!value) continue;

      const label = field.label?.trim();
      pushBackField(
        backFields,
        usedKeys,
        field.key || `${groupLabel.toLowerCase()}_${index}`,
        label ? `${label} (${groupLabel})` : groupLabel,
        value,
      );
    }
  }

  appendExplicitBackFields();
  appendMirroredFields(pass.fields.header, "header", "HEADER");
  appendMirroredFields(pass.fields.primary, "primary", "PRIMARY");
  appendMirroredFields(pass.fields.secondary, "secondary", "SECONDARY");
  appendMirroredFields(pass.fields.auxiliary, "auxiliary", "AUXILIARY");

  pushBackField(backFields, usedKeys, "pass_name", "PASS", pass.name);
  pushBackField(backFields, usedKeys, "serial_number", "SERIAL NUMBER", pass.serialNumber);

  const description = pass.organization.description?.trim();
  if (description && description !== pass.name) {
    pushBackField(backFields, usedKeys, "description", "DESCRIPTION", description);
  }

  const { validity } = pass;
  if (validity.relevantDateEnabled && validity.relevantDate) {
    pushBackField(
      backFields,
      usedKeys,
      "validity_relevant",
      "RELEVANT DATE",
      formatExpirationDate(validity.relevantDate),
    );
  }
  if (validity.validFromEnabled && validity.validFrom) {
    pushBackField(
      backFields,
      usedKeys,
      "validity_from",
      "VALID FROM",
      formatExpirationDate(validity.validFrom),
    );
  }
  if (validity.validUntilEnabled && validity.validUntil) {
    pushBackField(
      backFields,
      usedKeys,
      "validity_until",
      "VALID UNTIL",
      formatExpirationDate(validity.validUntil),
    );
  }
  if (validity.expirationDateEnabled && validity.expirationDate) {
    pushBackField(
      backFields,
      usedKeys,
      "validity_expires",
      "EXPIRES",
      formatExpirationDate(validity.expirationDate),
    );
  }

  for (const [index, location] of pass.locations.filter((loc) => !isPlaceholderLocation(loc)).entries()) {
    const coords = `${location.latitude}, ${location.longitude}`;
    const value = location.relevantText?.trim()
      ? `${location.relevantText.trim()} (${coords})`
      : coords;
    pushBackField(backFields, usedKeys, `location_${index}`, "LOCATION", value);
  }

  if (pass.barcode.altText?.trim()) {
    pushBackField(backFields, usedKeys, "barcode_alt", "BARCODE", pass.barcode.altText);
  }

  return backFields;
}

function mapBarcodes(pass: CommonPass): AppleBarcode[] {
  if (!pass.barcode.value) return [];
  return [
    {
      format: BARCODE_FORMAT_MAP[pass.barcode.type],
      message: pass.barcode.value,
      messageEncoding: "iso-8859-1",
      altText: pass.barcode.altText || undefined,
    },
  ];
}

function mapLocations(pass: CommonPass): Array<{ latitude: number; longitude: number; relevantText?: string }> {
  return pass.locations
    .filter((loc) => !isPlaceholderLocation(loc))
    .map((loc) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      relevantText: loc.relevantText?.trim() || undefined,
    }));
}

export interface AppleMapperOptions {
  serialNumber: string;
  passTypeIdentifier: string;
  teamIdentifier: string;
}

/**
 * Maps the common pass schema to an Apple Wallet pass structure.
 * All field content comes from the saved pass data — no hardcoded values.
 */
export function mapCommonPassToAppleWallet(
  pass: CommonPass,
  options: AppleMapperOptions,
): ApplePassStructure {
  const { appearance, organization, validity } = pass;

  const props: ApplePassProps = {
    formatVersion: 1,
    passTypeIdentifier: options.passTypeIdentifier,
    teamIdentifier: options.teamIdentifier,
    serialNumber: options.serialNumber,
    organizationName: organization.name,
    description: organization.description || `${organization.name} ${pass.name}`,
    logoText: organization.logoText || organization.name,
    foregroundColor: toAppleColor(appearance.foregroundColor),
    backgroundColor: toAppleColor(appearance.backgroundColor),
    labelColor: toAppleColor(appearance.labelColor),
    sharingProhibited: true,
  };

  const fields: ApplePassFields = {
    headerFields: mapFields(pass.fields.header, pass, "header"),
    primaryFields: mapFields(pass.fields.primary, pass, "primary"),
    secondaryFields: mapFields(pass.fields.secondary, pass, "secondary"),
    auxiliaryFields: mapFields(pass.fields.auxiliary, pass, "auxiliary"),
    backFields: buildBackFieldFallbacks(pass),
  };

  const structure: ApplePassStructure = {
    style: passTypeToAppleStyle(pass.passType) as ApplePassStyle,
    props,
    fields,
    barcodes: mapBarcodes(pass),
    locations: mapLocations(pass),
  };

  if (validity.expirationDateEnabled && validity.expirationDate) {
    structure.expirationDate = validity.expirationDate;
  }

  if (validity.relevantDateEnabled && validity.relevantDate) {
    structure.relevantDate = validity.relevantDate;
  }

  return structure;
}

export function appleStyleForPassType(passType: PassType): ApplePassStyle {
  return passTypeToAppleStyle(passType) as ApplePassStyle;
}
