import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, WeakPasswordError } from "./password";

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("Password123!");
    expect(await verifyPassword("Password123!", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("Password123!");
    expect(await verifyPassword("WrongPassword!", hash)).toBe(false);
  });

  it("rejects passwords under the minimum length", async () => {
    await expect(hashPassword("short")).rejects.toThrow(WeakPasswordError);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("Password123!");
    const b = await hashPassword("Password123!");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("Password123!", "not-a-valid-hash")).toBe(false);
  });
});
