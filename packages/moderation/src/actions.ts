import type { PrismaClient, Prisma, ReportTargetType } from "@contenthub/database";

export type ModerationActionType =
  | "PUBLISH"
  | "UNPUBLISH"
  | "DELETE"
  | "RESTORE"
  | "NOINDEX"
  | "SUSPEND_CREATOR"
  | "REACTIVATE_USER";

export interface ApplyModerationActionParams {
  moderatorUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  action: ModerationActionType;
  reason?: string;
  reportId?: string;
}

/**
 * Every admin action that touches content/user/revenue state writes an
 * audit-trail row FIRST, then applies the effect — never the other way
 * around (spec #40, #82). All of this runs server-side; the client never
 * gets to flip a content's status directly by calling a moderation action.
 */
export async function applyModerationAction(db: PrismaClient, params: ApplyModerationActionParams) {
  return db.$transaction(async (tx) => {
    const action = await tx.moderationAction.create({
      data: {
        reportId: params.reportId,
        moderatorUserId: params.moderatorUserId,
        targetType: params.targetType,
        targetId: params.targetId,
        action: params.action,
        reason: params.reason,
      },
    });

    if (params.targetType === "CONTENT") {
      await applyContentEffect(tx, params.targetId, params.action);
    } else if (params.targetType === "USER" && params.action === "SUSPEND_CREATOR") {
      await tx.user.update({ where: { id: params.targetId }, data: { status: "SUSPENDED" } });
    } else if (params.targetType === "USER" && params.action === "REACTIVATE_USER") {
      await tx.user.update({ where: { id: params.targetId }, data: { status: "ACTIVE" } });
    }

    if (params.reportId) {
      await tx.moderationReport.update({ where: { id: params.reportId }, data: { status: "RESOLVED" } });
    }

    return action;
  });
}

async function applyContentEffect(tx: Prisma.TransactionClient, contentId: string, action: ModerationActionType) {
  switch (action) {
    case "PUBLISH":
      await tx.content.update({ where: { id: contentId }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      break;
    case "UNPUBLISH":
      await tx.content.update({ where: { id: contentId }, data: { status: "UNPUBLISHED" } });
      break;
    case "DELETE":
      // Soft delete only — important content is never hard-deleted (spec #3).
      await tx.content.update({ where: { id: contentId }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
      break;
    case "RESTORE":
      await tx.content.update({ where: { id: contentId }, data: { deletedAt: null } });
      break;
    case "NOINDEX":
      await tx.seoMetadata.upsert({
        where: { contentId },
        create: { contentId, noindex: true },
        update: { noindex: true },
      });
      break;
    case "SUSPEND_CREATOR":
    case "REACTIVATE_USER":
      break; // handled at the USER target type, not CONTENT
  }
}
