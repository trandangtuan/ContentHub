import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "./local-provider";

describe("LocalStorageProvider", () => {
  let baseDir: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), "contenthub-storage-test-"));
    provider = new LocalStorageProvider({ baseDir, publicUrlBase: "https://contenthub.tdshift.info/api/uploads" });
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it("writes the file under baseDir, creating nested directories as needed", async () => {
    const result = await provider.upload({ key: "cover/truyen-abc123.jpg", body: Buffer.from("fake-jpg-bytes"), contentType: "image/jpeg" });

    expect(result.key).toBe("cover/truyen-abc123.jpg");
    const written = await readFile(join(baseDir, "cover/truyen-abc123.jpg"));
    expect(written.toString()).toBe("fake-jpg-bytes");
  });

  it("returns an absolute public URL built from publicUrlBase + key", async () => {
    const result = await provider.upload({ key: "avatar/tdshift-avatar-deadbeef.png", body: Buffer.from("x"), contentType: "image/png" });
    expect(result.url).toBe("https://contenthub.tdshift.info/api/uploads/avatar/tdshift-avatar-deadbeef.png");
    expect(provider.getPublicUrl("avatar/tdshift-avatar-deadbeef.png")).toBe(result.url);
  });

  it("deletes an uploaded file", async () => {
    await provider.upload({ key: "cover/x.jpg", body: Buffer.from("x"), contentType: "image/jpeg" });
    await provider.delete("cover/x.jpg");
    await expect(readFile(join(baseDir, "cover/x.jpg"))).rejects.toThrow();
  });

  it("deleting a file that doesn't exist is a no-op, not an error", async () => {
    await expect(provider.delete("cover/never-existed.jpg")).resolves.toBeUndefined();
  });
});
