import { ZodError, z } from "zod";

import {
  BARCODE_TYPES,
  FIELD_GROUPS,
  PASS_STATUSES,
  PASS_TYPES,
  TEXT_ALIGNMENTS,
} from "./schema";
import { invalidRequest } from "./errors";
import { normalizePassInputData } from "./normalize";

const passFieldSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(1, "Field key is required").max(64),
  label: z.string().max(128),
  value: z.string().max(1024),
  textAlignment: z.enum(TEXT_ALIGNMENTS).default("left"),
  sortOrder: z.number().int().min(0),
});

const passLocationSchema = z.object({
  id: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  relevantText: z.string().max(256),
});

const nullableUrlSchema = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color like #0B1220");

const dateTimeSchema = z.string().datetime({ offset: true });

export const commonPassInputSchema = z.object({
  name: z.string().min(1, "Pass name is required").max(128),
  passType: z.enum(PASS_TYPES),
  organization: z.object({
    name: z.string().min(1, "Organization name is required").max(128),
    description: z.string().max(512),
    logoText: z.string().max(64),
  }),
  appearance: z.object({
    backgroundColor: hexColorSchema,
    foregroundColor: hexColorSchema,
    labelColor: hexColorSchema,
    logo: nullableUrlSchema,
    strip: nullableUrlSchema,
    thumbnail: nullableUrlSchema,
    background: nullableUrlSchema,
  }),
  fields: z.object({
    header: z.array(passFieldSchema),
    primary: z.array(passFieldSchema),
    secondary: z.array(passFieldSchema),
    auxiliary: z.array(passFieldSchema),
    back: z.array(passFieldSchema),
  }),
  barcode: z.object({
    type: z.enum(BARCODE_TYPES),
    value: z.string().max(512),
    altText: z.string().max(128),
  }),
  validity: z.object({
    relevantDate: dateTimeSchema.nullable(),
    expirationDate: dateTimeSchema.nullable(),
    validFrom: dateTimeSchema.nullable(),
    validUntil: dateTimeSchema.nullable(),
    relevantDateEnabled: z.boolean(),
    expirationDateEnabled: z.boolean(),
    validFromEnabled: z.boolean(),
    validUntilEnabled: z.boolean(),
  }),
  locations: z.array(passLocationSchema),
  serialNumber: z.string().max(64).optional(),
  status: z.enum(PASS_STATUSES).optional(),
});

export type CommonPassInputParsed = z.infer<typeof commonPassInputSchema>;

export const fieldGroupSchema = z.enum(FIELD_GROUPS);

export function parseCommonPassInput(raw: unknown): CommonPassInputParsed {
  try {
    return normalizePassInputData(commonPassInputSchema.parse(raw));
  } catch (error) {
    if (error instanceof ZodError) {
      throw invalidRequest("Some pass fields are invalid. Check dates and required fields.", error.flatten());
    }
    throw error;
  }
}

export function safeParseCommonPassInput(raw: unknown) {
  return commonPassInputSchema.safeParse(raw);
}

/** Normalize nullable image URLs from form (empty string → null). */
export function normalizePassInput(raw: Record<string, unknown>): Record<string, unknown> {
  const appearance = raw.appearance as Record<string, unknown> | undefined;
  if (appearance) {
    for (const key of ["logo", "strip", "thumbnail", "background"] as const) {
      if (appearance[key] === "") appearance[key] = null;
    }
  }
  if (Array.isArray(raw.locations)) {
    raw.locations = raw.locations.filter(
      (location) =>
        typeof location === "object" &&
        location !== null &&
        !(
          (location as { latitude?: number }).latitude === 0 &&
          (location as { longitude?: number }).longitude === 0
        ),
    );
  }
  return raw;
}
