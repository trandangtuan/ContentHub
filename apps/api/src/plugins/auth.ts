import fp from "fastify-plugin";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { SessionService, issueCsrfToken, verifyCsrfToken, type Role } from "@contenthub/auth";
import { prisma } from "@contenthub/database";
import { UnauthorizedError, ForbiddenError } from "../errors.js";
import type { ApiConfig } from "../config.js";

export interface AuthedSession {
  userId: string;
  role: Role;
  creatorProfileId: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    session: AuthedSession | null;
    sessionToken: string | null;
  }
}

/**
 * Resolves the session cookie on every request (never trusts a client-sent
 * user id/role). CSRF is checked separately per mutating route via
 * `requireCsrf` so GET requests stay exempt.
 */
export default fp(async function authPlugin(app: FastifyInstance, opts: { config: ApiConfig }) {
  const sessionService = new SessionService(prisma);

  app.decorateRequest("session", null);
  app.decorateRequest("sessionToken", null);

  app.addHook("onRequest", async (request) => {
    const token = request.cookies[opts.config.sessionCookieName];
    if (!token) return;

    const session = await sessionService.verifySession(token);
    if (!session) return;

    request.session = {
      userId: session.user.id,
      role: session.user.role as Role,
      creatorProfileId: session.user.creatorProfile?.id ?? null,
    };
    request.sessionToken = token;
  });

  app.decorate("issueCsrfToken", (sessionToken: string) => issueCsrfToken(sessionToken, opts.config.sessionSecret));

  app.decorate("requireAuth", function requireAuth(request: FastifyRequest) {
    if (!request.session) throw new UnauthorizedError();
    return request.session;
  });

  app.decorate("requireRole", function requireRole(request: FastifyRequest, role: Role) {
    const session = app.requireAuth(request);
    const rank: Record<Role, number> = { READER: 0, CREATOR: 1, MODERATOR: 2, ADMIN: 3 };
    if (rank[session.role] < rank[role]) throw new ForbiddenError();
    return session;
  });

  app.decorate("requireCsrf", function requireCsrf(request: FastifyRequest) {
    const token = request.sessionToken;
    if (!token) throw new UnauthorizedError();
    const csrfHeader = request.headers["x-csrf-token"];
    if (typeof csrfHeader !== "string" || !verifyCsrfToken(csrfHeader, token, opts.config.sessionSecret)) {
      throw new ForbiddenError("Invalid or missing CSRF token");
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    issueCsrfToken(sessionToken: string): string;
    requireAuth(request: FastifyRequest): AuthedSession;
    requireRole(request: FastifyRequest, role: Role): AuthedSession;
    requireCsrf(request: FastifyRequest): void;
  }
}
