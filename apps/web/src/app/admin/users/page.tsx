"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { api, type AdminUser } from "@/lib/api-client";
import { StatusBadge } from "@/components/StatusBadge";

export default function AdminUsersPage() {
  const { session } = useSession();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  async function load() {
    const res = await api.admin.listUsers({ q: q || undefined, status: status || undefined, limit: 50 });
    setUsers(res.items);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function suspend(id: string) {
    if (!session?.csrfToken) return;
    const reason = window.prompt("Lý do suspend tài khoản này?");
    if (!reason) return;
    await api.admin.suspendUser(session.csrfToken, id, reason);
    load();
  }

  async function reactivate(id: string) {
    if (!session?.csrfToken) return;
    await api.admin.reactivateUser(session.csrfToken, id);
    load();
  }

  return (
    <section>
      <h1>Users</h1>
      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input placeholder="Tìm theo email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="BANNED">BANNED</option>
        </select>
        <button type="submit" className="btn">
          Lọc
        </button>
      </form>

      {users === null ? (
        <p className="text-muted">Đang tải...</p>
      ) : users.length === 0 ? (
        <p className="empty-state">Không có user nào khớp bộ lọc.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Tên</th>
              <th>Role</th>
              <th>Trạng thái</th>
              <th>Creator?</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.displayName}</td>
                <td>
                  <span className="badge badge-primary">{u.role}</span>
                </td>
                <td>
                  <StatusBadge status={u.status} />
                </td>
                <td>{u.creatorProfile?.slug ?? "—"}</td>
                <td>
                  {u.status === "SUSPENDED" ? (
                    <button type="button" className="btn btn-sm" onClick={() => reactivate(u.id)}>
                      Reactivate
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => suspend(u.id)}>
                      Suspend
                    </button>
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
