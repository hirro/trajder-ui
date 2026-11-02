<script lang="ts">
  interface Props {
    score?: number | null;
    size?: number;
    strokeWidth?: number;
  }

  let { score = null, size = 44, strokeWidth = 3 }: Props = $props();

  const r = $derived(size / 2 - strokeWidth);
  const c = $derived(2 * Math.PI * r);
  const pct = $derived(score == null ? 0 : Math.max(0, Math.min(100, score)));
  const color = $derived(
    score == null
      ? "rgb(100 116 139)"
      : score >= 70
        ? "rgb(52 211 153)"
        : score >= 50
          ? "rgb(251 191 36)"
          : "rgb(100 116 139)"
  );
  const dash = $derived((pct / 100) * c);
</script>

<div
  class="relative inline-flex items-center justify-center"
  style="width: {size}px; height: {size}px;"
>
  <svg width={size} height={size} aria-hidden="true">
    <circle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke="rgb(31 42 64)"
      stroke-width={strokeWidth}
    />
    {#if score != null}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        stroke-width={strokeWidth}
        stroke-linecap="round"
        stroke-dasharray="{dash} {c}"
        transform="rotate(-90 {size / 2} {size / 2})"
      />
    {/if}
  </svg>
  <div
    class="num absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-gray-100"
  >
    {score ?? "—"}
  </div>
</div>
