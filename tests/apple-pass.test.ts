import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";



import { APPLE_PASS_CONTENT_TYPE, issueApplePass, MOCK_MODE_REASON } from "@/lib/wallet/apple";

import { loadAppleSigningContext } from "@/lib/wallet/apple/certificates";

import { generateUnsignedApplePass } from "@/lib/wallet/apple/generate";

import { toAppleColor, toPassJson } from "@/lib/wallet/apple/pass-json";

import { mapCommonPassToAppleWallet } from "@/lib/wallet/mappers/apple";

import { getAppleConfig } from "@/lib/config/env";

import { AppError } from "@/lib/wallet/common/errors";

import { generateAppleSerialNumber } from "@/lib/wallet/common/identifiers";



import { samplePass } from "./fixtures";
import { defaultFieldsForType } from "@/lib/wallet/common/defaults";



const structureOptions = {

  serialNumber: "serial-1",

  passTypeIdentifier: "pass.com.example.membership",

  teamIdentifier: "A1B2C3D4E5",

};



describe("Apple pass generation", () => {

  it("falls back to header offer code when coupon primary and pass name are empty", () => {
    const pass = samplePass({
      passType: "coupon",
      name: "",
      organization: {
        name: "Greenback",
        description: "Offer by Greenback",
        logoText: "Greenback",
      },
      fields: {
        ...defaultFieldsForType("coupon"),
        header: [{ key: "header", label: "Offer", value: "#001", textAlignment: "left", sortOrder: 0 }],
        primary: [{ key: "primary", label: "Coupon", value: "", textAlignment: "left", sortOrder: 0 }],
        secondary: [],
        auxiliary: [{ key: "field_1", label: "Expires", value: "30-10-2026", textAlignment: "left", sortOrder: 0 }],
        back: [],
      },
    });

    const structure = mapCommonPassToAppleWallet(pass, structureOptions);
    expect(structure.fields.primaryFields[0]?.value).toBe("#001");
    expect(structure.fields.backFields.some((field) => field.key === "serial_number")).toBe(true);
    expect(structure.fields.backFields.some((field) => field.key === "location_0")).toBe(false);
  });

  it("falls back to pass name when the primary field value is empty", () => {
    const pass = samplePass({
      passType: "coupon",
      name: "20% Off Your Next Purchase",
      fields: {
        ...defaultFieldsForType("coupon"),
        header: [{ key: "header", label: "Offer", value: "#001", textAlignment: "left", sortOrder: 0 }],
        primary: [{ key: "primary", label: "Coupon", value: "", textAlignment: "left", sortOrder: 0 }],
        secondary: [],
        auxiliary: [{ key: "field_1", label: "Expires", value: "30-10-2026", textAlignment: "left", sortOrder: 0 }],
      },
    });

    const structure = mapCommonPassToAppleWallet(pass, structureOptions);
    expect(structure.style).toBe("coupon");
    expect(structure.fields.primaryFields[0]?.value).toBe("20% Off Your Next Purchase");

    const json = toPassJson(structure) as { coupon?: { primaryFields?: Array<{ value?: string }> } };
    expect(json.coupon?.primaryFields?.[0]?.value).toBe("20% Off Your Next Purchase");
  });

  it("builds a storeCard with dynamic member fields, barcode and expiration", () => {
    const pass = samplePass();

    const structure = mapCommonPassToAppleWallet(pass, structureOptions);

    expect(structure.style).toBe("storeCard");

    expect(structure.props.serialNumber).toBe("serial-1");

    expect(structure.props.organizationName).toBe("Demo Company");

    expect(structure.fields.primaryFields[0]?.value).toBe("Demo Member");

    expect(structure.fields.secondaryFields.map((field) => field.key)).toEqual(["memberId", "passType"]);

    expect(structure.barcodes[0]).toMatchObject({

      format: "PKBarcodeFormatQR",

      message: "MEMBER:DEMO-001",

    });

    expect(structure.expirationDate).toBe(pass.validity.expirationDate);

  });

  it("includes locations and back-field metadata from the saved pass", () => {
    const pass = samplePass({
      locations: [
        { latitude: 37.7749, longitude: -122.4194, relevantText: "Union Square Store" },
      ],
      validity: {
        ...samplePass().validity,
        validFromEnabled: true,
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntilEnabled: true,
        validUntil: "2026-12-31T23:59:59.000Z",
      },
    });

    const structure = mapCommonPassToAppleWallet(pass, structureOptions);
    const json = toPassJson(structure) as {
      locations?: Array<{ latitude: number; longitude: number; relevantText?: string }>;
      storeCard?: { backFields?: Array<{ key: string; value: string }> };
    };

    expect(structure.locations).toEqual([
      { latitude: 37.7749, longitude: -122.4194, relevantText: "Union Square Store" },
    ]);
    expect(json.locations).toHaveLength(1);
    expect(json.storeCard?.backFields?.some((field) => field.key === "location_0")).toBe(true);
    expect(json.storeCard?.backFields?.some((field) => field.key === "validity_from")).toBe(true);
    expect(json.storeCard?.backFields?.some((field) => field.key === "validity_until")).toBe(true);
  });

  it("ignores placeholder locations at 0,0", () => {
    const pass = samplePass({
      locations: [{ latitude: 0, longitude: 0, relevantText: "Unset" }],
    });

    const structure = mapCommonPassToAppleWallet(pass, structureOptions);
    expect(structure.locations).toEqual([]);
  });



  it("serialises pass.json with the style node Apple expects", () => {

    const json = toPassJson(mapCommonPassToAppleWallet(samplePass(), structureOptions));

    expect(json.formatVersion).toBe(1);

    expect(json.storeCard).toBeDefined();

    expect(json.barcodes).toHaveLength(1);

    expect(json.passTypeIdentifier).toBe("pass.com.example.membership");

  });



  it("converts brand hex colours to Apple rgb() triples", () => {

    expect(toAppleColor("#0B1220")).toBe("rgb(11, 18, 32)");

  });



  it("returns a clearly marked mock result when MOCK_WALLET_MODE is on", async () => {

    const result = await issueApplePass(samplePass(), { serialNumber: "serial-1" });

    expect(result.mode).toBe("mock");

    if (result.mode === "mock") {

      expect(result.reason).toBe(MOCK_MODE_REASON);

      expect(result.fileName).toBe("DEMO-001.pkpass");

    }

  });



  it("uses the official Apple Wallet content type for real passes", () => {

    expect(APPLE_PASS_CONTENT_TYPE).toBe("application/vnd.apple.pkpass");

  });



  it("builds an unsigned .pkpass zip from pass data without certificates", async () => {

    const generated = await generateUnsignedApplePass(samplePass(), { serialNumber: "serial-1" });

    expect(generated.signed).toBe(false);

    expect(generated.fileName).toBe("DEMO-001.pkpass");

    expect(generated.buffer.subarray(0, 2).toString("utf8")).toBe("PK");

    const asText = generated.buffer.toString("utf8");

    expect(asText).toContain("pass.json");

    expect(asText).toContain("Demo Member");

    expect(asText).toContain("DEMO-001");

    expect(asText).toContain("MEMBER:DEMO-001");

    expect(asText).not.toContain("signature");

  });



  it("issues a downloadable .pkpass when mock mode is off and certs are missing", async () => {

    process.env.MOCK_WALLET_MODE = "false";

    const result = await issueApplePass(samplePass(), { serialNumber: "serial-1" });

    expect(result.mode).toBe("real");

    if (result.mode === "real") {

      expect(result.signed).toBe(false);

      expect(result.buffer.subarray(0, 2).toString("utf8")).toBe("PK");

      expect(result.buffer.toString("utf8")).toContain("Demo Member");

    }

  });



  it("generates a unique Apple serial number", () => {

    const first = generateAppleSerialNumber();

    const second = generateAppleSerialNumber();

    expect(first).toMatch(/^[0-9a-f-]{36}$/i);

    expect(first).not.toBe(second);

  });

});



