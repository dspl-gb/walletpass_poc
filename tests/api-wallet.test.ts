import { beforeEach, describe, expect, it, vi } from "vitest";

import { memoryCreatePass } from "@/lib/db/memory";
import { APPLE_PASS_CONTENT_TYPE } from "@/lib/wallet/apple";

import { OWNER_A, OWNER_B, samplePassInput } from "./fixtures";

const issueApplePass = vi.hoisted(() => vi.fn());

vi.mock("@/lib/wallet/apple", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wallet/apple")>();
  return {
    ...actual,
    issueApplePass,
  };
});

describe("Apple and Google API routes", () => {
  beforeEach(() => {
    issueApplePass.mockReset();
    issueApplePass.mockImplementation(actualMockIssue);
  });

  it("returns JSON — not a pkpass — in mock mode", async () => {
    const { POST } = await import("@/app/api/wallet/apple/route");
    const pass = memoryCreatePass(samplePassInput(), OWNER_A, "published");

    issueApplePass.mockResolvedValue({
      mode: "mock",
      fileName: "API-MOCK.pkpass",
      serialNumber: "serial-mock",
      reason: "MOCK_WALLET_MODE is enabled",
    });

    const response = await POST(jsonRequest("/api/wallet/apple", { passId: pass.id }, OWNER_A));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).not.toBe(APPLE_PASS_CONTENT_TYPE);
    expect(response.headers.get("x-wallet-mock")).toBe("true");
    const body = (await response.json()) as { mock: boolean; message: string };
    expect(body.mock).toBe(true);
    expect(body.message.toLowerCase()).toContain("mock");
  });

  it("returns application/vnd.apple.pkpass for a real signed pass", async () => {
    const { POST } = await import("@/app/api/wallet/apple/route");
    const pass = memoryCreatePass({ ...samplePassInput(), serialNumber: "API-REAL" }, OWNER_A, "published");

    issueApplePass.mockResolvedValue({
      mode: "real",
      buffer: Buffer.from("PK-FAKE-ARCHIVE"),
      fileName: "API-REAL.pkpass",
      serialNumber: "serial-real",
      signed: true,
    });

    const response = await POST(jsonRequest("/api/wallet/apple", { passId: pass.id }, OWNER_A));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(APPLE_PASS_CONTENT_TYPE);
    expect(response.headers.get("content-disposition")).toContain("API-REAL.pkpass");
    expect(response.headers.get("x-wallet-signed")).toBe("true");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.toString("utf8")).toBe("PK-FAKE-ARCHIVE");
  });

  it("returns a mock Google save URL that is not pay.google.com", async () => {
    const { POST } = await import("@/app/api/wallet/google/route");
    const pass = memoryCreatePass({ ...samplePassInput(), serialNumber: "API-GOOGLE" }, OWNER_A, "published");

    const response = await POST(jsonRequest("/api/wallet/google", { passId: pass.id }, OWNER_A));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { saveUrl: string; mock?: boolean };
    expect(body.mock).toBe(true);
    expect(body.saveUrl).toContain("/demo/google-mock");
    expect(body.saveUrl).not.toContain("pay.google.com");
  });

  it("rejects an invalid pass ID", async () => {
    const { POST } = await import("@/app/api/wallet/apple/route");
    const response = await POST(jsonRequest("/api/wallet/apple", { passId: "not-valid" }, OWNER_A));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_request");
  });

  it("rejects a pass the caller does not own", async () => {
    const { POST } = await import("@/app/api/wallet/apple/route");
    const pass = memoryCreatePass({ ...samplePassInput(), serialNumber: "API-FORBIDDEN" }, OWNER_A, "published");
    const response = await POST(jsonRequest("/api/wallet/apple", { passId: pass.id }, OWNER_B));
    expect(response.status).toBe(403);
  });

  it("returns 503 when certificates are not configured", async () => {
    const { POST } = await import("@/app/api/wallet/apple/route");
    const pass = memoryCreatePass({ ...samplePassInput(), serialNumber: "API-UNSIGNED" }, OWNER_A, "published");

    issueApplePass.mockResolvedValue({
      mode: "real",
      buffer: Buffer.from("PK-UNSIGNED"),
      fileName: "API-UNSIGNED.pkpass",
      serialNumber: "serial-unsigned",
      signed: false,
    });

    const response = await POST(jsonRequest("/api/wallet/apple", { passId: pass.id }, OWNER_A));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain("not configured");
  });

  it("returns a user-safe error when Apple generation has no credentials", async () => {
    const { POST } = await import("@/app/api/wallet/apple/route");
    const pass = memoryCreatePass({ ...samplePassInput(), serialNumber: "API-MISS" }, OWNER_A, "published");
    const { configurationMissing } = await import("@/lib/wallet/common/errors");
    issueApplePass.mockImplementation(() => {
      throw configurationMissing("Apple Wallet is not configured on this deployment yet.");
    });

    const response = await POST(jsonRequest("/api/wallet/apple", { passId: pass.id }, OWNER_A));
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain("not configured");
    expect(JSON.stringify(body)).not.toMatch(/BEGIN |PRIVATE KEY|password/i);
  });

  it("returns not found for an unknown pass", async () => {
    const { POST } = await import("@/app/api/wallet/google/route");
    const response = await POST(
      jsonRequest("/api/wallet/google", { passId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, OWNER_A),
    );
    expect(response.status).toBe(404);
  });
});

function actualMockIssue() {
  return Promise.resolve({
    mode: "mock" as const,
    fileName: "fallback.pkpass",
    serialNumber: "serial",
    reason: "test",
  });
}

function jsonRequest(path: string, body: unknown, ownerId: string) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `wpd_owner=${ownerId}`,
    },
    body: JSON.stringify(body),
  });
}
