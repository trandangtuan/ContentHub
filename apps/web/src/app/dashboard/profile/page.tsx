"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type CreatorProfileRecord } from "@/lib/api-client";
import { ImageUploadField } from "@/components/ImageUploadField";

export default function ProfilePage() {
  const { session } = useSession();
  const [profile, setProfile] = useState<CreatorProfileRecord | null>(null);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.creatorProfileId) return;
    api.getMyCreatorProfile().then((p) => {
      setProfile(p);
      setBio(p.bio ?? "");
      setAvatarUrl(p.avatarUrl ?? null);
    });
  }, [session?.creatorProfileId]);

  if (session && !session.creatorProfileId) {
    return (
      <section>
        <h1>Hồ sơ</h1>
        <p className="text-muted">Bạn cần tạo hồ sơ Creator trước (từ trang Tổng quan) để chỉnh sửa hồ sơ.</p>
      </section>
    );
  }

  if (!profile) return <p className="text-muted">Đang tải...</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.csrfToken) return;
    setError(null);
    try {
      const updated = await api.updateMyCreatorProfile(session.csrfToken, { bio, avatarUrl: avatarUrl ?? undefined });
      setProfile(updated);
      setStatus("Đã lưu.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lưu thất bại");
    }
  }

  return (
    <section>
      <h1>Hồ sơ Creator</h1>
      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={save} className="stack">
          <ImageUploadField label="Ảnh đại diện" purpose="avatar" value={avatarUrl} onChange={setAvatarUrl} contextSlug={profile.slug} />
          <label htmlFor="bio">Tiểu sử</label>
          <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={5} maxLength={2000} />
          {error ? <p role="alert">{error}</p> : null}
          {status ? <p className="text-sm text-muted">{status}</p> : null}
          <button type="submit" className="btn btn-primary">
            Lưu
          </button>
        </form>
      </div>
    </section>
  );
}
