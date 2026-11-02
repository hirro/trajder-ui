import { describe, expect, it } from "vitest";
import { markerIndex } from "./sparklineCoords";

const pts = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"].map((d) => ({ timestamp: `${d}T00:00:00Z` }));

describe("markerIndex", () => {
  it("returns the exact bar when the entry lands on one", () => {
    expect(markerIndex(pts, "2026-09-03T00:00:00Z")).toBe(2);
  });
  it("snaps an between-bars entry to the next bar", () => {
    expect(markerIndex(pts, "2026-09-02T09:30:00Z")).toBe(2);
  });
  it("clamps an entry before the window to the first bar", () => {
    expect(markerIndex(pts, "2026-08-01T00:00:00Z")).toBe(0);
  });
  it("clamps an entry after the last bar to the last bar", () => {
    expect(markerIndex(pts, "2026-10-01T00:00:00Z")).toBe(3);
  });
  it("returns null for empty series or bad timestamps", () => {
    expect(markerIndex([], "2026-09-02T00:00:00Z")).toBeNull();
    expect(markerIndex(pts, "not-a-date")).toBeNull();
  });
});
