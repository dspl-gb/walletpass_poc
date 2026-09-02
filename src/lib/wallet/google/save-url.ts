import "server-only";

import jwt from "jsonwebtoken";

import { getAppBaseUrl, type GoogleConfig } from "@/lib/config/env";
import { passGenerationFailed } from "@/lib/wallet/common/errors";

import { buildSaveJwtClaims, buildSaveUrl, type GoogleGenericObject } from "./payloads";

export function createGoogleSaveUrl(config: GoogleConfig, genericObject: GoogleGenericObject): string {
  const origin = getAppBaseUrl().replace(/\/$/, "");

  const claims = buildSaveJwtClaims({
    issuerEmail: config.serviceAccountEmail,
    origins: [origin],
    genericObject,
  });

  try {
    const token = jwt.sign(claims, config.serviceAccountPrivateKey, {
      algorithm: "RS256",
      noTimestamp: true,
    });
    return buildSaveUrl(token);
  } catch (error) {
    throw passGenerationFailed(
      "We could not build the Google Wallet save link. Please try again in a moment.",
      error,
    );
  }
}
