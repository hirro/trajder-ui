<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import SleeveCalibrationChart from "./SleeveCalibrationChart.svelte";
  import type { Bucket } from "../lib/sleeveCalibrationGeometry";

  const { Story } = defineMeta({
    title: "Sleeves/SleeveCalibrationChart",
    component: SleeveCalibrationChart,
    render: template,
    parameters: {
      docs: {
        description: {
          component:
            "Mean excess return per conviction bucket: a calibrated sleeve's bars rise with conviction. Empty buckets read n=0. The chart fills its container's width.",
        },
      },
    },
  });

  // The five fixed conviction buckets the backend always returns.
  const emptyBuckets: Bucket[] = [
    { lo: 0.5, hi: 0.6, n: 0, mean_excess_bps: null },
    { lo: 0.6, hi: 0.7, n: 0, mean_excess_bps: null },
    { lo: 0.7, hi: 0.8, n: 0, mean_excess_bps: null },
    { lo: 0.8, hi: 0.9, n: 0, mean_excess_bps: null },
    { lo: 0.9, hi: 1.0, n: 0, mean_excess_bps: null },
  ];

  const mixedBuckets: Bucket[] = [
    { lo: 0.5, hi: 0.6, n: 4, mean_excess_bps: -35.2 },
    { lo: 0.6, hi: 0.7, n: 7, mean_excess_bps: -8.5 },
    { lo: 0.7, hi: 0.8, n: 0, mean_excess_bps: null },
    { lo: 0.8, hi: 0.9, n: 9, mean_excess_bps: 42.1 },
    { lo: 0.9, hi: 1.0, n: 3, mean_excess_bps: 91.7 },
  ];

  const allPositiveBuckets: Bucket[] = [
    { lo: 0.5, hi: 0.6, n: 5, mean_excess_bps: 12.3 },
    { lo: 0.6, hi: 0.7, n: 6, mean_excess_bps: 24.6 },
    { lo: 0.7, hi: 0.8, n: 8, mean_excess_bps: 38.9 },
    { lo: 0.8, hi: 0.9, n: 5, mean_excess_bps: 55.2 },
    { lo: 0.9, hi: 1.0, n: 2, mean_excess_bps: 70.0 },
  ];
</script>

{#snippet template(args: { buckets: Bucket[] })}
  <div style="max-width: 560px"><SleeveCalibrationChart {...args} /></div>
{/snippet}

<Story name="Empty" args={{ buckets: emptyBuckets }} />
<Story name="Mixed" args={{ buckets: mixedBuckets }} />
<Story name="AllPositive" args={{ buckets: allPositiveBuckets }} />
