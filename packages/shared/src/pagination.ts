/**
 * Opaque cursor pagination, used by sitemap providers (chunking millions of
 * URLs without loading them all into memory) and list API endpoints.
 */
export interface Cursor {
  value: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed?.value === "string" && typeof parsed?.id === "string") {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Given a page fetched with `limit + 1` rows, splits it into the page and the next cursor. */
export function paginate<T>(rows: T[], limit: number, cursorOf: (row: T) => Cursor): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}
