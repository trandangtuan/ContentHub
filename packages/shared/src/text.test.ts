import { describe, expect, it } from "vitest";
import { truncateText, countWords, estimateReadingTimeMinutes, htmlToPlainText } from "./text";

describe("truncateText", () => {
  it("returns input unchanged when under the limit", () => {
    expect(truncateText("hello world", 50)).toBe("hello world");
  });

  it("truncates at a word boundary and appends an ellipsis", () => {
    const result = truncateText("The quick brown fox jumps over the lazy dog", 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith("…")).toBe(true);
    expect(result).toBe("The quick brown…"); // cut at the space before "fox", not mid-word
  });

  it("never splits a multi-byte Unicode character", () => {
    const input = "Tu Tiên 1000 Năm - hành trình của một thiếu niên 😀🐉";
    const result = truncateText(input, 15);
    // Array.from splits by code point; re-joining must reproduce valid characters (no lone surrogates).
    expect([...result].every((ch) => ch.length <= 2)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(15);
  });
});

describe("countWords / estimateReadingTimeMinutes", () => {
  it("counts whitespace-delimited words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("estimates at least 1 minute for any non-empty text", () => {
    expect(estimateReadingTimeMinutes(1)).toBe(1);
    expect(estimateReadingTimeMinutes(0)).toBe(0);
    expect(estimateReadingTimeMinutes(400)).toBe(2);
  });
});

describe("htmlToPlainText", () => {
  it("strips tags and decodes common entities", () => {
    expect(htmlToPlainText("<p>Hello <b>world</b> &amp; friends</p>")).toBe("Hello world & friends");
  });

  it("removes script/style content entirely", () => {
    expect(htmlToPlainText("<p>Text</p><script>evil()</script>")).toBe("Text");
  });
});
