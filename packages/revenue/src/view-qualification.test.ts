import { describe, expect, it } from "vitest";
import { qualifyView, aggregateViewStages } from "./view-qualification";

describe("qualifyView", () => {
  it("stays RAW for a suspected bot regardless of duration", () => {
    expect(qualifyView({ event: { durationSec: 60, scrollDepth: 1, isSuspectedBot: true }, contentIsMonetizable: true })).toBe(
      "RAW",
    );
  });

  it("stays RAW when duration is below the valid threshold", () => {
    expect(qualifyView({ event: { durationSec: 1, scrollDepth: 1, isSuspectedBot: false }, contentIsMonetizable: true })).toBe(
      "RAW",
    );
  });

  it("becomes VALID but not QUALIFIED with moderate engagement", () => {
    expect(
      qualifyView({ event: { durationSec: 10, scrollDepth: 0.1, isSuspectedBot: false }, contentIsMonetizable: true }),
    ).toBe("VALID");
  });

  it("becomes QUALIFIED but not MONETIZED when content isn't monetizable", () => {
    expect(
      qualifyView({ event: { durationSec: 30, scrollDepth: 0.5, isSuspectedBot: false }, contentIsMonetizable: false }),
    ).toBe("QUALIFIED");
  });

  it("becomes MONETIZED when qualified and content is monetizable", () => {
    expect(
      qualifyView({ event: { durationSec: 30, scrollDepth: 0.5, isSuspectedBot: false }, contentIsMonetizable: true }),
    ).toBe("MONETIZED");
  });
});

describe("aggregateViewStages", () => {
  it("rolls up per-stage counts correctly", () => {
    const result = aggregateViewStages(["RAW", "VALID", "QUALIFIED", "MONETIZED", "MONETIZED"]);
    expect(result).toEqual({ rawViews: 5, validViews: 4, qualifiedViews: 3, monetizedViews: 2 });
  });

  it("returns zeros for an empty batch", () => {
    expect(aggregateViewStages([])).toEqual({ rawViews: 0, validViews: 0, qualifiedViews: 0, monetizedViews: 0 });
  });
});
