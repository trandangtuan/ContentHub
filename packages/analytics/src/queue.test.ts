import { afterAll, describe, expect, it } from "vitest";
import { Queue, Worker } from "bullmq";
import { ViewEventProducer, VIEW_EVENTS_QUEUE_NAME, type QueuedViewEvent } from "./queue";

const connection = { host: "localhost", port: 6379 };
const secret = "test-ip-hash-secret";

describe("ViewEventProducer", () => {
  const producer = new ViewEventProducer(connection, secret);

  afterAll(async () => {
    await producer.close();
  });

  it("enqueues a job with hashed session id / ip, never the raw values", async () => {
    const received: Promise<QueuedViewEvent> = new Promise((resolve) => {
      const worker = new Worker<QueuedViewEvent>(
        VIEW_EVENTS_QUEUE_NAME,
        async (job) => {
          resolve(job.data);
          await worker.close();
        },
        { connection },
      );
    });

    await producer.enqueue(
      {
        contentId: "123e4567-e89b-12d3-a456-426614174000",
        sessionId: "raw-session-id-should-not-appear",
        event: "CONTENT_VIEW",
        timestamp: new Date().toISOString(),
        duration: 10,
      },
      { ip: "203.0.113.5" },
    );

    const job = await received;
    expect(job.sessionIdHash).not.toContain("raw-session-id-should-not-appear");
    expect(job.ipHash).toBeDefined();
    expect(job.ipHash).not.toBe("203.0.113.5");
  }, 15000);
});
