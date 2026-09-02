import "server-only";

import type { GoogleConfig } from "@/lib/config/env";
import { generateGoogleObjectId } from "@/lib/wallet/common/identifiers";
import { providerError } from "@/lib/wallet/common/errors";
import type { CommonPass } from "@/lib/wallet/common/schema";
import { mapCommonPassToGoogleWallet } from "@/lib/wallet/mappers/google";

import { classIdFor } from "./class";
import { isWalletHttpError, walletApi } from "./client";
import type { GoogleGenericObject } from "./payloads";

export function objectIdFor(pass: CommonPass, config: GoogleConfig): string {
  return pass.walletInfo?.googleObjectId ?? generateGoogleObjectId(config.issuerId, pass.serialNumber);
}

export async function ensureGenericObject(
  pass: CommonPass,
  config: GoogleConfig,
  classId = classIdFor(config),
): Promise<GoogleGenericObject> {
  const objectId = objectIdFor(pass, config);
  const encoded = encodeURIComponent(objectId);
  const payload = mapCommonPassToGoogleWallet(pass, { classId, objectId });

  if (pass.walletInfo?.googleObjectId) {
    try {
      const existing = await walletApi<GoogleGenericObject>(`/genericObject/${encoded}`);
      return existing;
    } catch (error) {
      if (!isWalletHttpError(error) || error.status !== 404) {
        throw providerError(
          "We could not load your Google Wallet pass. Please try again in a moment.",
          error,
        );
      }
    }
  }

  try {
    return await walletApi<GoogleGenericObject>("/genericObject", {
      method: "POST",
      body: payload,
    });
  } catch (error) {
    if (isWalletHttpError(error) && error.status === 409) {
      try {
        return await walletApi<GoogleGenericObject>(`/genericObject/${encoded}`);
      } catch (lookupError) {
        throw providerError(
          "A Google Wallet pass already exists for this serial number, but it could not be loaded.",
          lookupError,
        );
      }
    }
    throw providerError(
      "We could not create your Google Wallet pass. Please try again in a moment.",
      error,
    );
  }
}
