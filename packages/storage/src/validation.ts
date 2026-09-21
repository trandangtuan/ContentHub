import { randomBytes } from "node:crypto";
import { slugify } from "@contenthub/shared";

export type UploadPurpose = "cover" | "avatar" | "chapter-image";

const ALLOWED_MIME_TYPES: Record<UploadPurpose, string[]> = {
  cover: ["image/jpeg", "image/png", "image/webp"],
  avatar: ["image/jpeg", "image/png", "image/webp"],
  "chapter-image": ["image/jpeg", "image/png", "image/webp", "image/gif"],
};

const MAX_SIZE_BYTES: Record<UploadPurpose, number> = {
  cover: 5 * 1024 * 1024,
  avatar: 2 * 1024 * 1024,
  "chapter-image": 8 * 1024 * 1024,
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class InvalidUploadError extends Error {}

export function validateMimeType(mimeType: string, purpose: UploadPurpose): void {
  if (!ALLOWED_MIME_TYPES[purpose].includes(mimeType)) {
    throw new InvalidUploadError(`MIME type "${mimeType}" is not allowed for ${purpose} uploads.`);
  }
}

export function validateFileSize(sizeBytes: number, purpose: UploadPurpose): void {
  const max = MAX_SIZE_BYTES[purpose];
  if (sizeBytes <= 0 || sizeBytes > max) {
    throw new InvalidUploadError(`File size ${sizeBytes} bytes exceeds the ${max} byte limit for ${purpose} uploads.`);
  }
}

/**
 * Semantic, collision-resistant object key (docs/SEO.md #20): never persist
 * the client-supplied filename directly — that's an XSS/path-traversal
 * surface and produces filenames like IMG_12345.jpg with no SEO value.
 */
export function buildSafeObjectKey(params: { purpose: UploadPurpose; mimeType: string; contextSlug: string }): string {
  const extension = MIME_TO_EXTENSION[params.mimeType];
  if (!extension) {
    throw new InvalidUploadError(`Unsupported MIME type "${params.mimeType}" — no safe extension mapping.`);
  }

  const baseSlug = slugify(params.contextSlug) || "media";
  const suffix = params.purpose === "chapter-image" ? "img" : params.purpose;
  const unique = randomBytes(4).toString("hex");

  return `${params.purpose}/${baseSlug}-${suffix}-${unique}.${extension}`;
}
