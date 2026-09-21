import { describe, expect, it } from "vitest";
import { issueCsrfToken, verifyCsrfToken } from "./csrf";

const secret = "csrf-secret";
const sessionToken = "session-abc-123";

describe("csrf tokens", () => {
  it("verifies a token issued for the same session", () => {
    const token = issueCsrfToken(sessionToken, secret);
    expect(verifyCsrfToken(token, sessionToken, secret)).toBe(true);
  });

  it("rejects a token replayed against a different session", () => {
    const token = issueCsrfToken(sessionToken, secret);
    expect(verifyCsrfToken(token, "a-different-session", secret)).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = issueCsrfToken(sessionToken, secret);
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(verifyCsrfToken(tampered, sessionToken, secret)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(verifyCsrfToken("not-a-real-token", sessionToken, secret)).toBe(false);
  });
});
