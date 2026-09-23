import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /llms.txt", () => {
  it("returns plain text describing the site and public URL patterns", async () => {
    const response = await GET();
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    const text = await response.text();
    expect(text).toContain("ContentHub");
    expect(text).toContain("/truyen/{slug}");
  });
});