describe("Apple credentials", () => {

  it("refuses to load signing material when certificates are missing", () => {

    expect(() => loadAppleSigningContext()).toThrow(AppError);

    try {

      loadAppleSigningContext();

    } catch (error) {

      expect(error).toBeInstanceOf(AppError);

      expect((error as AppError).code).toBe("configuration_missing");

      expect((error as AppError).userMessage).not.toMatch(/BEGIN|PRIVATE|PASSWORD/i);

    }

  });



  it("does not treat Apple as configured when PEM paths do not exist", () => {

    process.env.APPLE_TEAM_ID = "A1B2C3D4E5";

    process.env.APPLE_PASS_TYPE_IDENTIFIER = "pass.com.example.membership";

    process.env.APPLE_CERTIFICATE_PATH = "./certs/apple/missing-signerCert.pem";

    process.env.APPLE_PRIVATE_KEY_PATH = "./certs/apple/missing-signerKey.pem";

    process.env.APPLE_WWDR_CERTIFICATE_PATH = "./certs/apple/missing-wwdr.pem";

    expect(getAppleConfig()).toBeNull();

  });



  it.skipIf(!existsSync("certs/apple/signerCert.pem"))(

    "refuses to issue when the Pass Type certificate exists without signerKey.pem",

    async () => {

      process.env.MOCK_WALLET_MODE = "false";

      process.env.APPLE_TEAM_ID = "UFGQR96KU5";

      process.env.APPLE_PASS_TYPE_IDENTIFIER = "pass.com.greenback.wallet";

      process.env.APPLE_CERTIFICATE_PATH = "./certs/apple/signerCert.pem";

      process.env.APPLE_PRIVATE_KEY_PATH = "./certs/apple/signerKey.pem";

      process.env.APPLE_WWDR_CERTIFICATE_PATH = "./certs/apple/wwdr.pem";

      await expect(issueApplePass(samplePass(), { serialNumber: "serial-1" })).rejects.toThrow(AppError);

    },

  );

});


