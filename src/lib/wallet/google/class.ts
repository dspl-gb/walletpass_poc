import "server-only";

import type { GoogleConfig } from "@/lib/config/env";
import { buildGoogleClassId } from "@/lib/wallet/common/identifiers";
import { providerError } from "@/lib/wallet/common/errors";
import type { CommonPass } from "@/lib/wallet/common/schema";
import { mapCommonPassToGoogleClass } from "@/lib/wallet/mappers/google";

import { isWalletHttpError, walletApi } from "./client";
import type { GoogleGenericClass } from "./payloads";

const ensuredClasses = new Set<string>();

export function classIdFor(config: GoogleConfig): string {
  return buildGoogleClassId(config.issuerId, config.classSuffix);
}

export async function ensureGenericClass(
  config: GoogleConfig,
  pass: CommonPass,
): Promise<GoogleGenericClass> {
  const classId = classIdFor(config);
  const encoded = encodeURIComponent(classId);

  if (ensuredClasses.has(classId)) {
    try {
      return await walletApi<GoogleGenericClass>(`/genericClass/${encoded}`);
    } catch {
      ensuredClasses.delete(classId);
    }
  }

  try {
    const existing = await walletApi<GoogleGenericClass>(`/genericClass/${encoded}`);
    ensuredClasses.add(classId);
    return existing;
  } catch (error) {
    if (!isWalletHttpError(error) || error.status !== 404) {
      throw providerError(
        "We could not reach the Google Wallet class for this pass. Please try again in a moment.",
        error,
      );
    }
  }

  const payload = mapCommonPassToGoogleClass(pass, { classId });

  try {
    const created = await walletApi<GoogleGenericClass>("/genericClass", {
      method: "POST",
      body: payload,
    });
    ensuredClasses.add(classId);
    return created;
  } catch (error) {
    if (isWalletHttpError(error) && error.status === 409) {
      const existing = await walletApi<GoogleGenericClass>(`/genericClass/${encoded}`);
      ensuredClasses.add(classId);
      return existing;
    }
    throw providerError(
      "We could not create the Google Wallet pass class. Please try again in a moment.",
      error,
    );
  }
}

export function resetEnsuredClasses(): void {
  ensuredClasses.clear();
}
