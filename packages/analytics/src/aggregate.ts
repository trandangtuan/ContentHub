import type { PrismaClient } from "@contenthub/database";
import { qualifyView, aggregateViewStages, type RawViewEvent } from "@contenthub/revenue";
import type { QueuedViewEvent } from "./queue";

function dateOnly(iso: string): Date {
  const d = new Date(iso);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Aggregation worker step (docs REVENUE.md #36): consumes a batch of raw
 * queued view events and upserts today's ContentView row per (content,
 * contentPart, date) — this is what analytics/revenue calculations read,
 * never the raw event log directly.
 */
export async function aggregateViewEventsBatch(db: PrismaClient, events: QueuedViewEvent[]): Promise<void> {
  // MVP scope (STORY only): every view is of a specific chapter, so
  // contentPartId is required here. Postgres treats NULL as distinct in a
  // unique constraint, which makes Prisma's composite-key upsert unreliable
  // for a nullable column — rather than work around that with a sentinel
  // value, content-level (whole-story) totals are computed by summing across
  // parts at query time instead of stored as a null-contentPartId row.
  const withPart = events.filter((e): e is QueuedViewEvent & { contentPartId: string } => Boolean(e.contentPartId));

  const groups = new Map<string, { contentId: string; contentPartId: string; date: Date; events: RawViewEvent[] }>();

  for (const event of withPart) {
    const date = dateOnly(event.occurredAt);
    const key = `${event.contentId}:${event.contentPartId}:${date.toISOString()}`;
    const group = groups.get(key) ?? { contentId: event.contentId, contentPartId: event.contentPartId, date, events: [] };
    group.events.push({
      durationSec: event.durationSec ?? null,
      scrollDepth: event.scrollDepth ?? null,
      isSuspectedBot: false, // fraud/bot detection is a dedicated future worker step; MVP treats all non-empty sessions as human
    });
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const content = await db.content.findUnique({ where: { id: group.contentId }, select: { status: true, visibility: true } });
    const contentIsMonetizable = content?.status === "PUBLISHED" && content?.visibility === "PUBLIC";

    const stages = group.events.map((event) => qualifyView({ event, contentIsMonetizable }));
    const counts = aggregateViewStages(stages);

    await db.contentView.upsert({
      where: {
        contentId_contentPartId_date: {
          contentId: group.contentId,
          contentPartId: group.contentPartId,
          date: group.date,
        },
      },
      create: {
        contentId: group.contentId,
        contentPartId: group.contentPartId,
        date: group.date,
        ...counts,
      },
      update: {
        rawViews: { increment: counts.rawViews },
        validViews: { increment: counts.validViews },
        qualifiedViews: { increment: counts.qualifiedViews },
        monetizedViews: { increment: counts.monetizedViews },
      },
    });
  }
}
