import "server-only";

/**
 * Normalizes Apple signing material from Vercel / local env vars.
 *
 * Accepts:
 * - Raw PEM text (with literal `\n` escapes, as Vercel often stores them)
 * - Base64-encoded PEM text
 * - Base64-encoded DER (returned as-is for downstream validation)
 */
export function decodePemMaterial(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("empty signing material");
  }

  const unescaped = trimmed.replace(/\\n/g, "\n");
  if (unescaped.startsWith("-----BEGIN")) {
    return Buffer.from(unescaped.endsWith("\n") ? unescaped : `${unescaped}\n`, "utf8");
  }

  const normalized = trimmed.replace(/\s/g, "");
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length === 0) {
    throw new Error("base64 decoded to an empty buffer");
  }

  const preview = decoded.subarray(0, 256).toString("utf8");
  if (preview.includes("-----BEGIN")) {
    return decoded;
  }

  return decoded;
}

export function looksLikePemMaterial(raw: string | undefined): boolean {
  if (!raw?.trim()) return false;
  const unescaped = raw.trim().replace(/\\n/g, "\n");
  if (unescaped.startsWith("-----BEGIN")) return true;
  try {
    const decoded = decodePemMaterial(raw);
    return decoded.subarray(0, 256).toString("utf8").includes("-----BEGIN");
  } catch {
    return raw.trim().length > 0;
  }
}
