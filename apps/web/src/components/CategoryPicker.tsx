"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type CategoryRecord } from "@/lib/api-client";

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CategoryPicker({ selectedIds, onChange }: Props) {
  const { session } = useSession();
  const [categories, setCategories] = useState<CategoryRecord[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listCategories().then((res) => setCategories(res.categories));
  }, []);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]);
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div>
      {categories === null ? (
        <p className="text-sm text-muted">Đang tải thể loại...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted">Chưa có thể loại nào — tạo thể loại đầu tiên bên dưới.</p>
      ) : (
        <ul className="chip-list">
          {categories.map((category) => (
            <li key={category.id}>
              <button
                type="button"
                className={`chip chip-toggle${selectedIds.includes(category.id) ? " active" : ""}`}
                aria-pressed={selectedIds.includes(category.id)}
                onClick={() => toggle(category.id)}
              >
                {category.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="row" style={{ marginTop: 12 }} onSubmit={createCategory}>
        <input placeholder="Tên thể loại mới" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={50} style={{ maxWidth: 240 }} />
        <button type="submit" className="btn btn-sm" disabled={creating || !newName.trim()}>
          {creating ? "Đang tạo..." : "+ Tạo thể loại"}
        </button>
      </form>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
    </div>
  );
}
