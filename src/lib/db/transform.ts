import type { CommonPass, PassField, PassLocation } from "@/lib/wallet/common/schema";
import type { CommonPassInputParsed } from "@/lib/wallet/common/validation";
import type { PassRow } from "@/lib/wallet/common/types";
import { normalizeLocations } from "@/lib/wallet/common/normalize";

export function inputToPassRow(
  input: CommonPassInputParsed,
  userId: string | null,
  serialNumber: string,
  status: "draft" | "published" | "archived" = "draft",
): Omit<PassRow, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    name: input.name,
    pass_type: input.passType,
    organization_name: input.organization.name,
    description: input.organization.description,
    logo_text: input.organization.logoText,
    background_color: input.appearance.backgroundColor,
    foreground_color: input.appearance.foregroundColor,
    label_color: input.appearance.labelColor,
    logo_url: input.appearance.logo ?? null,
    strip_url: input.appearance.strip ?? null,
    thumbnail_url: input.appearance.thumbnail ?? null,
    background_url: input.appearance.background ?? null,
    serial_number: serialNumber,
    relevant_date: input.validity.relevantDateEnabled ? input.validity.relevantDate : null,
    expiration_date: input.validity.expirationDateEnabled ? input.validity.expirationDate : null,
    valid_from: input.validity.validFromEnabled ? input.validity.validFrom : null,
    valid_until: input.validity.validUntilEnabled ? input.validity.validUntil : null,
    relevant_date_enabled: input.validity.relevantDateEnabled,
    expiration_date_enabled: input.validity.expirationDateEnabled,
    valid_from_enabled: input.validity.validFromEnabled,
    valid_until_enabled: input.validity.validUntilEnabled,
    status,
  };
}

export function fieldsToRows(
  passId: string,
  fields: CommonPass["fields"],
): Array<{
  pass_id: string;
  field_group: string;
  field_key: string;
  label: string;
  value: string;
  text_alignment: string;
  sort_order: number;
}> {
  const rows: Array<{
    pass_id: string;
    field_group: string;
    field_key: string;
    label: string;
    value: string;
    text_alignment: string;
    sort_order: number;
  }> = [];

  for (const [group, groupFields] of Object.entries(fields)) {
    for (const field of groupFields as PassField[]) {
      rows.push({
        pass_id: passId,
        field_group: group,
        field_key: field.key,
        label: field.label,
        value: field.value,
        text_alignment: field.textAlignment,
        sort_order: field.sortOrder,
      });
    }
  }

  return rows;
}

export function locationsToRows(
  passId: string,
  locations: PassLocation[],
): Array<{ pass_id: string; latitude: number; longitude: number; relevant_text: string }> {
  return normalizeLocations(locations).map((loc) => ({
    pass_id: passId,
    latitude: loc.latitude,
    longitude: loc.longitude,
    relevant_text: loc.relevantText,
  }));
}

export function commonPassToInput(pass: CommonPass): CommonPassInputParsed {
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
  };
}
