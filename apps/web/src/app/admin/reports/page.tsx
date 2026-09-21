"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/lib/use-session";
import { api, type AdminReport } from "@/lib/api-client";

const ACTIONS = ["PUBLISH", "UNPUBLISH", "DELETE", "RESTORE", "NOINDEX", "SUSPEND_CREATOR", "REACTIVATE_USER"];

// useSearchParams() requires a Suspense boundary or Next bails out of
// static prerendering with a build error — this page is fully
// client-rendered anyway, so the fallback is never visible in practice.
export default function AdminReportsPage() {
  return (
    <Suspense fallback={<p>Đang tải...</p>}>
      <AdminReportsPageInner />
    </Suspense>
  );
}

function AdminReportsPageInner() {
  const { session } = useSession();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [reports, setReports] = useState<AdminReport[] | null>(null);

  async function load() {
    const res = await api.admin.listReports({ status: status || undefined, limit: 50 });
    setReports(res.items);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function review(id: string) {
    if (!session?.csrfToken) return;
    await api.admin.reviewReport(session.csrfToken, id);
    load();
  }

  async function reject(id: string) {
    if (!session?.csrfToken) return;
    await api.admin.rejectReport(session.csrfToken, id);
    load();
  }

  async function resolveWithAction(report: AdminReport) {
    if (!session?.csrfToken) return;
    const action = window.prompt(`Chọn action để xử lý report này (${ACTIONS.join(" | ")}):`, "UNPUBLISH");
    if (!action || !ACTIONS.includes(action)) return;
    if ((action === "SUSPEND_CREATOR" || action === "REACTIVATE_USER") && session.role !== "ADMIN") {
      alert("Chỉ ADMIN mới được suspend/reactivate tài khoản.");
      return;
    }
    const reason = window.prompt("Lý do?") ?? undefined;
    await api.admin.resolveReportWithAction(session.csrfToken, report.id, { targetType: report.targetType, targetId: report.targetId, action, reason });
    load();
  }

  return (
    <section>
      <h1>Reports</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">Tất cả</option>
        <option value="OPEN">OPEN</option>
        <option value="REVIEWING">REVIEWING</option>
        <option value="RESOLVED">RESOLVED</option>
        <option value="REJECTED">REJECTED</option>
      </select>

      {reports === null ? (
        <p>Đang tải...</p>
      ) : reports.length === 0 ? (
        <p>Không có report nào.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Loại</th>
              <th>Target ID</th>
              <th>Lý do</th>
              <th>Người báo cáo</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{r.targetType}</td>
                <td title={r.targetId}>{r.targetId.slice(0, 8)}…</td>
                <td>{r.reason}</td>
                <td>{r.reporter.email}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === "OPEN" && (
                    <button type="button" onClick={() => review(r.id)}>
                      Review
                    </button>
                  )}{" "}
                  {(r.status === "OPEN" || r.status === "REVIEWING") && (
                    <>
                      <button type="button" onClick={() => resolveWithAction(r)}>
                        Resolve with action
                      </button>{" "}
                      <button type="button" onClick={() => reject(r.id)}>
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
