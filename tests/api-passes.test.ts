import { describe, expect, it } from "vitest";

import { memoryCreatePass } from "@/lib/db/memory";
import { createEmptyPassInput } from "@/lib/wallet/common/defaults";

import { OWNER_A, samplePassInput } from "./fixtures";

function fullPassPayload(overrides: Record<string, unknown> = {}) {
  const base = createEmptyPassInput();
  return {
    name: "Dynamic Pass",
    passType: base.passType,
    organization: { name: "Dynamic Co", description: "A dynamic pass", logoText: "Dynamic" },
    appearance: base.appearance,
    fields: base.fields,
    barcode: { type: "QR", value: "PASS:001", altText: "001" },
    validity: base.validity,
    locations: [],
    serialNumber: "DYN-001",
    status: "draft",
    ...overrides,
  };
}

describe("POST /api/passes", () => {
  it("creates a pass from a dynamic payload", async () => {
    const { POST } = await import("@/app/api/passes/route");
    const response = await POST(
      jsonRequest(
        "/api/passes",
        fullPassPayload({
          name: "Dynamic Membership",
          organization: { name: "Dynamic Co", description: "Test", logoText: "DC" },
          fields: {
            ...createEmptyPassInput().fields,
            primary: [{ key: "member", label: "MEMBER", value: "Dynamic Member", textAlignment: "left", sortOrder: 0 }],
          },
          serialNumber: "DYN-001",
        }),
        OWNER_A,
      ),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { pass: { id: string; serialNumber: string; name: string } };
    expect(body.pass.id).toBeDefined();
    expect(body.pass.serialNumber).toBe("DYN-001");
    expect(body.pass.name).toBe("Dynamic Membership");
  });

  it("auto-generates serial number when omitted", async () => {
    const { POST } = await import("@/app/api/passes/route");
    const payload = fullPassPayload();
    delete (payload as { serialNumber?: string }).serialNumber;

    const response = await POST(jsonRequest("/api/passes", payload, OWNER_A));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { pass: { serialNumber: string } };
    expect(body.pass.serialNumber).toMatch(/^PASS-/);
  });

  it("returns 400 for missing required fields", async () => {
    const { POST } = await import("@/app/api/passes/route");
    const response = await POST(jsonRequest("/api/passes", { name: "Only Name" }, OWNER_A));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_request");
  });

  it("returns 409 when serial number already exists", async () => {
    const { POST } = await import("@/app/api/passes/route");
    memoryCreatePass({ ...samplePassInput(), serialNumber: "DUP-001" }, OWNER_A);

    const response = await POST(
      jsonRequest("/api/passes", fullPassPayload({ serialNumber: "DUP-001" }), OWNER_A),
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain("already exists");
  });

  it("allows anonymous owners (null ownerId)", async () => {
    const { POST } = await import("@/app/api/passes/route");
    const response = await POST(jsonRequest("/api/passes", fullPassPayload(), ""));

    expect(response.status).toBe(201);
    const body = (await response.json()) as { pass: { userId: string | null } };
    expect(body.pass.userId).toBeNull();
  });
});

function jsonRequest(path: string, body: unknown, ownerId: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ownerId) headers.cookie = `wpd_owner=${ownerId}`;
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
