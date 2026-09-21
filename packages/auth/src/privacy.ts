import { createHash } from "node:crypto";

/**
 * One-way hash for IPs before they're ever persisted (sessions.ip_hash,
 * content_events.ip_hash). Salted with a server secret so hashes aren't
 * reversible via rainbow tables, and never store the raw IP (spec #37).
 */
export function hashIp(ip: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}
