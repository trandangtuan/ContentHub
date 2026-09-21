import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "./jwt";

const config = { secret: "test-secret-at-least-32-chars-long!!", issuer: "contenthub", ttlSeconds: 3600 };

describe("access tokens", () => {
  it("round-trips valid claims", async () => {
    const token = await signAccessToken({ userId: "user-1", role: "CREATOR" }, config);
    const claims = await verifyAccessToken(token, config);
    expect(claims?.sub).toBe("user-1");
    expect(claims?.role).toBe("CREATOR");
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signAccessToken({ userId: "user-1", role: "CREATOR" }, config);
    const claims = await verifyAccessToken(token, { ...config, secret: "a-completely-different-secret!!" });
    expect(claims).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await signAccessToken({ userId: "user-1", role: "CREATOR" }, { ...config, ttlSeconds: -10 });
    const claims = await verifyAccessToken(token, config);
    expect(claims).toBeNull();
  });

  it("rejects a token from a different issuer", async () => {
    const token = await signAccessToken({ userId: "user-1", role: "CREATOR" }, { ...config, issuer: "someone-else" });
    const claims = await verifyAccessToken(token, config);
    expect(claims).toBeNull();
  });
});
