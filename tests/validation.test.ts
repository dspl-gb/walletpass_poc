import { describe, expect, it } from "vitest";

import { createEmptyPassInput } from "@/lib/wallet/common/defaults";
import { AppError } from "@/lib/wallet/common/errors";
import { parseCommonPassInput } from "@/lib/wallet/common/validation";

describe("commonPassInput validation", () => {
  it("accepts ISO datetimes with timezone offsets", () => {
    const base = createEmptyPassInput();
    const parsed = parseCommonPassInput({
      ...base,
      name: "GB Coupon",
      organization: { name: "Greenback", description: "Offer", logoText: "GB" },
      validity: {
        ...base.validity,
        expirationDateEnabled: true,
        expirationDate: "2026-10-30T00:00:00+00:00",
      },
    });

    expect(parsed.validity.expirationDate).toBe("2026-10-30T00:00:00+00:00");
  });

  it("throws invalid_request for malformed payloads", () => {
    expect(() => parseCommonPassInput({ name: "Only Name" })).toThrow(AppError);
    try {
      parseCommonPassInput({ name: "Only Name" });
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe("invalid_request");
    }
  });
});
