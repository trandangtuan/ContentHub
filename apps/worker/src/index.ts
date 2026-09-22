import { Worker, type ConnectionOptions } from "bullmq";
import { prisma } from "@contenthub/database";
import { VIEW_EVENTS_QUEUE_NAME, aggregateViewEventsBatch, type QueuedViewEvent } from "@contenthub/analytics";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

function parseRedisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    password: url.password || undefined,
  };
}

/**
 * Consumes the view-event queue (docs/REVENUE.md #36: Browser -> API
 * collector -> Queue -> Worker (this process) -> Aggregation -> ContentView).
 * The API layer only ever enqueues — this is the one place that turns a raw
 * event into a RAW/VALID/QUALIFIED/MONETIZED-classified row, outside the
 * request/response cycle so a burst of readers never slows down page loads.
 *
 * One job at a time (concurrency covers throughput) rather than manually
 * batching multiple jobs per DB write — simpler and still correct, since
 * aggregateViewEventsBatch's upsert increments rather than replaces. Revisit
 * if per-event DB round-trips become the bottleneck at higher traffic.
 */
const connection = parseRedisConnection(requireEnv("REDIS_URL"));

const worker = new Worker<QueuedViewEvent>(
  VIEW_EVENTS_QUEUE_NAME,
  async (job) => {
    await aggregateViewEventsBatch(prisma, [job.data]);
  },
  { connection, concurrency: 5 },
);

worker.on("ready", () => {
  console.log("ContentHub view-events worker ready");
});

worker.on("failed", (job, err) => {
  console.error(`view-event job ${job?.id} failed:`, err);
});

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
