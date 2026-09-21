import { describe, expect, it } from "vitest";
import { encodeCursor, decodeCursor, paginate } from "./pagination";

describe("cursor encode/decode", () => {
  it("round-trips", () => {
    const cursor = { value: "2026-01-01T00:00:00.000Z", id: "abc-123" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("returns null for garbage input", () => {
    expect(decodeCursor("not-valid-base64url-json")).toBeNull();
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, createdAt: `2026-01-0${i + 1}` }));

  it("returns all rows and no cursor when under the limit", () => {
    const page = paginate(rows, 10, (r) => ({ value: r.createdAt, id: r.id }));
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
  });

  it("truncates to the limit and returns a cursor when there are more rows", () => {
    const page = paginate(rows, 3, (r) => ({ value: r.createdAt, id: r.id }));
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).not.toBeNull();
    expect(decodeCursor(page.nextCursor!)).toEqual({ value: "2026-01-03", id: "id-2" });
  });
});
