import type { PrismaClient, ReportTargetType } from "@contenthub/database";

export interface CreateReportParams {
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}

/** Report content/user/comment (docs/SECURITY.md, spec #41). Always starts OPEN. */
export async function createModerationReport(db: PrismaClient, params: CreateReportParams) {
  return db.moderationReport.create({
    data: {
      reporterUserId: params.reporterUserId,
      targetType: params.targetType,
      targetId: params.targetId,
      reason: params.reason,
      details: params.details,
    },
  });
}

export type ReportStatusTransition = "REVIEWING" | "RESOLVED" | "REJECTED";

const VALID_TRANSITIONS: Record<string, ReportStatusTransition[]> = {
  OPEN: ["REVIEWING", "REJECTED"],
  REVIEWING: ["RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
};

export class InvalidReportTransitionError extends Error {}

export async function transitionReportStatus(db: PrismaClient, reportId: string, next: ReportStatusTransition) {
  const report = await db.moderationReport.findUniqueOrThrow({ where: { id: reportId } });
  if (!VALID_TRANSITIONS[report.status]?.includes(next)) {
    throw new InvalidReportTransitionError(`Cannot move report from ${report.status} to ${next}`);
  }
  return db.moderationReport.update({ where: { id: reportId }, data: { status: next } });
}
