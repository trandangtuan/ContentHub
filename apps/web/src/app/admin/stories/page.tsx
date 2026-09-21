"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { api, type AdminStory } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";

const STATUSES = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "UNPUBLISHED", "REJECTED", "ARCHIVED"];

export default function AdminStoriesPage() {
  const { session } = useSession();
  const [stories, setStories] = useState<AdminStory[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const res = await api.admin.listStories({ q: q || undefined, status: status || undefined, limit: 50 });
    setStories(res.items);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(id: string, action: "publish" | "unpublish" | "delete" | "restore" | "noindex") {
    if (!session?.csrfToken) return;
    if ((action === "delete" || action === "unpublish") && !window.confirm(`Xác nhận ${action} truyện này?`)) return;
    const reason = action === "delete" ? window.prompt("Lý do (tuỳ chọn)") ?? undefined : undefined;
    await api.admin.storyAction(session.csrfToken, id, action, reason);
    load();
  }

  return (
    <section>
      <h1>Stories (tất cả creator, mọi trạng thái)</h1>
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input placeholder="Tìm theo tiêu đề" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="btn">
          Lọc
        </button>
      </form>

      {stories === null ? (
        <p className="text-muted">Đang tải...</p>
      ) : stories.length === 0 ? (
        <p className="empty-state">Không có truyện nào khớp bộ lọc.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tiêu đề</th>
              <th>Creator</th>
              <th>Trạng thái</th>
              <th>Noindex</th>
              <th>Xoá?</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stories.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td>{s.creator.displayName}</td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td>{s.seoMetadata?.noindex ? <span className="badge badge-warning">noindex</span> : "—"}</td>
                <td>{s.deletedAt ? <span className="badge badge-danger">đã xoá</span> : "—"}</td>
                <td>
                  {s.deletedAt ? (
                    <button type="button" className="btn btn-sm" onClick={() => act(s.id, "restore")}>
                      Restore
                    </button>
                  ) : (
                    <>
                      {s.status === "PUBLISHED" ? (
                        <button type="button" className="btn btn-sm" onClick={() => act(s.id, "unpublish")}>
                          Unpublish
                        </button>
                      ) : (
                        <button type="button" className="btn btn-sm" onClick={() => act(s.id, "publish")}>
                          Publish
                        </button>
                      )}{" "}
                      <button type="button" className="btn btn-sm" onClick={() => act(s.id, "noindex")}>
                        Noindex
                      </button>{" "}
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => act(s.id, "delete")}>
                        Delete
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
