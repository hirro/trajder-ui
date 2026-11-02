<script lang="ts">
  import type { SparkPoint } from "../lib/sparklineCoords";
  import { decimate, buildLinePath, buildAreaPath, normalizedXFromPointer, markerIndex } from "../lib/sparklineCoords";

  export let points: SparkPoint[];
  /**
   * Optional benchmark series drawn alongside `points`. When supplied, both series
   * are rebased to 100 at their first visible point so the plot shows %-performance,
   * and the crosshair tooltip reports both deltas. When omitted, the sparkline
   * renders exactly as before (single green line + area fill, price tooltip).
   */
  export let indexPoints: SparkPoint[] | undefined = undefined;
  /** Short label for the index in the tooltip, e.g. "OMXS30". */
  export let indexLabel: string = "Index";
  /**
   * Optional event markers (e.g. a position entry): a dashed vertical line plus a dot on the price
   * line at the first bar at/after `timestamp`, with `label` shown beside it.
   */
  export let markers: { timestamp: string; label: string }[] = [];
  export let gradientId: string = "indicator-spark-fill";
  export let height: number = 64;
  /** Daily closes: the tooltip shows the bar's date (UTC, its end-of-day stamp) instead of a local time. */
  export let daily: boolean = false;

  $: HEIGHT = height;

  let containerWidth = 0;
  let svgElement: SVGSVGElement | null = null;

  /**
   * Align two series to a common length by truncating the longer one from the
   * left. Both series are expected to cover the same trading-day window; the
   * rare cases where they differ (off-by-one at edges) don't disturb the shape.
   */
  function alignPair(
    a: SparkPoint[],
    b: SparkPoint[],
  ): { a: SparkPoint[]; b: SparkPoint[] } {
    const n = Math.min(a.length, b.length);
    return { a: a.slice(a.length - n), b: b.slice(b.length - n) };
  }

  interface Scale {
    min: number;
    max: number;
    rng: number;
    pad: number;
    stepX: number;
    toY: (c: number) => number;
  }

  /** Rebase a close series to 100 at the first point. Returns 100s if first value is invalid. */
  function rebaseToHundred(pts: SparkPoint[]): number[] {
    if (pts.length === 0) return [];
    const base = pts[0].close;
    if (!base || base <= 0) return pts.map(() => 100);
    return pts.map((p) => (p.close / base) * 100);
  }

  interface CrosshairRead {
    x: number;
    stockY: number;
    stockValue: number;
    stockPct: number;
    timestamp: string;
    indexY?: number;
    indexValue?: number;
    indexPct?: number;
  }

  function formatTime(ts: string): string {
    const d = new Date(ts);
    if (daily) return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return d.toLocaleDateString("en", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function formatPct(v: number): string {
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(2)}%`;
  }

  let crosshairNormX: number | null = null;
  let rafId = 0;
  function updateCrosshairFromClientX(clientX: number) {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      if (!svgElement) return;
      const norm = normalizedXFromPointer(svgElement, clientX);
      if (norm !== null) crosshairNormX = norm;
    });
  }

  function onPointerMove(e: PointerEvent) {
    updateCrosshairFromClientX(e.clientX);
  }

  function onMouseMove(e: MouseEvent) {
    updateCrosshairFromClientX(e.clientX);
  }

  function clearCrosshair() {
    cancelAnimationFrame(rafId);
    crosshairNormX = null;
  }

  $: stockDraw = decimate(points);
  $: hasIndex = !!(indexPoints && indexPoints.length > 1);
  $: indexDraw = hasIndex ? decimate(indexPoints as SparkPoint[]) : [];
  $: aligned = hasIndex ? alignPair(stockDraw, indexDraw) : { a: stockDraw, b: [] as SparkPoint[] };
  $: drawPts = aligned.a;
  $: drawIdx = aligned.b;

  // Build scale: dual mode uses rebased %-values; single mode uses raw closes.
  $: stockValues = hasIndex ? rebaseToHundred(drawPts) : drawPts.map((p) => p.close);
  $: indexValues = hasIndex ? rebaseToHundred(drawIdx) : [];
  $: scale = (() => {
    const all = hasIndex ? [...stockValues, ...indexValues] : stockValues;
    if (all.length < 2 || containerWidth <= 0) return null;
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = 3;
    const rng = max - min || 1;
    const stepX = containerWidth / (stockValues.length - 1 || 1);
    const toY = (c: number) => pad + (1 - (c - min) / rng) * (HEIGHT - 2 * pad);
    return { min, max, rng, pad, stepX, toY } as Scale;
  })();

  $: stockPath = scale ? buildLinePath(stockValues, scale.stepX, scale.toY) : "";
  $: areaPath = scale ? buildAreaPath(stockPath, containerWidth, HEIGHT) : "";
  $: indexPath = scale && hasIndex ? buildLinePath(indexValues, scale.stepX, scale.toY) : "";

  $: markerDraws = scale
    ? markers.flatMap((m) => {
        const idx = markerIndex(drawPts, m.timestamp);
        return idx === null ? [] : [{ x: idx * scale.stepX, y: scale.toY(stockValues[idx]), label: m.label }];
      })
    : [];

  $: crosshairData = ((): CrosshairRead | null => {
    if (crosshairNormX === null || !scale || stockValues.length < 2) return null;
    const n = stockValues.length;
    const idx = Math.max(0, Math.min(n - 1, Math.round(crosshairNormX * (n - 1))));
    const x = idx * scale.stepX;
    const stockValue = drawPts[idx].close;
    const stockPct = hasIndex ? stockValues[idx] - 100 : (drawPts[idx].close / drawPts[0].close - 1) * 100;
    const read: CrosshairRead = {
      x,
      stockY: scale.toY(stockValues[idx]),
      stockValue,
      stockPct,
      timestamp: drawPts[idx].timestamp,
    };
    if (hasIndex && indexValues.length === n) {
      read.indexY = scale.toY(indexValues[idx]);
      read.indexValue = drawIdx[idx].close;
      read.indexPct = indexValues[idx] - 100;
    }
    return read;
  })();

  function signColor(v: number): string {
    if (v > 0) return "text-emerald-400";
    if (v < 0) return "text-rose-400";
    return "text-gray-300";
  }
</script>

<div
  class="relative block w-full min-h-[64px] min-w-0"
  bind:clientWidth={containerWidth}
>
  {#if points.length < 2}
    <div class="flex h-[64px] items-center justify-end text-xs text-gray-500 pr-1" aria-hidden="true">
      No data
    </div>
  {:else if containerWidth > 0}
    <svg
      bind:this={svgElement}
      width={containerWidth}
      height={HEIGHT}
      class="block text-emerald-400"
      viewBox="0 0 {containerWidth} {HEIGHT}"
      preserveAspectRatio="none"
      aria-hidden="true"
      onpointermove={onPointerMove}
      onpointerleave={clearCrosshair}
      onmousemove={onMouseMove}
      onmouseleave={clearCrosshair}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgb(52 211 153)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="rgb(52 211 153)" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      {#if areaPath}
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      {/if}
      {#if stockPath}
        <path
          d={stockPath}
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/if}
      {#if indexPath}
        <path
          d={indexPath}
          fill="none"
          stroke="rgb(125 211 252)"
          stroke-width="1.25"
          stroke-dasharray="4,3"
          stroke-linecap="round"
          stroke-linejoin="round"
          opacity="0.9"
        />
      {/if}
      {#each markerDraws as m, i (i)}
        <line
          x1={m.x} y1={0} x2={m.x} y2={HEIGHT}
          stroke="rgb(251 191 36)" stroke-width="1" stroke-dasharray="2,2" opacity="0.9"
          data-testid="sparkline-marker-line"
        />
        <circle cx={m.x} cy={m.y} r="3.5" fill="rgb(251 191 36)" stroke="rgb(17 24 39)" stroke-width="1.5" data-testid="sparkline-marker-dot" />
      {/each}
      {#if crosshairData}
        <line
          x1={crosshairData.x} y1={0}
          x2={crosshairData.x} y2={HEIGHT}
          stroke="rgb(226 232 240)" stroke-width="1" opacity="0.9"
        />
        <circle
          cx={crosshairData.x} cy={crosshairData.stockY}
          r="3.5" fill="rgb(52 211 153)" stroke="rgb(17 24 39)" stroke-width="1.5"
        />
        {#if crosshairData.indexY !== undefined}
          <circle
            cx={crosshairData.x} cy={crosshairData.indexY}
            r="3" fill="rgb(125 211 252)" stroke="rgb(17 24 39)" stroke-width="1.5"
          />
        {/if}
      {/if}
    </svg>
    {#each markerDraws as m, i (i)}
      <span
        class="absolute pointer-events-none top-0 text-[10px] leading-none text-amber-300 whitespace-nowrap"
        style="left: {m.x}px; transform: translateX({m.x > containerWidth * 0.6 ? 'calc(-100% - 4px)' : '4px'});"
        data-testid="sparkline-marker-label"
      >{m.label}</span>
    {/each}
    {#if crosshairData}
      <div
        class="absolute pointer-events-none z-10 rounded bg-gray-900 border border-gray-600 px-1.5 py-0.5 text-[10px] whitespace-nowrap shadow-lg"
        style="left: {crosshairData.x}px; top: 0px; transform: translateX({crosshairData.x > containerWidth * 0.75 ? '-100%' : '0'});"
      >
        {#if hasIndex && crosshairData.indexPct !== undefined}
          <span class="text-gray-400">Stock</span>
          <span class="{signColor(crosshairData.stockPct)} font-medium">{formatPct(crosshairData.stockPct)}</span>
          <span class="text-gray-500 mx-1">·</span>
          <span class="text-gray-400">{indexLabel}</span>
          <span class="{signColor(crosshairData.indexPct)} font-medium">{formatPct(crosshairData.indexPct)}</span>
          <span class="text-gray-500 mx-1">·</span>
          <span class="text-gray-300">{formatTime(crosshairData.timestamp)}</span>
        {:else}
          <span class="text-gray-200">{crosshairData.stockValue.toFixed(2)}</span>
          <span class="text-gray-500 mx-1">·</span>
          <span class="text-gray-300">{formatTime(crosshairData.timestamp)}</span>
        {/if}
      </div>
    {/if}
  {/if}
</div>
