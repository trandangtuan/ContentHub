import { Queue, type ConnectionOptions } from "bullmq";
import { hashIp } from "@contenthub/auth";
import type { ViewEventInput } from "./event";

export const VIEW_EVENTS_QUEUE_NAME = "content-view-events";

export interface QueuedViewEvent {
  contentId: string;
  contentPartId?: string;
  sessionIdHash: string;
  userId?: string;
  ipHash?: string;
  eventType: "CONTENT_VIEW";
  occurredAt: string;
  durationSec?: number;
  scrollDepth?: number;
}

/**
 * Event ingestion pipeline (docs REVENUE.md #36): Browser -> API collector ->
 * Queue -> Worker -> Aggregation -> Analytics DB. The API layer never writes
 * one row per HTTP request directly; it enqueues, and a separate worker
 * (outside the request/response cycle) does the aggregation.
 */
export class ViewEventProducer {
  private readonly queue: Queue<QueuedViewEvent>;

  constructor(connection: ConnectionOptions, private readonly ipHashSecret: string) {
    this.queue = new Queue<QueuedViewEvent>(VIEW_EVENTS_QUEUE_NAME, { connection });
  }

  async enqueue(input: ViewEventInput, context: { userId?: string; ip?: string }) {
    const job: QueuedViewEvent = {
      contentId: input.contentId,
      contentPartId: input.contentPartId,
      sessionIdHash: hashIp(input.sessionId, this.ipHashSecret), // same one-way hashing as IPs — never store the raw session id either
      userId: context.userId,
      ipHash: context.ip ? hashIp(context.ip, this.ipHashSecret) : undefined,
      eventType: "CONTENT_VIEW",
      occurredAt: input.timestamp,
      durationSec: input.duration,
      scrollDepth: input.scrollDepth,
    };

    await this.queue.add("view-event", job, {
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }

  async close() {
    await this.queue.close();
  }
}
