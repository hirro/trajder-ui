/**
 * Shared SVG-coordinate math for sparkline components. Extracted from
 * IndicatorSparkline.svelte so SignalSparkline.svelte (signal trajectory)
 * can reuse decimation, scaling, and crosshair-from-clientX without
 * duplicating the logic.
 */

/** Upper bound on plotted points; `decimate` thins anything longer down to this. */
export const MAX_DRAW = 300;

export interface SparkPoint {
  timestamp: string;
  close: number;
}

export function decimate<T extends { close: number }>(pts: T[]): T[] {
  if (pts.length <= MAX_DRAW) return pts;
  const out: T[] = [];
  const step = (pts.length - 1) / (MAX_DRAW - 1);
  for (let i = 0; i < MAX_DRAW; i++) {
    const idx = Math.min(Math.round(i * step), pts.length - 1);
    out.push(pts[idx]);
  }
  return out;
}

export interface Scale {
  min: number;
  max: number;
  rng: number;
  pad: number;
  stepX: number;
  toY: (c: number) => number;
}

export function buildScale(values: number[], width: number, height: number, pad = 3): Scale | null {
  if (values.length < 2 || width <= 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rng = max - min || 1;
  const stepX = width / (values.length - 1);
  const toY = (c: number) => pad + (1 - (c - min) / rng) * (height - 2 * pad);
  return { min, max, rng, pad, stepX, toY };
}

export function buildLinePath(values: number[], stepX: number, toY: (v: number) => number): string {
  if (values.length < 2) return "";
  let d = "";
  for (let i = 0; i < values.length; i++) {
    d += i === 0 ? `M ${i * stepX} ${toY(values[i])}` : ` L ${i * stepX} ${toY(values[i])}`;
  }
  return d;
}

export function buildAreaPath(linePath: string, width: number, height: number): string {
  if (!linePath) return "";
  return `${linePath} L ${width} ${height} L 0 ${height} Z`;
}

export function normalizedXFromPointer(svg: SVGSVGElement, clientX: number): number | null {
  const rect = svg.getBoundingClientRect();
  if (rect.width <= 0) return null;
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

/**
 * Index of the bar a marker at `iso` belongs to: the first bar at or after it (a position filled
 * between bars is first visible on the next one). Clamped to the series, so an entry before the
 * window sits on the first bar and one after the last bar on the last. Null when there is nothing
 * to place it on or the timestamp is unparseable.
 */
export function markerIndex(points: { timestamp: string }[], iso: string): number | null {
  if (points.length === 0) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  for (let i = 0; i < points.length; i++) {
    if (new Date(points[i].timestamp).getTime() >= target) return i;
  }
  return points.length - 1;
}
