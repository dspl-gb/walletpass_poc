import type { CommonPass } from "@/lib/wallet/common/schema";
import { formatExpirationDate } from "@/lib/wallet/common/pass";
import type { GoogleGenericClass, GoogleGenericObject, GoogleImage, LocalizedString } from "@/lib/wallet/google/payloads";

const BARCODE_TYPE_MAP = {
  QR: "QR_CODE",
  PDF417: "PDF_417",
  Aztec: "AZTEC",
  Code128: "CODE_128",
} as const;

function localized(value: string, language = "en-US"): LocalizedString {
  return { defaultValue: { language, value } };
}

function logoFromUrl(uri: string, description: string): GoogleImage {
  return {
    sourceUri: { uri },
    contentDescription: localized(description),
  };
}

function buildTextModules(pass: CommonPass): Array<{ id: string; header: string; body: string }> {
  const modules: Array<{ id: string; header: string; body: string }> = [];

  const addFromGroup = (group: keyof CommonPass["fields"], prefix: string) => {
    const sorted = [...pass.fields[group]].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const field of sorted) {
      if (!field.value) continue;
      modules.push({
        id: `${prefix}_${field.key}`,
        header: field.label || field.key,
        body: field.value,
      });
    }
  };

  addFromGroup("header", "header");
  addFromGroup("primary", "primary");
  addFromGroup("secondary", "secondary");
  addFromGroup("auxiliary", "auxiliary");
  addFromGroup("back", "back");

  if (pass.validity.expirationDateEnabled && pass.validity.expirationDate) {
    modules.push({
      id: "expires",
      header: "EXPIRES",
      body: formatExpirationDate(pass.validity.expirationDate),
    });
  }

  return modules;
}

function primaryHeaderValue(pass: CommonPass): string {
  const primary = [...pass.fields.primary].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return primary?.value || pass.name;
}

function secondaryHeaderValue(pass: CommonPass): string {
  const secondary = [...pass.fields.secondary].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return secondary?.value || pass.organization.description || pass.name;
}

export interface GoogleMapperOptions {
  classId: string;
  objectId: string;
}

/**
 * Maps the common pass schema to a Google Wallet generic class.
 */
export function mapCommonPassToGoogleClass(
  pass: CommonPass,
  options: Pick<GoogleMapperOptions, "classId">,
): GoogleGenericClass {
  const payload: GoogleGenericClass = {
    id: options.classId,
    hexBackgroundColor: pass.appearance.backgroundColor,
    issuerName: pass.organization.name,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['primary_0']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['secondary_0']" }],
                },
              },
            },
          },
        ],
      },
    },
  };

  if (pass.appearance.logo) {
    payload.logo = logoFromUrl(pass.appearance.logo, `${pass.organization.name} logo`);
  }

  return payload;
}

/**
 * Maps the common pass schema to a Google Wallet generic object.
 */
export function mapCommonPassToGoogleWallet(
  pass: CommonPass,
  options: GoogleMapperOptions,
): GoogleGenericObject {
  const textModules = buildTextModules(pass);
  const expired = pass.status === "archived";
  const inactive = pass.status !== "published";

  const payload: GoogleGenericObject = {
    id: options.objectId,
    classId: options.classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: pass.appearance.backgroundColor,
    cardTitle: localized(pass.organization.name),
    header: localized(primaryHeaderValue(pass)),
    subheader: localized(secondaryHeaderValue(pass)),
    textModulesData: textModules,
    state: expired ? "EXPIRED" : inactive ? "INACTIVE" : "ACTIVE",
  };

  if (pass.barcode.value) {
    payload.barcode = {
      type: BARCODE_TYPE_MAP[pass.barcode.type],
      value: pass.barcode.value,
      alternateText: pass.barcode.altText || pass.serialNumber,
    };
  }

  if (pass.appearance.logo) {
    payload.logo = logoFromUrl(pass.appearance.logo, `${pass.organization.name} logo`);
  }

  const validInterval: GoogleGenericObject["validTimeInterval"] = {};
  if (pass.validity.validFromEnabled && pass.validity.validFrom) {
    validInterval.start = { date: pass.validity.validFrom };
  }
  if (pass.validity.expirationDateEnabled && pass.validity.expirationDate) {
    validInterval.end = { date: pass.validity.expirationDate };
  } else if (pass.validity.validUntilEnabled && pass.validity.validUntil) {
    validInterval.end = { date: pass.validity.validUntil };
  }
  if (validInterval.start || validInterval.end) {
    payload.validTimeInterval = validInterval;
  }

  if (pass.locations.length > 0) {
    payload.locations = pass.locations.map((loc) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));
  }

  return payload;
}
