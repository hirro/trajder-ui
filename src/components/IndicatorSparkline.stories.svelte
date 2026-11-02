<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { ComponentProps } from "svelte";
  import IndicatorSparkline from "./IndicatorSparkline.svelte";
  import type { SparkPoint } from "../lib/sparklineCoords";

  const { Story } = defineMeta({
    title: "Charts/IndicatorSparkline",
    component: IndicatorSparkline,
    render: template,
    parameters: {
      docs: {
        description: {
          component:
            "A price line with a crosshair tooltip. Pass `indexPoints` to rebase both series to 100 and compare them, `markers` for events such as an entry, and `daily` for date-only tooltips. It fills its container's width.",
        },
      },
    },
  });

  // A fixed price walk (drift plus two waves), so every render looks the same.
  const DAY = 86_400_000;
  const series = (base: number, drift: number, phase: number): SparkPoint[] =>
    Array.from({ length: 90 }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 7, 3, 16) + i * DAY).toISOString(),
      close: +(base * (1 + drift * i + 0.04 * Math.sin(i / 7 + phase) + 0.015 * Math.sin(i / 1.7 + phase))).toFixed(2),
    }));
  const stock = series(250, 0.0012, 0);
  const index = series(2400, 0.0004, 1.3);
</script>

{#snippet template(args: ComponentProps<typeof IndicatorSparkline>)}
  <div style="width: 320px"><IndicatorSparkline {...args} /></div>
{/snippet}

<Story name="DailyCloses" args={{ points: stock, daily: true, gradientId: "story-closes" }} />
<Story name="AgainstIndex" args={{ points: stock, indexPoints: index, indexLabel: "OMXS30", daily: true, gradientId: "story-index" }} />
<Story name="EntryMarker" args={{ points: stock, markers: [{ timestamp: stock[55].timestamp, label: "Entry" }], daily: true, gradientId: "story-entry" }} />
