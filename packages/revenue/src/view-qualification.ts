/**
 * RAW VIEW -> VALID VIEW -> QUALIFIED VIEW -> MONETIZED VIEW pipeline
 * (docs/REVENUE.md). This runs server-side only, on the aggregation worker —
 * a client can send a view event, but it can never claim to be "qualified"
 * or "monetized" itself (spec #82 rule 9/10).
 */
export type ViewStage = "RAW" | "VALID" | "QUALIFIED" | "MONETIZED";

export interface RawViewEvent {
  durationSec: number | null;
  scrollDepth: number | null;
  isSuspectedBot: boolean;
}

export interface QualificationThresholds {
  minValidDurationSec: number;
  minQualifiedDurationSec: number;
  minQualifiedScrollDepth: number;
}

export const DEFAULT_QUALIFICATION_THRESHOLDS: QualificationThresholds = {
  minValidDurationSec: 3,
  minQualifiedDurationSec: 20,
  minQualifiedScrollDepth: 0.3,
};

export interface QualifyViewParams {
  event: RawViewEvent;
  contentIsMonetizable: boolean;
  thresholds?: QualificationThresholds;
}

/**
 * Every event starts RAW. It advances a stage at a time — a view can't skip
 * straight to MONETIZED without first being VALID and QUALIFIED.
 */
export function qualifyView({ event, contentIsMonetizable, thresholds = DEFAULT_QUALIFICATION_THRESHOLDS }: QualifyViewParams): ViewStage {
  if (event.isSuspectedBot) return "RAW";

  const duration = event.durationSec ?? 0;
  if (duration < thresholds.minValidDurationSec) return "RAW";

  const scrollDepth = event.scrollDepth ?? 0;
  const isQualified = duration >= thresholds.minQualifiedDurationSec && scrollDepth >= thresholds.minQualifiedScrollDepth;
  if (!isQualified) return "VALID";

  return contentIsMonetizable ? "MONETIZED" : "QUALIFIED";
}

/** Rolls up a batch of per-event stages into daily aggregate counters (what content_views actually stores). */
export function aggregateViewStages(stages: ViewStage[]): { rawViews: number; validViews: number; qualifiedViews: number; monetizedViews: number } {
  return stages.reduce(
    (acc, stage) => {
      acc.rawViews += 1;
      if (stage === "VALID" || stage === "QUALIFIED" || stage === "MONETIZED") acc.validViews += 1;
      if (stage === "QUALIFIED" || stage === "MONETIZED") acc.qualifiedViews += 1;
      if (stage === "MONETIZED") acc.monetizedViews += 1;
      return acc;
    },
    { rawViews: 0, validViews: 0, qualifiedViews: 0, monetizedViews: 0 },
  );
}
