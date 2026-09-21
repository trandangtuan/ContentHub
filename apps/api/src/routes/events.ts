import type { FastifyInstance } from "fastify";
import { viewEventSchema, ViewEventProducer } from "@contenthub/analytics";
import type { ApiConfig } from "../config.js";

/**
 * View event ingestion (spec #36-37). The client only ever gets to describe
 * what happened (duration, scroll depth) — never a view count, and never a
 * qualification stage. This just enqueues; the aggregation worker (outside
 * the request/response cycle) does everything that matters for revenue.
 */
function parseRedisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    password: url.password || undefined,
  };
}

export function registerEventRoutes(app: FastifyInstance, config: ApiConfig) {
  const producer = new ViewEventProducer(parseRedisConnection(config.redisUrl), config.ipHashSecret);

  app.post(
    "/events/view",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = viewEventSchema.parse(request.body);
      await producer.enqueue(body, {
        userId: request.session?.userId,
        ip: request.ip,
      });
      reply.status(202).send({ accepted: true });
    },
  );

  app.addHook("onClose", async () => {
    await producer.close();
  });
}
