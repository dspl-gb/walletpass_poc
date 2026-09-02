import { describe, expect, it } from "vitest";

import { decodePemMaterial, looksLikePemMaterial } from "@/lib/config/pem-material";

const SAMPLE_CERT = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHBfpXw
-----END CERTIFICATE-----`;

describe("decodePemMaterial", () => {
  it("accepts raw PEM text with escaped newlines", () => {
    const buffer = decodePemMaterial(SAMPLE_CERT.replace(/\n/g, "\\n"));
    expect(buffer.toString("utf8")).toContain("BEGIN CERTIFICATE");
  });

  it("accepts base64-encoded PEM text", () => {
    const buffer = decodePemMaterial(Buffer.from(SAMPLE_CERT, "utf8").toString("base64"));
    expect(buffer.toString("utf8")).toContain("BEGIN CERTIFICATE");
  });

  it("detects readable PEM material", () => {
    expect(looksLikePemMaterial(SAMPLE_CERT)).toBe(true);
    expect(looksLikePemMaterial(Buffer.from(SAMPLE_CERT, "utf8").toString("base64"))).toBe(true);
    expect(looksLikePemMaterial("")).toBe(false);
  });
});
