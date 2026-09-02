import "server-only";

import { errorResponse, jsonResponse } from "@/lib/api/responses";
import { isDatabaseConfigured } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/server";
import { getOwnerIdFromRouteHandler } from "@/lib/session";
import { invalidRequest } from "@/lib/wallet/common/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "pass-assets";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);

const EXTENSION_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function resolveContentType(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_TO_MIME[ext]) return EXTENSION_TO_MIME[ext];
  return null;
}

function extensionForContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

async function ensureBucket(client: ReturnType<typeof getServiceClient>) {
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) return;
  if (buckets?.some((bucket) => bucket.name === BUCKET)) return;
  await client.storage.createBucket(BUCKET, { public: true });
}

function explainUploadError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("bucket") && lower.includes("not found")) {
    return 'Storage bucket "pass-assets" is missing. Run supabase/migrations/0002_dynamic_passes.sql in Supabase.';
  }
  if (lower.includes("row-level security") || lower.includes("policy")) {
    return "Storage permissions blocked the upload. Confirm the pass-assets bucket exists and is public.";
  }
  return "Could not upload the image.";
}

export async function POST(request: Request) {
  try {
    const ownerId = await getOwnerIdFromRouteHandler(request);
    if (!ownerId) {
      throw invalidRequest("Owner session is required for uploads. Refresh the page and try again.");
    }

    if (!isDatabaseConfigured()) {
      return jsonResponse({
        url: null,
        message: "Storage is unavailable in memory mode. Use an external image URL instead.",
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const passId = formData.get("passId");
    const assetType = formData.get("assetType");

    if (!(file instanceof File)) throw invalidRequest("A file is required.");
    if (typeof passId !== "string" || !passId) throw invalidRequest("passId is required.");
    if (typeof assetType !== "string" || !["logo", "strip", "thumbnail", "background"].includes(assetType)) {
      throw invalidRequest("assetType must be logo, strip, thumbnail, or background.");
    }

    const contentType = resolveContentType(file);
    if (!contentType) {
      throw invalidRequest("Only PNG, JPEG, WebP, and GIF images are allowed.");
    }

    if (file.size > MAX_SIZE) {
      throw invalidRequest("Image must be smaller than 5 MB.");
    }

    const ext = extensionForContentType(contentType);
    const path = `${ownerId}/${passId}/${assetType}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const client = getServiceClient();
    await ensureBucket(client);
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

    if (uploadError) {
      throw invalidRequest(explainUploadError(uploadError.message), uploadError.message);
    }

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    const url = `${data.publicUrl}${data.publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;

    return jsonResponse({ url, path });
  } catch (error) {
    return errorResponse(error, { route: "POST /api/storage/upload" });
  }
}
