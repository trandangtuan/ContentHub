"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type CategoryRecord } from "@/lib/api-client";

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Categories are a shared, global taxonomy (docs/DATABASE.md — no
 * per-creator ownership): any creator can add, rename, or delete one, and
 * every content type picks from the same list (a story and a news article
 * can share "Công nghệ"). Renders no <form> anywhere — this is always used
 * inside another form (story/article metadata), and HTML forbids nesting
 * <form> elements.
 */
export function CategoryPicker({ selectedIds, onChange }: Props) {
  const { session } = useSession();
  const [categories, setCategories] = useState<CategoryRecord[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCategories().then((res) => setCategories(res.categories));
  }, []);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]);
  }

  async function createCategory() {
    if (!session?.csrfToken || !newName.trim()) return;
    setError(null);
    setCreating(true);
    try {
      const category = await api.createCategory(session.csrfToken, newName.trim());
      setCategories((prev) => (prev?.some((c) => c.id === category.id) ? prev : [...(prev ?? []), category].sort((a, b) => a.name.localeCompare(b.name))));
      onChange([...selectedIds, category.id]);
      setNewName("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo thể loại");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(category: CategoryRecord) {
    setEditingId(category.id);
    setEditName(category.name);
    setError(null);
  }

  async function saveEdit() {
    if (!session?.csrfToken || !editingId || !editName.trim()) return;
    setError(null);
    setBusyId(editingId);
    try {
      const updated = await api.updateCategory(session.csrfToken, editingId, editName.trim());
      setCategories((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)) ?? null);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể sửa thể loại");
    } finally {
      setBusyId(null);
    }
  }

  async function removeCategory(category: CategoryRecord) {
    if (!session?.csrfToken) return;
    if (!window.confirm(`Xóa thể loại "${category.name}"? Nội dung đã gắn thể loại này sẽ không bị ảnh hưởng.`)) return;
    setError(null);
    setBusyId(category.id);
    try {
      await api.deleteCategory(session.csrfToken, category.id);
      setCategories((prev) => prev?.filter((c) => c.id !== category.id) ?? null);
      onChange(selectedIds.filter((id) => id !== category.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xóa thể loại");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {categories === null ? (
        <p className="text-sm text-muted">Đang tải thể loại...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted">Chưa có thể loại nào — tạo thể loại đầu tiên bên dưới.</p>
      ) : (
        <ul className="chip-list">
          {categories.map((category) =>
            editingId === category.id ? (
              <li key={category.id} className="row" style={{ gap: 4 }}>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveEdit();
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  maxLength={50}
                  style={{ maxWidth: 160 }}
                />
                <button type="button" className="btn btn-sm" disabled={busyId === category.id || !editName.trim()} onClick={saveEdit}>
                  Lưu
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setEditingId(null)}>
                  Hủy
                </button>
              </li>
            ) : (
              <li key={category.id} className="row" style={{ gap: 2, alignItems: "center" }}>
                <button
                  type="button"
                  className={`chip chip-toggle${selectedIds.includes(category.id) ? " active" : ""}`}
                  aria-pressed={selectedIds.includes(category.id)}
                  onClick={() => toggle(category.id)}
                >
                  {category.name}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" title="Sửa" aria-label={`Sửa thể loại ${category.name}`} onClick={() => startEdit(category)}>
                  ✎
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Xóa"
                  aria-label={`Xóa thể loại ${category.name}`}
                  disabled={busyId === category.id}
                  onClick={() => removeCategory(category)}
                >
                  ×
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="row" style={{ marginTop: 12 }}>
        <input
          placeholder="Tên thể loại mới"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              createCategory();
            }
          }}
          maxLength={50}
          style={{ maxWidth: 240 }}
        />
        <button type="button" className="btn btn-sm" disabled={creating || !newName.trim()} onClick={createCategory}>
          {creating ? "Đang tạo..." : "+ Tạo thể loại"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
