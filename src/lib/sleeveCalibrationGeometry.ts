/**
 * Pure geometry for SleeveCalibrationChart (issue #619).
 * Conviction-bucket bars anchored at a zero baseline: growing UP for a positive
 * mean excess-edge outcome, DOWN for negative. Sign is encoded geometrically —
 * not by color alone — because the green/red pair fails a deuteranopia check
 * (ΔE 9.2, validator run 2026-07-12) and is legal only with this secondary
 * encoding. SVG-coordinate math only — no DOM, fully unit-testable.
 */

export interface YDomain {
  lo: number;
  hi: number;
}

/** One conviction bucket, e.g. [0.5, 0.6) — mirrors the backend's CalibrationBucket. */
export interface Bucket {
  lo: number;
  hi: number;
  n: number;
  mean_excess_bps: number | null;
}

export const PANEL = { W: 420, H: 180, PAD_L: 44, PAD_R: 10, PAD_T: 12, PAD_B: 26 } as const;

const GAP = 2;
const MIN_BAR_H = 1;
const FALLBACK: YDomain = { lo: -100, hi: 100 };

/**
 * Domain for the bar values. Always includes 0 (the zero baseline is the whole
 * point of the chart), padded by 10% beyond whichever extreme is farthest from
 * zero. Falls back to a fixed ±100 range when there's no data yet, so the empty
 * chart still renders an axis instead of collapsing to a point.
 */
export function yDomain(values: (number | null)[]): YDomain {
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (finite.length === 0) return { ...FALLBACK };

  let lo = Math.min(0, ...finite);
  let hi = Math.max(0, ...finite);
  let span = hi - lo;
  if (span < 1e-9) {
    // All-zero (or effectively zero) data — fall back to a visible range.
    lo = FALLBACK.lo;
    hi = FALLBACK.hi;
    span = hi - lo;
  }
  const pad = span * 0.1;
  return { lo: lo - pad, hi: hi + pad };
}

/** SVG y for a value: domain lo maps to the panel bottom, hi to the top. */
export function yAt(v: number, d: YDomain): number {
  const y0 = PANEL.H - PANEL.PAD_B; // bottom (= d.lo)
  const y1 = PANEL.PAD_T; // top (= d.hi)
  return y0 - ((v - d.lo) / (d.hi - d.lo)) * (y0 - y1);
}

/** SVG y for the zero baseline — every bar grows toward or away from this line. */
export function zeroY(d: YDomain): number {
  return yAt(0, d);
}

/**
 * Geometry for bar column `i` of `n`. Bars leave a 2px gap between neighbors and
 * never exceed the plot width (PANEL.W - PAD_L - PAD_R).
 *
 * Sign encoding (load-bearing — do not invert): a non-negative value spans
 * [yAt(v), zeroY] and grows UP from the baseline; a negative value spans
 * [zeroY, yAt(v)] and grows DOWN. Height is clamped to a 1px minimum so a
 * near-zero (or exactly zero) value is still visible as a sliver, never a
 * zero-height bar that reads as "no data".
 */
export function barGeom(i: number, n: number, value: number, d: YDomain): { x: number; y: number; w: number; h: number } {
  const plotW = PANEL.W - PANEL.PAD_L - PANEL.PAD_R;
  const w = n > 0 ? (plotW - (n - 1) * GAP) / n : 0;
  const x = PANEL.PAD_L + i * (w + GAP);
  const zy = zeroY(d);
  const vy = yAt(value, d);

  let y: number;
  let h: number;
  if (value >= 0) {
    h = Math.max(zy - vy, 0);
    if (h < MIN_BAR_H) h = MIN_BAR_H;
    y = zy - h;
  } else {
    h = Math.max(vy - zy, 0);
    if (h < MIN_BAR_H) h = MIN_BAR_H;
    y = zy;
  }
  return { x, y, w, h };
}

const MIN_TICKS = 3;
const MAX_TICKS = 5;

/**
 * Candidate step multipliers, ascending. 2.5 is not decorative: a plain 1-2-5 ladder
 * steps 20 -> 50, which for a domain like yDomain([-85, 15]) jumps straight from 6 ticks
 * to 2, skipping the 3-5 band entirely. Adding 2.5 closes every such gap (verified by the
 * brute-force sweep in the test file).
 */
const STEP_MULTIPLIERS = [1, 2, 2.5, 5];

/** Ticks on a 1-2-5 grid of the given step, clipped to the domain. 0 is always on the grid. */
function ticksForStep(d: YDomain, step: number): number[] {
  const first = Math.ceil(d.lo / step) * step;
  const out: number[] = [];
  for (let v = first; v <= d.hi + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/**
 * Round-numbered axis ticks (1-2-5 progression) that always include 0 and always
 * number 3-5.
 *
 * Deriving the step from span/count and rounding the multiplier in a fixed
 * direction does NOT hold the count: `ceil(lo/step)` shifts the first tick by a
 * domain-dependent amount, so an asymmetric domain (which is the common case
 * here — the domain is padded around 0, not around the data's midpoint) drifts
 * the count either side of the band regardless of rounding direction. Instead,
 * enumerate the candidate 1-2-5 steps in ascending order and take the first that
 * actually yields a count inside the band for THIS domain.
 *
 * 0 is guaranteed to be a tick: yDomain always brackets 0 (lo <= 0 <= hi), and
 * every candidate grid is a multiple of its step, so 0 lies on it.
 */
export function niceTicks(d: YDomain): number[] {
  const span = d.hi - d.lo;
  const startExp = Math.floor(Math.log10(span)) - 2;

  let fallback = ticksForStep(d, Math.pow(10, startExp));
  // Ascending steps => descending tick counts. Take the first count that lands in the band.
  for (let exp = startExp; exp <= startExp + 5; exp++) {
    const mag = Math.pow(10, exp);
    for (const mult of STEP_MULTIPLIERS) {
      const ticks = ticksForStep(d, mult * mag);
      if (ticks.length >= MIN_TICKS && ticks.length <= MAX_TICKS) return ticks;
      // Remember the last grid still at/above the minimum — if no step lands in the
      // band we prefer a slightly crowded axis over a bare one.
      if (ticks.length >= MIN_TICKS) fallback = ticks;
    }
  }
  return fallback;
}
