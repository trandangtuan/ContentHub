import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StorageProvider, UploadInput, UploadResult } from "./provider";

export interface LocalProviderConfig {
  /** Absolute path on disk to write uploads under. */
  baseDir: string;
  /** Absolute URL prefix files are served back at, no trailing slash (e.g. a route backed by @fastify/static). */
  publicUrlBase: string;
}

/**
 * Saves uploads to local disk instead of S3 — same StorageProvider contract
 * as S3StorageProvider, so callers never know which one they're using.
 * `key` always comes from buildSafeObjectKey (packages/storage/validation.ts),
 * never raw client input, so there's no path-traversal surface here to guard
 * against separately.
 *
 * Good enough for a single API instance with a persistent volume; doesn't
 * survive horizontal scaling (each replica would have its own disk) — swap
 * in S3StorageProvider before running more than one API replica.
 */
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly config: LocalProviderConfig) {}

  async upload({ key, body }: UploadInput): Promise<UploadResult> {
    const filePath = join(this.config.baseDir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return { key, url: this.getPublicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.config.baseDir, key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  getPublicUrl(key: string): string {
    return `${this.config.publicUrlBase}/${key}`;
  }
}
