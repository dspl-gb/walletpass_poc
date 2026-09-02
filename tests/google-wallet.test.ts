import { describe, expect, it } from "vitest";

import { getGoogleConfig } from "@/lib/config/env";
import { AppError } from "@/lib/wallet/common/errors";
import { buildGoogleClassId, generateGoogleObjectId } from "@/lib/wallet/common/identifiers";
import {
  buildSaveJwtClaims,
  buildSaveUrl,
  issueGooglePass,
  MOCK_MODE_REASON,
  mockGoogleSaveUrl,
  objectIdFor,
} from "@/lib/wallet/google";
import { mapCommonPassToGoogleClass, mapCommonPassToGoogleWallet } from "@/lib/wallet/mappers/google";

import { samplePass } from "./fixtures";

describe("Google Wallet object generation", () => {
  it("builds a generic object with dynamic member data and a QR barcode", () => {
    const object = mapCommonPassToGoogleWallet(samplePass(), {
      objectId: "issuer.DEMO-001",
      classId: "issuer.wallet_pass_demo_generic",
    });

    expect(object.header.defaultValue.value).toBe("Demo Member");
    expect(object.cardTitle.defaultValue.value).toBe("Demo Company");
    expect(object.barcode).toMatchObject({ type: "QR_CODE", value: "MEMBER:DEMO-001" });
    expect(object.textModulesData.some((row) => row.id === "secondary_memberId")).toBe(true);
  });

  it("builds a reusable generic class template from pass data", () => {
    const walletClass = mapCommonPassToGoogleClass(samplePass(), { classId: "issuer.class" });
    expect(walletClass.id).toBe("issuer.class");
    expect(walletClass.hexBackgroundColor).toBe("#0D5C3D");
    expect(walletClass.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos).toHaveLength(1);
  });

  it("builds a Google save URL from a JWT", () => {
    expect(buildSaveUrl("abc.def.ghi")).toBe("https://pay.google.com/gp/v/save/abc.def.ghi");
  });

  it("puts the generic object in the save JWT payload", () => {
    const genericObject = mapCommonPassToGoogleWallet(samplePass(), {
      objectId: "issuer.obj",
      classId: "issuer.class",
    });
    const claims = buildSaveJwtClaims({
      issuerEmail: "wallet@example.com",
      origins: ["http://localhost:3000"],
      genericObject,
      issuedAt: 1_700_000_000,
    });
    expect(claims).toMatchObject({
      iss: "wallet@example.com",
      aud: "google",
      typ: "savetowallet",
      iat: 1_700_000_000,
    });
    expect((claims.payload as { genericObjects: unknown[] }).genericObjects[0]).toEqual(genericObject);
  });

  it("returns a mock save URL that is not Google Wallet when MOCK_WALLET_MODE is on", async () => {
    const pass = samplePass();
    const result = await issueGooglePass(pass);
    expect(result.mode).toBe("mock");
    if (result.mode === "mock") {
      expect(result.saveUrl).toBe(mockGoogleSaveUrl(pass.id));
      expect(result.saveUrl).toContain("/demo/google-mock");
      expect(result.saveUrl).not.toContain("pay.google.com");
      expect(result.reason).toBe(MOCK_MODE_REASON);
    }
  });
});

describe("duplicate Google Wallet objects", () => {
  it("reuses a stored object id instead of minting a new one", () => {
    const pass = samplePass({
      walletInfo: {
        passId: passIdPlaceholder(),
        googleObjectId: "issuer.existing-object",
        applePassUrl: null,
        appleSerialNumber: null,
        applePassTypeIdentifier: null,
        appleGeneratedAt: null,
        googleClassId: null,
        googleSaveUrl: null,
        googleGeneratedAt: null,
      },
    });
    const reused = objectIdFor(pass, {
      issuerId: "issuer",
      serviceAccountEmail: "wallet@example.com",
      serviceAccountPrivateKey: "-----BEGIN PRIVATE KEY-----\nMII\n-----END PRIVATE KEY-----\n",
      classSuffix: "wallet_pass_demo_generic",
    });
    expect(reused).toBe("issuer.existing-object");
  });

  it("mints an issuer-prefixed object id when none is stored", () => {
    const id = generateGoogleObjectId("issuer", "DEMO-001");
    expect(id.startsWith("issuer.")).toBe(true);
    expect(id).toMatch(/^issuer\.[A-Za-z0-9._-]+$/);
    expect(buildGoogleClassId("issuer", "wallet_pass_demo_generic")).toBe(
      "issuer.wallet_pass_demo_generic",
    );
  });
});

describe("Google credentials", () => {
  it("treats missing service account material as unconfigured", () => {
    expect(getGoogleConfig()).toBeNull();
  });

  it("does not put a fake pay.google.com URL in the mock result", async () => {
    const result = await issueGooglePass(samplePass());
    expect(result.mode).toBe("mock");
    if (result.mode === "mock") {
      expect(result.saveUrl.includes("pay.google.com")).toBe(false);
    }
  });
});

describe("Google error messages", () => {
  it("keeps credential failures user-safe", () => {
    const error = new AppError(
      "invalid_credentials",
      "Google Wallet rejected the configured service account. Please contact support.",
    );
    expect(error.userMessage).not.toMatch(/BEGIN PRIVATE KEY|service_account/i);
  });
});

function passIdPlaceholder() {
  return "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
}
