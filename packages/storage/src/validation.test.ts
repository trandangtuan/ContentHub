import { describe, expect, it } from "vitest";
import { validateMimeType, validateFileSize, buildSafeObjectKey, InvalidUploadError } from "./validation";

describe("validateMimeType", () => {
  it("accepts allowed types for the purpose", () => {
    expect(() => validateMimeType("image/webp", "cover")).not.toThrow();
  });

  it("rejects disallowed types", () => {
    expect(() => validateMimeType("application/x-msdownload", "cover")).toThrow(InvalidUploadError);
    expect(() => validateMimeType("text/html", "avatar")).toThrow(InvalidUploadError);
  });

  it("allows gif for chapter images but not for avatars", () => {
    expect(() => validateMimeType("image/gif", "chapter-image")).not.toThrow();
    expect(() => validateMimeType("image/gif", "avatar")).toThrow(InvalidUploadError);
  });
});

describe("validateFileSize", () => {
  it("accepts sizes within the per-purpose limit", () => {
    expect(() => validateFileSize(1024, "avatar")).not.toThrow();
  });

  it("rejects zero or negative sizes", () => {
    expect(() => validateFileSize(0, "avatar")).toThrow(InvalidUploadError);
  });

  it("rejects sizes over the limit", () => {
    expect(() => validateFileSize(100 * 1024 * 1024, "avatar")).toThrow(InvalidUploadError);
  });
});

describe("buildSafeObjectKey", () => {
  it("builds a semantic filename from the context slug, not the client filename", () => {
    const key = buildSafeObjectKey({ purpose: "cover", mimeType: "image/webp", contextSlug: "Tu Tiên 1000 Năm" });
    expect(key).toMatch(/^cover\/tu-tien-1000-nam-cover-[a-f0-9]{8}\.webp$/);
  });

  it("never trusts a raw client filename like IMG_12345.jpg", () => {
    const key = buildSafeObjectKey({ purpose: "avatar", mimeType: "image/jpeg", contextSlug: "user 42" });
    expect(key).not.toContain("IMG_");
    expect(key.endsWith(".jpg")).toBe(true);
  });

  it("throws for an unsupported mime type", () => {
    expect(() => buildSafeObjectKey({ purpose: "cover", mimeType: "application/pdf", contextSlug: "x" })).toThrow(
      InvalidUploadError,
    );
  });

  it("falls back to a generic slug when the context slugifies to nothing", () => {
    const key = buildSafeObjectKey({ purpose: "cover", mimeType: "image/png", contextSlug: "修仙" });
    expect(key).toMatch(/^cover\/media-cover-[a-f0-9]{8}\.png$/);
  });
});
