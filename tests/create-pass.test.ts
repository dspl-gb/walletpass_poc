import { describe, expect, it } from "vitest";

import { parseCreatePassInput } from "@/lib/wallet/common/create-pass-input";
import { AppError } from "@/lib/wallet/common/errors";
import { generateMemberId } from "@/lib/wallet/common/identifiers";

const OWNER = "11111111-1111-4111-8111-111111111111";

describe("parseCreatePassInput", () => {
  it("accepts a complete payload", () => {
    const input = parseCreatePassInput(
      {
        holderName: "Jane Doe",
        passType: "Premium Membership",
        companyName: "Greenback",
        memberId: "MEM-001",
        email: "jane@example.com",
        qrValue: "CUSTOM:QR",
        expirationDate: "2027-01-01T00:00:00.000Z",
      },
      OWNER,
    );

    expect(input).toEqual({
      userId: OWNER,
      memberId: "MEM-001",
      passType: "Premium Membership",
      holderName: "Jane Doe",
      companyName: "Greenback",
      email: "jane@example.com",
      qrValue: "CUSTOM:QR",
      expirationDate: new Date("2027-01-01T00:00:00.000Z"),
    });
  });

  it("auto-generates memberId when omitted", () => {
    const input = parseCreatePassInput(
      {
        holderName: "Jane Doe",
        passType: "Premium Membership",
        companyName: "Greenback",
      },
      OWNER,
    );

    expect(input.memberId).toMatch(/^MEM-/);
    expect(input.qrValue).toBe(`MEMBER:${input.memberId}`);
  });

  it("defaults expirationDate to 12 months from now", () => {
    const input = parseCreatePassInput(
      {
        holderName: "Jane Doe",
        passType: "Premium Membership",
        companyName: "Greenback",
      },
      OWNER,
    );

    expect(input.expirationDate).toBeInstanceOf(Date);
    const expiry = input.expirationDate as Date;
    const now = new Date();
    expect(expiry.getTime()).toBeGreaterThan(now.getTime());
  });

  it("trims whitespace from string fields", () => {
    const input = parseCreatePassInput(
      {
        holderName: "  Jane Doe  ",
        passType: "  Premium Membership  ",
        companyName: "  Greenback  ",
        memberId: "  MEM-002  ",
      },
      OWNER,
    );

    expect(input.holderName).toBe("Jane Doe");
    expect(input.passType).toBe("Premium Membership");
    expect(input.companyName).toBe("Greenback");
    expect(input.memberId).toBe("MEM-002");
  });

  it("sets email to null when omitted or empty", () => {
    const withoutEmail = parseCreatePassInput(
      { holderName: "Jane", passType: "Membership", companyName: "Co" },
      OWNER,
    );
    expect(withoutEmail.email).toBeNull();

    const withEmptyEmail = parseCreatePassInput(
      { holderName: "Jane", passType: "Membership", companyName: "Co", email: "   " },
      OWNER,
    );
    expect(withEmptyEmail.email).toBeNull();
  });

  it("throws invalid_request when holderName is missing", () => {
    expect(() =>
      parseCreatePassInput({ passType: "Membership", companyName: "Co" }, OWNER),
    ).toThrow(AppError);
    try {
      parseCreatePassInput({ passType: "Membership", companyName: "Co" }, OWNER);
    } catch (error) {
      expect((error as AppError).code).toBe("invalid_request");
    }
  });

  it("throws invalid_request when passType is missing", () => {
    expect(() =>
      parseCreatePassInput({ holderName: "Jane", companyName: "Co" }, OWNER),
    ).toThrow(AppError);
  });

  it("throws invalid_request when companyName is missing", () => {
    expect(() =>
      parseCreatePassInput({ holderName: "Jane", passType: "Membership" }, OWNER),
    ).toThrow(AppError);
  });

  it("throws invalid_request for an empty holderName", () => {
    expect(() =>
      parseCreatePassInput({ holderName: "   ", passType: "Membership", companyName: "Co" }, OWNER),
    ).toThrow(AppError);
  });

  it("throws invalid_request for a non-object body", () => {
    expect(() => parseCreatePassInput(null, OWNER)).toThrow(AppError);
    expect(() => parseCreatePassInput("string", OWNER)).toThrow(AppError);
    expect(() => parseCreatePassInput(42, OWNER)).toThrow(AppError);
  });

  it("throws invalid_request for an invalid expirationDate", () => {
    expect(() =>
      parseCreatePassInput(
        {
          holderName: "Jane",
          passType: "Membership",
          companyName: "Co",
          expirationDate: "not-a-date",
        },
        OWNER,
      ),
    ).toThrow(AppError);
  });

  it("throws invalid_request for a non-string expirationDate", () => {
    expect(() =>
      parseCreatePassInput(
        {
          holderName: "Jane",
          passType: "Membership",
          companyName: "Co",
          expirationDate: 12345,
        },
        OWNER,
      ),
    ).toThrow(AppError);
  });

  it("allows null ownerId", () => {
    const input = parseCreatePassInput(
      { holderName: "Jane", passType: "Membership", companyName: "Co" },
      null,
    );
    expect(input.userId).toBeNull();
  });
});

describe("generateMemberId", () => {
  it("produces unique ids with the given prefix", () => {
    const a = generateMemberId("MEM");
    const b = generateMemberId("MEM");
    expect(a).toMatch(/^MEM-/);
    expect(b).toMatch(/^MEM-/);
    expect(a).not.toBe(b);
  });
});
