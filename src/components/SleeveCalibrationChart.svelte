<script lang="ts">
  import { PANEL, barGeom, niceTicks, yAt, yDomain, zeroY, type Bucket } from "../lib/sleeveCalibrationGeometry";

  interface Props {
    buckets: Bucket[];
  }

  let { buckets }: Props = $props();

  const values = $derived(buckets.map((b) => b.mean_excess_bps));
  const domain = $derived(yDomain(values));
  const ticks = $derived(niceTicks(domain));
  const zy = $derived(zeroY(domain));
  const hasData = $derived(buckets.some((b) => b.n > 0));

  const bucketLabel = (b: Bucket) => `${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`;
</script>

{#if !hasData}
  <div class="flex items-center justify-center h-[100px] text-gray-500 text-sm">No closed trades yet</div>
{:else}
  <svg viewBox="0 0 {PANEL.W} {PANEL.H}" class="w-full bg-gray-900/60 border border-gray-700 rounded" role="img" aria-label="Conviction calibration chart">
    <!-- Recessive grid ticks -->
    {#each ticks as tick (tick)}
      <line x1={PANEL.PAD_L} x2={PANEL.W - PANEL.PAD_R} y1={yAt(tick, domain)} y2={yAt(tick, domain)} stroke="#374151" stroke-width="0.5" />
      <text x={PANEL.PAD_L - 4} y={yAt(tick, domain) + 3} text-anchor="end" class="fill-gray-500" font-size="9">{tick}</text>
    {/each}

    <!-- Zero baseline — emphasized, this is the geometric sign reference -->
    <line x1={PANEL.PAD_L} x2={PANEL.W - PANEL.PAD_R} y1={zy} y2={zy} stroke="#9ca3af" stroke-width="1" />

    {#each buckets as b, i (b.lo)}
      {@const empty = b.n === 0 || b.mean_excess_bps === null}
      {@const g = barGeom(i, buckets.length, empty ? 0 : (b.mean_excess_bps ?? 0), domain)}
      {#if empty}
        <!-- Empty bucket: a faint dashed placeholder tick, never a zero-height bar pretending to be data. -->
        <line x1={g.x} x2={g.x + g.w} y1={zy} y2={zy} stroke="#4b5563" stroke-width="1" stroke-dasharray="3 2" />
        <text x={g.x + g.w / 2} y={zy - 4} text-anchor="middle" class="fill-gray-500" font-size="8">n=0</text>
      {:else}
        {@const positive = (b.mean_excess_bps ?? 0) >= 0}
        <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="4" fill="currentColor" class={positive ? "text-green-400" : "text-red-400"}>
          <title>{bucketLabel(b)}, n={b.n}, mean {(b.mean_excess_bps ?? 0).toFixed(1)} bps (raw)</title>
        </rect>
        <text x={g.x + g.w / 2} y={positive ? g.y - 4 : g.y + g.h + 10} text-anchor="middle" class="fill-gray-500" font-size="8">
          n={b.n}
        </text>
      {/if}
      <text x={g.x + g.w / 2} y={PANEL.H - 8} text-anchor="middle" class="fill-gray-500" font-size="8">
        {bucketLabel(b)}
      </text>
    {/each}
  </svg>
{/if}
