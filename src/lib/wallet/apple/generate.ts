import { createHash } from "node:crypto";
import { PKPass } from "passkit-generator";

import { getApplePassIdentity, hasAppleSignerCertificate, hasAppleSignerKey } from "@/lib/config/env";
import { configurationMissing, passGenerationFailed } from "@/lib/wallet/common/errors";
import type { CommonPass } from "@/lib/wallet/common/schema";
import { mapCommonPassToAppleWallet } from "@/lib/wallet/mappers/apple";

import { buildPassAssets, buildPassAssetsFromUrlsAsync, REQUIRED_ASSETS } from "./assets";
import { isAppleConfigured, loadAppleSigningContext } from "./certificates";
import { toPassJson, type ApplePassStructure } from "./pass-json";
import { packZip } from "./zip";

function applyStructureToPkPass(pkpass: PKPass, structure: ApplePassStructure): void {
  pkpass.type = structure.style as typeof pkpass.type;

  for (const field of structure.fields.headerFields) pkpass.headerFields.push(field);
  for (const field of structure.fields.primaryFields) pkpass.primaryFields.push(field);
  for (const field of structure.fields.secondaryFields) pkpass.secondaryFields.push(field);
  for (const field of structure.fields.auxiliaryFields) pkpass.auxiliaryFields.push(field);
  for (const field of structure.fields.backFields) pkpass.backFields.push(field);

  if (structure.barcodes.length > 0) {
    pkpass.setBarcodes(...structure.barcodes);
  }

  if (structure.expirationDate) {
    pkpass.setExpirationDate(new Date(structure.expirationDate));
  }

  if (structure.relevantDate) {
    pkpass.setRelevantDate(new Date(structure.relevantDate));
  }

  if (structure.locations && structure.locations.length > 0) {
    pkpass.setLocations(...structure.locations);
  }
}

export interface GenerateApplePassOptions {
  serialNumber: string;
  passTypeIdentifier?: string;
  teamIdentifier?: string;
}

export interface GeneratedApplePass {
  buffer: Buffer;
  fileName: string;
  serialNumber: string;
  structure: ApplePassStructure;
  signed: boolean;
}

function sha1Hex(data: Buffer): string {
  return createHash("sha1").update(data).digest("hex");
}

async function assemblePass(pass: CommonPass, options: GenerateApplePassOptions) {
  const identity = getApplePassIdentity();
  const passTypeIdentifier = options.passTypeIdentifier ?? identity.passTypeIdentifier;
  const teamIdentifier = options.teamIdentifier ?? identity.teamIdentifier;

  const structure = mapCommonPassToAppleWallet(pass, {
    serialNumber: options.serialNumber,
    passTypeIdentifier,
    teamIdentifier,
  });

  const colors = {
    background: pass.appearance.backgroundColor,
    foreground: pass.appearance.foregroundColor,
    label: pass.appearance.labelColor,
  };

  const assets =
    pass.appearance.logo || pass.appearance.strip
      ? await buildPassAssetsFromUrlsAsync(pass.appearance, colors)
      : buildPassAssets(colors);

  for (const required of REQUIRED_ASSETS) {
    if (!assets[required]) {
      throw passGenerationFailed("The pass template is missing required artwork.");
    }
  }

  return { structure, assets };
}

export async function generateApplePass(
  pass: CommonPass,
  options: GenerateApplePassOptions,
): Promise<GeneratedApplePass> {
  if (isAppleConfigured()) {
    return generateSignedApplePass(pass, options);
  }

  if (hasAppleSignerCertificate() && !hasAppleSignerKey()) {
    throw configurationMissing(
      "Apple Wallet cannot install this pass yet. signerCert.pem is present, but signerKey.pem is missing.",
      "Pass Type certificate found without a matching private key",
    );
  }

  return generateUnsignedApplePass(pass, options);
}

export async function generateUnsignedApplePass(
  pass: CommonPass,
  options: GenerateApplePassOptions,
): Promise<GeneratedApplePass> {
  const { structure, assets } = await assemblePass(pass, options);
  const passJson = Buffer.from(`${JSON.stringify(toPassJson(structure), null, 2)}\n`, "utf8");

  const files: Record<string, Buffer> = {
    "pass.json": passJson,
    ...assets,
  };

  const manifest: Record<string, string> = {};
  for (const [name, data] of Object.entries(files)) {
    manifest[name] = sha1Hex(data);
  }
  files["manifest.json"] = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    buffer: packZip(Object.entries(files).map(([name, data]) => ({ name, data }))),
    fileName: buildFileName(pass),
    serialNumber: options.serialNumber,
    structure,
    signed: false,
  };
}

export async function generateSignedApplePass(
  pass: CommonPass,
  options: GenerateApplePassOptions,
): Promise<GeneratedApplePass> {
  const { config, certificates } = loadAppleSigningContext();
  const structure = mapCommonPassToAppleWallet(pass, {
    serialNumber: options.serialNumber,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
  });

  const colors = {
    background: pass.appearance.backgroundColor,
    foreground: pass.appearance.foregroundColor,
    label: pass.appearance.labelColor,
  };

  const assets =
    pass.appearance.logo || pass.appearance.strip
      ? await buildPassAssetsFromUrlsAsync(pass.appearance, colors)
      : buildPassAssets(colors);

  for (const required of REQUIRED_ASSETS) {
    if (!assets[required]) {
      throw passGenerationFailed("The pass template is missing required artwork.");
    }
  }

  try {
    const pkpass = new PKPass(
      assets,
      certificates,
      structure.props as unknown as ConstructorParameters<typeof PKPass>[2],
    );

    applyStructureToPkPass(pkpass, structure);

    return {
      buffer: pkpass.getAsBuffer(),
      fileName: buildFileName(pass),
      serialNumber: options.serialNumber,
      structure,
      signed: true,
    };
  } catch (error) {
    throw passGenerationFailed(
      "We could not build your Apple Wallet pass. Please try again in a moment.",
      error,
    );
  }
}

export function buildFileName(pass: Pick<CommonPass, "serialNumber" | "name">): string {
  const safe = (pass.serialNumber || pass.name).replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${safe || "pass"}.pkpass`;
}

export const APPLE_PASS_CONTENT_TYPE = "application/vnd.apple.pkpass";
