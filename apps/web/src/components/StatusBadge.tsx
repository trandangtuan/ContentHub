const TONE_BY_STATUS: Record<string, "success" | "warning" | "danger" | "info" | "primary" | undefined> = {
  PUBLISHED: "success",
  ACTIVE: "success",
  PAID: "success",
  RESOLVED: "success",
  DRAFT: undefined,
  PENDING: "warning",
  PENDING_REVIEW: "warning",
  PROCESSING: "warning",
  REVIEWING: "warning",
  SCHEDULED: "info",
  OPEN: "info",
  UNPUBLISHED: undefined,
  REJECTED: "danger",
  ARCHIVED: undefined,
  SUSPENDED: "danger",
  BANNED: "danger",
  FAILED: "danger",
  REVERSED: "danger",
};

/** Small colored pill for entity status fields (content/user/report/payout ...), shared across dashboard and admin tables. */
export function StatusBadge({ status }: { status: string }) {
  const tone = TONE_BY_STATUS[status];
  return <span className={`badge${tone ? ` badge-${tone}` : ""}`}>{status.replace(/_/g, " ")}</span>;
}
