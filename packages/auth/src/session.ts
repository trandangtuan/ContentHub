import { randomBytes, createHash } from "node:crypto";
import type { PrismaClient } from "@contenthub/database";

const TOKEN_BYTES = 32;

/** Opaque, unguessable session token. Only its SHA-256 hash is ever persisted. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionCookieOptions {
  name: string;
  value: string;
  maxAgeSeconds: number;
  secure: boolean;
}

export function buildSessionCookie(name: string, token: string, ttlDays: number, secure: boolean): SessionCookieOptions {
  return {
    name,
    value: token,
    maxAgeSeconds: ttlDays * 24 * 60 * 60,
    secure,
  };
}

export interface CreateSessionParams {
  userId: string;
  ttlDays: number;
  userAgent?: string;
  ipHash?: string;
}

/**
 * Session persistence, kept as a thin class over PrismaClient so the token
 * crypto above stays independently unit-testable without a database.
 */
export class SessionService {
  constructor(private readonly db: PrismaClient) {}

  async createSession({ userId, ttlDays, userAgent, ipHash }: CreateSessionParams) {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    await this.db.session.create({
      data: { userId, tokenHash, expiresAt, userAgent, ipHash },
    });

    return { token, expiresAt };
  }

  async verifySession(token: string) {
    const tokenHash = hashSessionToken(token);
    const session = await this.db.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { creatorProfile: true } } },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }
    if (session.user.deletedAt || session.user.status !== "ACTIVE") {
      return null;
    }

    return session;
  }

  async revokeSession(token: string) {
    const tokenHash = hashSessionToken(token);
    await this.db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
