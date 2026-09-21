import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Double-submit-cookie CSRF protection: the server issues a token tied to the
 * session via HMAC, the client echoes it back in a header on mutating
 * requests, and the server verifies the HMAC without needing server-side
 * storage per token.
 */
export function issueCsrfToken(sessionToken: string, secret: string): string {
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", secret).update(`${sessionToken}.${nonce}`).digest("hex");
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(csrfToken: string, sessionToken: string, secret: string): boolean {
  const [nonce, signature] = csrfToken.split(".");
  if (!nonce || !signature) return false;

  const expected = createHmac("sha256", secret).update(`${sessionToken}.${nonce}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
