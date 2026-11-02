import { describe, expect, it } from "vitest";
import { sortSleeves, type SleeveSortRow } from "./sleeveSort";

/** Minimal fixture factory — only the fields sleeveSort.ts reads. */
function row(overrides: Partial<SleeveSortRow> = {}): SleeveSortRow {
  return {
    sleeve_id: "s",
    display_name: "Sleeve",
    ladder_status: "SHADOW",
    alpha_interval: "1d",
    n_closed: null,
    p_positive: null,
    fill_ratio: null,
    calibration_slope: null,
    open_positions: 0,
    ...overrides,
  };
}

describe("sortSleeves", () => {
  it("does not mutate the input array", () => {
    const input = [row({ display_name: "B" }), row({ display_name: "A" })];
    const copy = [...input];
    sortSleeves(input, "sleeve", "asc");
    expect(input).toEqual(copy);
  });

  describe("sleeve (display_name, case-insensitive)", () => {
    it("sorts ascending ignoring case", () => {
      const input = [row({ display_name: "bravo" }), row({ display_name: "Alpha" }), row({ display_name: "charlie" })];
      const out = sortSleeves(input, "sleeve", "asc").map((r) => r.display_name);
      expect(out).toEqual(["Alpha", "bravo", "charlie"]);
    });

    it("sorts descending ignoring case", () => {
      const input = [row({ display_name: "bravo" }), row({ display_name: "Alpha" }), row({ display_name: "charlie" })];
      const out = sortSleeves(input, "sleeve", "desc").map((r) => r.display_name);
      expect(out).toEqual(["charlie", "bravo", "Alpha"]);
    });
  });

  describe("ladder (rung rank)", () => {
    it("orders FULL > PROBATION > SHADOW > FROZEN ascending as FROZEN..FULL", () => {
      const input = [
        row({ display_name: "full", ladder_status: "FULL" }),
        row({ display_name: "frozen", ladder_status: "FROZEN" }),
        row({ display_name: "shadow", ladder_status: "SHADOW" }),
        row({ display_name: "probation", ladder_status: "PROBATION" }),
      ];
      const out = sortSleeves(input, "ladder", "asc").map((r) => r.display_name);
      expect(out).toEqual(["frozen", "shadow", "probation", "full"]);
    });

    it("ranks unknown ladder status below FROZEN(0) — i.e. first ascending", () => {
      const input = [
        row({ display_name: "frozen", ladder_status: "FROZEN" }),
        row({ display_name: "weird", ladder_status: "WEIRD" as never }),
      ];
      const out = sortSleeves(input, "ladder", "asc").map((r) => r.display_name);
      expect(out).toEqual(["weird", "frozen"]);
    });

    it("breaks rung ties by P(edge>0), then closed trades, in the same direction (missing last)", () => {
      const input = [
        row({ display_name: "shadow-low-p", p_positive: 0.2, n_closed: 50 }),
        row({ display_name: "shadow-high-p-few", p_positive: 0.9, n_closed: 3 }),
        row({ display_name: "shadow-high-p-many", p_positive: 0.9, n_closed: 20 }),
        row({ display_name: "shadow-no-p", p_positive: null, n_closed: 99 }),
        row({ display_name: "full", ladder_status: "FULL", p_positive: 0.1 }),
      ];
      expect(sortSleeves(input, "ladder", "desc").map((r) => r.display_name)).toEqual([
        "full",
        "shadow-high-p-many",
        "shadow-high-p-few",
        "shadow-low-p",
        "shadow-no-p",
      ]);
      expect(sortSleeves(input, "ladder", "asc").map((r) => r.display_name)).toEqual([
        "shadow-low-p",
        "shadow-high-p-few",
        "shadow-high-p-many",
        "shadow-no-p",
        "full",
      ]);
    });
  });

  describe("intervals (alpha_interval duration)", () => {
    it("orders 1m < 5m < 15m < 1h < 4h < 1d ascending", () => {
      const input = [
        row({ display_name: "d1", alpha_interval: "1d" }),
        row({ display_name: "m1", alpha_interval: "1m" }),
        row({ display_name: "h4", alpha_interval: "4h" }),
        row({ display_name: "h1", alpha_interval: "1h" }),
        row({ display_name: "m15", alpha_interval: "15m" }),
        row({ display_name: "m5", alpha_interval: "5m" }),
      ];
      const out = sortSleeves(input, "intervals", "asc").map((r) => r.display_name);
      expect(out).toEqual(["m1", "m5", "m15", "h1", "h4", "d1"]);
    });

    it("puts an unknown interval last regardless of direction", () => {
      const input = [row({ display_name: "weird", alpha_interval: "3q" }), row({ display_name: "m1", alpha_interval: "1m" })];
      expect(sortSleeves(input, "intervals", "asc").map((r) => r.display_name)).toEqual(["m1", "weird"]);
      expect(sortSleeves(input, "intervals", "desc").map((r) => r.display_name)).toEqual(["m1", "weird"]);
    });
  });

  describe("numeric scorecard columns — missing sorts last in BOTH directions", () => {
    it("closed (n_closed) ascending puts missing last", () => {
      const input = [row({ display_name: "hi", n_closed: 5 }), row({ display_name: "missing", n_closed: null }), row({ display_name: "lo", n_closed: 1 })];
      const out = sortSleeves(input, "closed", "asc").map((r) => r.display_name);
      expect(out).toEqual(["lo", "hi", "missing"]);
    });

    it("closed (n_closed) descending still puts missing last", () => {
      const input = [row({ display_name: "hi", n_closed: 5 }), row({ display_name: "missing", n_closed: null }), row({ display_name: "lo", n_closed: 1 })];
      const out = sortSleeves(input, "closed", "desc").map((r) => r.display_name);
      expect(out).toEqual(["hi", "lo", "missing"]);
    });

    it("weeks sorts by the 4-week total; N/A (no trade in any week, or no windows at all) is missing, like weeklyTotal()", () => {
      // n=0 is "N/A" even if a total somehow came along; weeks that netted to 0.0 are a real value.
      const input = [
        row({ display_name: "up", trade_windows: { w0: { n: 2, total_bps: 40 }, w3: { n: 1, total_bps: 5 } } }),
        row({ display_name: "none", trade_windows: { w0: { n: 0, total_bps: null }, w1: { n: 0, total_bps: 7 } } }),
        row({ display_name: "flat", trade_windows: { w1: { n: 1, total_bps: 0 } } }),
        row({ display_name: "absent" }),
        row({ display_name: "down", trade_windows: { w0: { n: 5, total_bps: 30 }, w2: { n: 3, total_bps: -42.5 } } }),
      ];
      const asc = sortSleeves(input, "weeks", "asc").map((r) => r.display_name);
      expect(asc).toEqual(["down", "flat", "up", "none", "absent"]);
      const desc = sortSleeves(input, "weeks", "desc").map((r) => r.display_name);
      expect(desc).toEqual(["up", "flat", "down", "none", "absent"]);
    });

    it("p_positive sorts by the raw probability and only nulls are missing (n_closed=0 still has a value)", () => {
      const input = [
        row({ display_name: "high", n_closed: 3, p_positive: 0.8 }),
        row({ display_name: "prior", n_closed: 0, p_positive: 0.42 }),
        row({ display_name: "missing", n_closed: null, p_positive: null }),
      ];
      const out = sortSleeves(input, "p_positive", "asc").map((r) => r.display_name);
      expect(out).toEqual(["prior", "high", "missing"]);
    });

    it("fill_ratio numeric ascending/descending with missing last", () => {
      const input = [row({ display_name: "a", fill_ratio: 0.9 }), row({ display_name: "b", fill_ratio: null }), row({ display_name: "c", fill_ratio: 0.1 })];
      expect(sortSleeves(input, "fill_ratio", "asc").map((r) => r.display_name)).toEqual(["c", "a", "b"]);
      expect(sortSleeves(input, "fill_ratio", "desc").map((r) => r.display_name)).toEqual(["a", "c", "b"]);
    });

    it("calib_slope sorts by the raw slope value and only nulls are missing", () => {
      const input = [
        row({ display_name: "under-powered-default", n_closed: 2, calibration_slope: 1.0 }),
        row({ display_name: "fitted", n_closed: 20, calibration_slope: 0.6 }),
        row({ display_name: "missing", n_closed: null, calibration_slope: null }),
      ];
      const out = sortSleeves(input, "calib_slope", "asc").map((r) => r.display_name);
      expect(out).toEqual(["fitted", "under-powered-default", "missing"]);
    });

    it("open (open_positions) numeric, never missing since it defaults to 0", () => {
      const input = [row({ display_name: "a", open_positions: 2 }), row({ display_name: "b", open_positions: 0 })];
      expect(sortSleeves(input, "open", "asc").map((r) => r.display_name)).toEqual(["b", "a"]);
    });

    it("book sorts by the kronor result with missing last", () => {
      const input = [row({ display_name: "a", result: 120 }), row({ display_name: "b" }), row({ display_name: "c", result: -40 })];
      expect(sortSleeves(input, "book", "asc").map((r) => r.display_name)).toEqual(["c", "a", "b"]);
      expect(sortSleeves(input, "book", "desc").map((r) => r.display_name)).toEqual(["a", "c", "b"]);
    });
  });
});
