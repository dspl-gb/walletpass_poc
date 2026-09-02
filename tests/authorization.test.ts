import { describe, expect, it } from "vitest";

import { memoryCreatePass } from "@/lib/db/memory";
import { assertPassOwnership, loadOwnedPass } from "@/lib/db/passes";
import { AppError } from "@/lib/wallet/common/errors";
import { assertPassIsIssuable } from "@/lib/wallet/common/pass";
import { parsePassId } from "@/lib/wallet/issue-apple";

import { OWNER_A, OWNER_B, samplePass, samplePassInput } from "./fixtures";

describe("authorization and ownership", () => {
  it("allows the owner to load their pass", async () => {
    const created = memoryCreatePass({ ...samplePassInput(), serialNumber: "MEM-OWN" }, OWNER_A, "published");
    const loaded = await loadOwnedPass(created.id, OWNER_A);
    expect(loaded.serialNumber).toBe("MEM-OWN");
  });

  it("rejects a different owner", async () => {
    const created = memoryCreatePass({ ...samplePassInput(), serialNumber: "MEM-PRIV" }, OWNER_A, "published");
    await expect(loadOwnedPass(created.id, OWNER_B)).rejects.toMatchObject({ code: "forbidden" });
    expect(() => assertPassOwnership(created, OWNER_B)).toThrow(AppError);
  });

  it("allows shared passes with a null user_id", () => {
    const shared = samplePass({ userId: null });
    expect(() => assertPassOwnership(shared, OWNER_B)).not.toThrow();
  });

  it("returns not_found for an unknown pass id", async () => {
    await expect(loadOwnedPass("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", OWNER_A)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("invalid pass ID", () => {
  it("rejects a missing or malformed passId", () => {
    expect(() => parsePassId({})).toThrow(AppError);
    expect(() => parsePassId({ passId: "not-a-uuid" })).toThrow(AppError);
    try {
      parsePassId({ passId: "nope" });
    } catch (error) {
      expect((error as AppError).code).toBe("invalid_request");
    }
  });

  it("accepts a UUID passId", () => {
    expect(parsePassId({ passId: samplePass().id })).toBe(samplePass().id);
  });
});

describe("pass issuance rules", () => {
  it("blocks wallet issuance for draft, archived, or expired passes", () => {
    expect(() => assertPassIsIssuable(samplePass({ status: "draft" }))).toThrow(AppError);
    expect(() => assertPassIsIssuable(samplePass({ status: "archived" }))).toThrow(AppError);
    expect(() =>
      assertPassIsIssuable(
        samplePass({
          validity: {
            relevantDate: null,
            expirationDate: "2020-01-01T00:00:00.000Z",
            validFrom: null,
            validUntil: null,
            relevantDateEnabled: false,
            expirationDateEnabled: true,
            validFromEnabled: false,
            validUntilEnabled: false,
          },
        }),
      ),
    ).toThrow(AppError);
  });
});
