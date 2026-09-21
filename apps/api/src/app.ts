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

export function buildApp(config: ApiConfig): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });

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
    },
    { prefix: "/api/v1" },
  );

  return app;
}
