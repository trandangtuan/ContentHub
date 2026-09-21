import "./bigint-json.js";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import type { ApiConfig } from "./config.js";
import { AppError } from "./errors.js";
import authPlugin from "./plugins/auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCreatorRoutes } from "./routes/creator.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerAdminRoutes } from "./routes/admin.js";

export function buildApp(config: ApiConfig): FastifyInstance {
  // Disabled in tests to keep output quiet; otherwise unhandled errors in
  // the error handler below would be silently swallowed (Fastify's no-op
  // logger discards .error() calls), making 500s undiagnosable in prod logs.
  const isTest = process.env.NODE_ENV === "test";
  const app = Fastify({ logger: isTest ? false : { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true });

  app.register(cors, { origin: config.corsOrigins, credentials: true });
  app.register(cookie);
  app.register(rateLimit, { max: config.rateLimitMax, timeWindow: config.rateLimitWindowMs });
  app.register(authPlugin, { config });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      reply.status(422).send({ error: "VALIDATION_ERROR", message: "Invalid input", details: error.flatten() });
      return;
    }
    // @fastify/rate-limit throws a plain error with statusCode 429
    if ((error as { statusCode?: number }).statusCode === 429) {
      reply.status(429).send({ error: "RATE_LIMITED", message: "Too many requests" });
      return;
    }
    // Fastify's own errors (malformed/empty JSON body, payload too large,
    // unsupported media type, etc.) already carry a real 4xx statusCode —
    // surface it instead of masking a client mistake as a 500.
    const fastifyStatus = (error as { statusCode?: number }).statusCode;
    if (fastifyStatus && fastifyStatus >= 400 && fastifyStatus < 500) {
      const fastifyError = error as { code?: string; message: string };
      reply.status(fastifyStatus).send({ error: fastifyError.code ?? "BAD_REQUEST", message: fastifyError.message });
      return;
    }
    app.log.error(error);
    reply.status(500).send({ error: "INTERNAL_ERROR", message: "Something went wrong" });
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(
    async (v1) => {
      registerAuthRoutes(v1, config);
      registerCreatorRoutes(v1);
      registerPublicRoutes(v1);
      registerEventRoutes(v1, config);
      registerAdminRoutes(v1);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
