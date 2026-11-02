<script lang="ts">
  export let values: number[] = [];
  export let width = 120;
  export let height = 32;
  export let color = "#34d399";
  export let zeroBaseline = false;

  const PAD = 3;

  function calcX(i: number, len: number, w: number): number {
    return len <= 1 ? 0 : (i * (w - 2 * PAD)) / (len - 1) + PAD;
  }

  function calcY(v: number, mn: number, rng: number, h: number): number {
    return PAD + (1 - (v - mn) / rng) * (h - 2 * PAD);
  }

  $: min = values.length ? Math.min(...values) : 0;
  $: max = values.length ? Math.max(...values) : 0;
  $: range = max - min || 1;
  $: line = values.length
    ? values.map((v, i) => `${i ? "L" : "M"} ${calcX(i, values.length, width).toFixed(1)} ${calcY(v, min, range, height).toFixed(1)}`).join(" ")
    : "";
  $: area = line
    ? `${line} L ${calcX(values.length - 1, values.length, width).toFixed(1)} ${height} L ${calcX(0, values.length, width).toFixed(1)} ${height} Z`
    : "";
  $: zeroY = zeroBaseline && min < 0 && max > 0 ? calcY(0, min, range, height) : null;
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true" class="block max-w-full">
  {#if line}
    <path class="spark-area" d={area} fill={color} opacity="0.12" />
    {#if zeroY !== null}
      <line class="spark-zero" x1={PAD} y1={zeroY} x2={width - PAD} y2={zeroY} stroke="rgb(100 116 139)" stroke-width="1" stroke-dasharray="3,2" />
    {/if}
    <path class="spark-line" d={line} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  {/if}
</svg>
