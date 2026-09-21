import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hashPassword, verifyPassword, SessionService, WeakPasswordError } from "@contenthub/auth";
import { prisma } from "@contenthub/database";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors.js";
import type { ApiConfig } from "../config.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance, config: ApiConfig) {
  const sessions = new SessionService(prisma);

  function setSessionCookie(reply: import("fastify").FastifyReply, token: string) {
    reply.setCookie(config.sessionCookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: config.sessionTtlDays * 24 * 60 * 60,
    });
  }

  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ConflictError("An account with this email already exists");

    let passwordHash: string;
    try {
      passwordHash = await hashPassword(body.password);
    } catch (err) {
      if (err instanceof WeakPasswordError) throw new ValidationError(err.message);
      throw err;
    }

    const user = await prisma.user.create({
      data: { email: body.email, passwordHash, displayName: body.displayName },
    });

    const { token } = await sessions.createSession({ userId: user.id, ttlDays: config.sessionTtlDays, userAgent: request.headers["user-agent"] });
    setSessionCookie(reply, token);

    reply.status(201).send({ id: user.id, email: user.email, displayName: user.displayName, role: user.role });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid email or password");
    }
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedError("This account is not active");
    }

    const { token } = await sessions.createSession({ userId: user.id, ttlDays: config.sessionTtlDays, userAgent: request.headers["user-agent"] });
    setSessionCookie(reply, token);

    reply.send({ id: user.id, email: user.email, displayName: user.displayName, role: user.role });
  });

  app.post("/auth/logout", async (request, reply) => {
    if (request.sessionToken) {
      await sessions.revokeSession(request.sessionToken);
    }
    reply.clearCookie(config.sessionCookieName, { path: "/" });
    reply.status(204).send();
  });

  app.get("/auth/session", async (request, reply) => {
    if (!request.session) {
      reply.status(200).send({ authenticated: false });
      return;
    }

    const csrfToken = request.sessionToken ? app.issueCsrfToken(request.sessionToken) : null;
    reply.send({ authenticated: true, ...request.session, csrfToken });
  });
}
