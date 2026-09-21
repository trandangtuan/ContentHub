"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { api } from "@/lib/api-client";

export default function DashboardHome() {
  const { session } = useSession();
  const [hasCreatorProfile, setHasCreatorProfile] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!session?.authenticated) return;
    setHasCreatorProfile(Boolean(session.creatorProfileId));
  }, [session]);

  async function becomeCreator(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setCreating(true);
    try {
      await api.createCreatorProfile(session.csrfToken, { displayName });
      window.location.reload();
    } finally {
      setCreating(false);
    }
  }

  if (hasCreatorProfile === false) {
    return (
      <section>
        <h1>Trở thành Creator</h1>
        <form onSubmit={becomeCreator}>
          <label>
            Tên hiển thị
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <button type="submit" disabled={creating}>
            {creating ? "Đang tạo..." : "Tạo hồ sơ Creator"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section>
      <h1>Creator Studio</h1>
      <ul>
        <li>
          <Link href="/dashboard/stories">Quản lý truyện</Link>
        </li>
        <li>
          <Link href="/dashboard/analytics">Xem analytics</Link>
        </li>
        <li>
          <Link href="/dashboard/revenue">Xem doanh thu</Link>
        </li>
        <li>
          <Link href="/dashboard/wallet">Xem ví</Link>
        </li>
      </ul>
    </section>
  );
}
