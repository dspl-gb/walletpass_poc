import { readFileSync } from "node:fs";

import { getAppleConfig, resolveEnvPath, type AppleConfig } from "@/lib/config/env";
import { decodePemMaterial } from "@/lib/config/pem-material";
import { configurationMissing, invalidCredentials } from "@/lib/wallet/common/errors";

export interface AppleCertificates {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase?: string;
}

export interface AppleSigningContext {
  config: AppleConfig;
  certificates: AppleCertificates;
}

type Source = { base64?: string; path?: string };

function loadSource(label: string, source: Source): Buffer {
  if (source.base64) {
    try {
      const buffer = decodePemMaterial(source.base64);
      if (buffer.length === 0) {
        throw new Error("empty buffer");
      }
      return buffer;
    } catch (error) {
      throw invalidCredentials(
        "The Apple Wallet signing material is not valid. Please contact support.",
        `${label}: ${(error as Error).message}`,
      );
    }
  }

  if (source.path) {
    const resolved = resolveEnvPath(source.path);
    try {
      return readFileSync(resolved);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        throw configurationMissing(
          "Apple Wallet certificate files are missing. Add signerCert.pem and signerKey.pem under certs/apple (see README, Apple certificate setup).",
          `${label}: file not found at ${resolved}`,
        );
      }
      throw invalidCredentials(
        "The Apple Wallet signing material could not be read. Please contact support.",
        `${label}: unable to read ${resolved} - ${(error as Error).message}`,
      );
    }
  }

  throw configurationMissing(
    "Apple Wallet is not configured on this deployment yet.",
    `${label}: neither a base64 value nor a file path was provided`,
  );
}

function assertPem(label: string, buffer: Buffer, expected: RegExp): void {
  const text = buffer.subarray(0, 4096).toString("utf8");
  if (!expected.test(text)) {
    const looksBinary = buffer[0] === 0x30;
    throw invalidCredentials(
      "The Apple Wallet certificates are not in the expected format. Please contact support.",
      looksBinary
        ? `${label}: value looks like DER/PKCS#12 binary. Convert it to PEM (see README, "Apple certificate setup").`
        : `${label}: PEM header not found`,
    );
  }
}

/**
 * Loads and validates the Apple signing material.
 *
 * The returned buffers stay inside the Node.js process: they are handed
 * straight to the signing library and are never serialised into a response.
 */
export function loadAppleSigningContext(): AppleSigningContext {
  const config = getAppleConfig();
  if (!config) {
    throw configurationMissing(
      "Apple Wallet is not configured yet. Add signerCert.pem and signerKey.pem under certs/apple, then restart the server.",
      "Missing APPLE_TEAM_ID, APPLE_PASS_TYPE_IDENTIFIER, or a readable certificate / private key / WWDR file",
    );
  }

  const wwdr = loadSource("APPLE_WWDR_CERTIFICATE", config.wwdr);
  const signerCert = loadSource("APPLE_CERTIFICATE", config.certificate);
  const signerKey = loadSource("APPLE_PRIVATE_KEY", config.privateKey);

  assertPem("APPLE_WWDR_CERTIFICATE", wwdr, /-----BEGIN CERTIFICATE-----/);
  assertPem("APPLE_CERTIFICATE", signerCert, /-----BEGIN CERTIFICATE-----/);
  assertPem("APPLE_PRIVATE_KEY", signerKey, /-----BEGIN (?:ENCRYPTED )?(?:RSA )?PRIVATE KEY-----/);

  const isEncrypted = /-----BEGIN ENCRYPTED PRIVATE KEY-----|ENCRYPTED/.test(
    signerKey.subarray(0, 512).toString("utf8"),
  );
  if (isEncrypted && !config.privateKeyPassword) {
    throw invalidCredentials(
      "Apple Wallet is not configured correctly on this deployment.",
      "APPLE_PRIVATE_KEY is encrypted but APPLE_PRIVATE_KEY_PASSWORD is empty",
    );
  }

  return {
    config,
    certificates: {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase: config.privateKeyPassword,
    },
  };
}

export function isAppleConfigured(): boolean {
  return getAppleConfig() !== null;
}
