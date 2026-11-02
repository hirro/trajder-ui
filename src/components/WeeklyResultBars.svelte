<!--
  The "4 weeks" column: four bars w3 → w0 (time runs left to right) of net realized bps per weekly
  block of 5 STO trading days, each closed trade pro-rated over its holding period
  (the backend's sleeve_trade_windows.py; values/tooltips from sleeveFormat.weeklyBars), plus the
  4-week total beside them. Bars are scaled to the row's largest week, so compare shapes within a row
  and totals across rows. N/A weeks are a hollow dot on the zero line, never a 0 bar.
  Used by the Sleeves table. Spans + SVG only.
  Monospace comes from the caller.
-->
<script lang="ts">
  import {
    WEEK_DOWN,
    WEEK_UP,
    type TradeWindows,
    weeklyAriaLabel,
    weeklyBars,
    weeklyTotal,
    weeklyTotalText,
  } from "../lib/sleeveFormat";

  interface Props {
    windows: TradeWindows;
  }
  let { windows }: Props = $props();

  const W = 76;
  const H = 32;
  const MID = H / 2;
  const BAR_W = 13;
  const GAP = 6;
  const MIN_H = 1.5;

  const round2 = (v: number) => Math.round(v * 100) / 100;

  const bars = $derived.by(() => {
    const weeks = weeklyBars(windows);
    const max = Math.max(...weeks.map((b) => Math.abs(b.value ?? 0))) || 1;
    return weeks.map((b, i) => {
      const x = i * (BAR_W + GAP) + 1;
      if (b.value === null) return { ...b, x, na: true as const, dataValue: "N/A" };
      const h = round2(Math.max(MIN_H, (Math.abs(b.value) / max) * (MID - 1)));
      const r = Math.round(b.value * 10) / 10;
      return {
        ...b,
        x,
        na: false as const,
        dataValue: String(r),
        y: round2(b.value >= 0 ? MID - h : MID),
        h,
        fill: r > 0 ? WEEK_UP : r < 0 ? WEEK_DOWN : "#aab3c0",
        // The newest week (last, w0) at full strength; older weeks slightly faded.
        opacity: i === weeks.length - 1 ? undefined : 0.8,
      };
    });
  });
  const total = $derived(weeklyTotalText(weeklyTotal(windows)));
  const label = $derived(weeklyAriaLabel(windows));
</script>

<span class="inline-flex items-center gap-[8px] py-[4px]" role="img" aria-label={label} data-testid="weekly-bars">
  <svg width={W} height={H} viewBox="0 0 {W} {H}" class="block shrink-0 overflow-visible">
    <line x1="0" x2={W} y1={MID} y2={MID} stroke="#34405a" stroke-width="1" />
    {#each bars as bar (bar.key)}
      {#if bar.na}
        <circle cx={bar.x + BAR_W / 2} cy={MID} r="2" fill="#18202d" stroke="#4b5566" stroke-width="1" data-week={bar.key} data-value={bar.dataValue}
          ><title>{bar.title}</title></circle
        >
      {:else}
        <rect
          x={bar.x}
          y={bar.y}
          width={BAR_W}
          height={bar.h}
          rx="1.5"
          fill={bar.fill}
          fill-opacity={bar.opacity}
          data-week={bar.key}
          data-value={bar.dataValue}><title>{bar.title}</title></rect
        >
      {/if}
    {/each}
  </svg>
  <span class="min-w-[58px] text-right text-[12px] tabular-nums" style="color:{total.colour}" data-testid="weekly-total">{total.text}</span>
</span>
