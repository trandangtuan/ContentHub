"use client";

import { useRef, useState } from "react";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type UploadPurpose } from "@/lib/api-client";

interface Props {
  label: string;
  purpose: UploadPurpose;
  value: string | null;
  onChange: (url: string) => void;
  contextSlug?: string;
}

/** Local file upload (packages/storage's LocalStorageProvider) — picks a file, uploads it, and hands the resulting URL to the caller, which stores it wherever it already stores a URL string (coverImage, avatarUrl, ...). No schema change needed on either end. */
export function ImageUploadField({ label, purpose, value, onChange, contextSlug }: Props) {
  const { session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !session?.csrfToken) return;

    setError(null);
    setUploading(true);
    try {
      const result = await api.uploadFile(session.csrfToken, purpose, file, contextSlug);
      onChange(result.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải ảnh lên");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label>{label}</label>
      <div className="row" style={{ alignItems: "center", marginTop: 8 }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-uploaded URL, next/image's remote-pattern allowlist adds no real safety here
          <img src={value} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: "var(--radius-md)" }} />
        ) : null}
        <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? "Đang tải lên..." : value ? "Đổi ảnh" : "Tải ảnh lên"}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: "none" }} />
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
