<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { ComponentProps } from "svelte";
  import WeeklyResultBars from "./WeeklyResultBars.svelte";
  import type { TradeWindows } from "../lib/sleeveFormat";
  import type { TradeWindow } from "../lib/types";

  const { Story } = defineMeta({
    title: "Sleeves/WeeklyResultBars",
    component: WeeklyResultBars,
    render: template,
    parameters: {
      docs: {
        description: {
          component:
            "Net realized bps for each of the last four weekly blocks, oldest on the left, and their total. Bars scale to the row's largest week; a week without trades is a hollow dot, never a 0 bar. Monospace comes from the caller.",
        },
      },
    },
  });

  const week = (since: string, until: string, n: number, total_bps: number | null): TradeWindow => ({ n, total_bps, since, until });
  // w0 is the newest week, w3 the oldest.
  const mixed: TradeWindows = {
    w0: week("2026-10-26", "2026-10-30", 3, 42.5),
    w1: week("2026-10-19", "2026-10-23", 2, -18.2),
    w2: week("2026-10-12", "2026-10-16", 0, null),
    w3: week("2026-10-05", "2026-10-09", 4, 65),
  };
  const losing: TradeWindows = {
    w0: week("2026-10-26", "2026-10-30", 5, -30.1),
    w1: week("2026-10-19", "2026-10-23", 4, -12.4),
    w2: week("2026-10-12", "2026-10-16", 6, -55),
    w3: week("2026-10-05", "2026-10-09", 2, 8.3),
  };
  const noTrades: TradeWindows = {
    w0: week("2026-10-26", "2026-10-30", 0, null),
    w1: week("2026-10-19", "2026-10-23", 0, null),
    w2: week("2026-10-12", "2026-10-16", 0, null),
    w3: week("2026-10-05", "2026-10-09", 0, null),
  };
</script>

{#snippet template(args: ComponentProps<typeof WeeklyResultBars>)}
  <span class="font-mono"><WeeklyResultBars {...args} /></span>
{/snippet}

<Story name="Mixed" args={{ windows: mixed }} />
<Story name="Losing" args={{ windows: losing }} />
<Story name="NoTrades" args={{ windows: noTrades }} />
