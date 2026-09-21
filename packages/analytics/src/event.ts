import { z } from "zod";

/**
 * Client-submitted view event (docs REVENUE.md/spec #37). This is RAW input
 * only — the client can describe what happened (duration, scroll depth) but
 * can never claim a qualification stage; that's computed server-side by the
 * aggregation worker from packages/revenue's view-qualification logic
 * (spec #82 rule 9/10).
 */
export const viewEventSchema = z.object({
  contentId: z.string().uuid(),
  contentPartId: z.string().uuid().optional(),
  sessionId: z.string().min(8).max(128),
  event: z.literal("CONTENT_VIEW"),
  timestamp: z.string().datetime(),
  duration: z.number().min(0).max(24 * 60 * 60).optional(),
  scrollDepth: z.number().min(0).max(1).optional(),
});

export type ViewEventInput = z.infer<typeof viewEventSchema>;
