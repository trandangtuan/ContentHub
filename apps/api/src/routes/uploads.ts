import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LocalStorageProvider, validateMimeType, validateFileSize, buildSafeObjectKey, InvalidUploadError, type UploadPurpose } from "@contenthub/storage";
import { ValidationError } from "../errors.js";
import type { ApiConfig } from "../config.js";

const purposeSchema = z.object({ purpose: z.enum(["cover", "avatar", "chapter-image"]) });
const querySchema = z.object({ contextSlug: z.string().max(100).optional() });

/**
 * Local-disk file uploads (images/audio/video "basic" storage — docs/
 * ARCHITECTURE.md's StorageProvider abstraction). Any creator can upload;
 * the returned URL is a plain string the caller stores wherever it already
 * stores a URL (Content.coverImage, CreatorProfile.avatarUrl, or inline
 * <img> src in chapter bodyHtml) — no schema change needed for any of those.
 *
 * Swap LocalStorageProvider for S3StorageProvider here (same interface)
 * once uploads need to survive horizontal scaling.
 */
export function registerUploadRoutes(app: FastifyInstance, config: ApiConfig) {
  const storageProvider = new LocalStorageProvider({
    baseDir: config.uploadsDir,
    publicUrlBase: `${config.publicUrl}/api/uploads`,
  });

  app.post("/creator/uploads/:purpose", async (request, reply) => {
    const session = app.requireRole(request, "CREATOR");
    app.requireCsrf(request);
    const { purpose } = purposeSchema.parse(request.params);
    const { contextSlug } = querySchema.parse(request.query);

    const file = await request.file();
    if (!file) throw new ValidationError("No file uploaded");
    const buffer = await file.toBuffer();

    try {
      validateMimeType(file.mimetype, purpose as UploadPurpose);
      validateFileSize(buffer.length, purpose as UploadPurpose);
    } catch (err) {
      if (err instanceof InvalidUploadError) throw new ValidationError(err.message);
      throw err;
    }

    const key = buildSafeObjectKey({
      purpose: purpose as UploadPurpose,
      mimeType: file.mimetype,
      contextSlug: contextSlug ?? session.creatorProfileId ?? "media",
    });
    const result = await storageProvider.upload({ key, body: buffer, contentType: file.mimetype });

    reply.status(201).send(result);
  });
}
