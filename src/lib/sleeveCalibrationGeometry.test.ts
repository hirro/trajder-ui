import { describe, expect, it } from "vitest";
import { PANEL, barGeom, niceTicks, yAt, yDomain, zeroY } from "./sleeveCalibrationGeometry";

describe("sleeveCalibrationGeometry", () => {
  describe("yDomain", () => {
    it("always includes 0 for positive-only data", () => {
      const d = yDomain([100, 200, 50]);
      expect(d.lo).toBeLessThanOrEqual(0);
      expect(d.hi).toBeGreaterThanOrEqual(200);
    });

    it("always includes 0 for negative-only data", () => {
      const d = yDomain([-100, -200, -50]);
      expect(d.lo).toBeLessThanOrEqual(-200);
      expect(d.hi).toBeGreaterThanOrEqual(0);
    });

    it("always includes 0 for mixed data", () => {
      const d = yDomain([-50, 30, -10, 80]);
      expect(d.lo).toBeLessThanOrEqual(-50);
      expect(d.hi).toBeGreaterThanOrEqual(80);
      expect(d.lo).toBeLessThanOrEqual(0);
      expect(d.hi).toBeGreaterThanOrEqual(0);
    });

    it("pads the domain by 10% beyond the extremes", () => {
      const d = yDomain([100]);
      // 10% of the span beyond 0..100 (or symmetric range) — hi must exceed 100.
      expect(d.hi).toBeGreaterThan(100);
    });

    it("falls back to {lo: -100, hi: 100} when there are no values", () => {
      expect(yDomain([])).toEqual({ lo: -100, hi: 100 });
    });

    it("falls back to {lo: -100, hi: 100} when all values are null", () => {
      expect(yDomain([null, null, null])).toEqual({ lo: -100, hi: 100 });
    });

    it("ignores nulls mixed in with real values", () => {
      const d = yDomain([null, 100, null, -50]);
      expect(d.lo).toBeLessThanOrEqual(-50);
      expect(d.hi).toBeGreaterThanOrEqual(100);
    });
  });

  describe("zeroY / yAt", () => {
    it("zeroY sits strictly inside the panel's plot area", () => {
      const d = yDomain([-50, 80]);
      const zy = zeroY(d);
      expect(zy).toBeGreaterThanOrEqual(PANEL.PAD_T);
      expect(zy).toBeLessThanOrEqual(PANEL.H - PANEL.PAD_B);
    });

    it("yAt maps the domain lo to the bottom and hi to the top", () => {
      const d = { lo: -100, hi: 100 };
      expect(yAt(d.lo, d)).toBe(PANEL.H - PANEL.PAD_B);
      expect(yAt(d.hi, d)).toBe(PANEL.PAD_T);
    });
  });

  describe("barGeom — geometric sign encoding (the load-bearing invariant)", () => {
    const d = yDomain([-100, 100]);

    it("a positive value grows UP from the zero baseline: y + h === zeroY", () => {
      const g = barGeom(0, 3, 60, d);
      expect(g.y + g.h).toBeCloseTo(zeroY(d), 6);
      expect(g.y).toBeLessThanOrEqual(zeroY(d));
    });

    it("a negative value grows DOWN from the zero baseline: y === zeroY", () => {
      const g = barGeom(0, 3, -60, d);
      expect(g.y).toBeCloseTo(zeroY(d), 6);
      expect(g.y + g.h).toBeGreaterThanOrEqual(zeroY(d));
    });

    it("height is never negative", () => {
      expect(barGeom(0, 3, 60, d).h).toBeGreaterThanOrEqual(0);
      expect(barGeom(0, 3, -60, d).h).toBeGreaterThanOrEqual(0);
    });

    it("a near-zero value still has a visible (>=1px) bar", () => {
      expect(barGeom(0, 3, 0.0001, d).h).toBeGreaterThanOrEqual(1);
      expect(barGeom(0, 3, -0.0001, d).h).toBeGreaterThanOrEqual(1);
      expect(barGeom(0, 3, 0, d).h).toBeGreaterThanOrEqual(1);
    });
  });

  describe("barGeom — column layout", () => {
    const d = yDomain([-100, 100]);
    const n = 5;

    it("bars stay within the plot width (PAD_L .. W - PAD_R)", () => {
      for (let i = 0; i < n; i++) {
        const g = barGeom(i, n, 10, d);
        expect(g.x).toBeGreaterThanOrEqual(PANEL.PAD_L);
        expect(g.x + g.w).toBeLessThanOrEqual(PANEL.W - PANEL.PAD_R);
      }
    });

    it("leaves a 2px gap between adjacent bars", () => {
      const g0 = barGeom(0, n, 10, d);
      const g1 = barGeom(1, n, 10, d);
      expect(g1.x - (g0.x + g0.w)).toBeCloseTo(2, 6);
    });

    it("bars do not overlap across the whole row", () => {
      let prevRight = -Infinity;
      for (let i = 0; i < n; i++) {
        const g = barGeom(i, n, 10, d);
        expect(g.x).toBeGreaterThanOrEqual(prevRight);
        prevRight = g.x + g.w;
      }
    });
  });

  describe("niceTicks", () => {
    it("returns 3-5 ascending ticks including 0", () => {
      const d = yDomain([-50, 80]);
      const ticks = niceTicks(d);
      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(5);
      expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
      expect(ticks).toContain(0);
    });

    it("includes 0 even for the empty-fallback domain", () => {
      const ticks = niceTicks(yDomain([]));
      expect(ticks).toContain(0);
    });

    // The 3-5 tick contract must hold for EVERY domain the chart can produce, not just the
    // symmetric ones. `ceil(lo/step)` interacts with an asymmetric domain to drift the count,
    // so a single hand-picked domain proves nothing — sweep a representative set.
    const sweepDomains: [string, (number | null)[]][] = [
      ["mixed, negative-heavy", [-50, 80]],
      ["barely negative, large positive", [-1, 90]],
      ["small mixed", [15, -2]],
      ["AllPositive story fixture", [12.3, 24.6, 38.9, 55.2, 70.0]],
      ["all negative", [-12.3, -24.6, -38.9, -55.2, -70.0]],
      ["all positive, tiny", [0.4, 1.1, 2.7]],
      ["all negative, tiny", [-0.4, -1.1, -2.7]],
      ["huge positive", [1500, 4200]],
      ["huge negative", [-4200, -1500]],
      ["huge mixed", [-4200, 3800]],
      ["single positive", [7]],
      ["single negative", [-7]],
      ["one big one small", [-3, 250]],
      ["one small one big negative", [3, -250]],
      ["near-symmetric", [-99, 101]],
      ["empty fallback", []],
      ["all null", [null, null]],
      ["nulls plus data", [null, 33, null, -66]],
      ["exact decade", [-100, 100]],
      ["just over a decade", [-101, 99]],
    ];

    it.each(sweepDomains)("honours the 3-5 tick contract for %s", (_label, values) => {
      const d = yDomain(values);
      const ticks = niceTicks(d);

      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(5);
      expect(ticks).toContain(0);
      expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
      for (const t of ticks) {
        expect(t).toBeGreaterThanOrEqual(d.lo);
        expect(t).toBeLessThanOrEqual(d.hi);
      }
    });

    it("honours the 3-5 tick contract across a brute-force sweep of yDomain([a, b])", () => {
      const bad: string[] = [];
      for (let a = -200; a <= 200; a += 5) {
        for (let b = -200; b <= 200; b += 5) {
          const d = yDomain([a, b]);
          const ticks = niceTicks(d);
          if (ticks.length < 3 || ticks.length > 5 || !ticks.includes(0)) {
            bad.push(`yDomain([${a}, ${b}]) -> [${ticks.join(", ")}]`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  });
});
