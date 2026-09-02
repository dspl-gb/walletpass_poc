import type { CommonPassInputParsed } from "./validation";
import type { PassLocation } from "./schema";

/** Default coords from "Add Location" — not valid for Apple Wallet geofencing. */
export function isPlaceholderLocation(location: Pick<PassLocation, "latitude" | "longitude">): boolean {
  return location.latitude === 0 && location.longitude === 0;
}

export function normalizeLocations(locations: PassLocation[]): PassLocation[] {
  return locations.filter((location) => !isPlaceholderLocation(location));
}

/** Cleans form input before validation/persistence. */
export function normalizePassInputData(input: CommonPassInputParsed): CommonPassInputParsed {
  return {
    ...input,
    locations: normalizeLocations(input.locations),
  };
}
