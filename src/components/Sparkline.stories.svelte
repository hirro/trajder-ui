<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Sparkline from "./Sparkline.svelte";

  const { Story } = defineMeta({
    title: "Charts/Sparkline",
    component: Sparkline,
    parameters: {
      docs: { description: { component: "A small line for a series of numbers; `zeroBaseline` draws the zero line." } },
    },
  });

  const rising = Array.from({ length: 30 }, (_, i) => +(100 + 6 * Math.sin(i / 3) + i * 0.4).toFixed(2));
  const result = Array.from({ length: 30 }, (_, i) => +(12 * Math.sin(i / 4) - 2 + i * 0.3).toFixed(1));
</script>

<Story name="Default" args={{ values: rising }} />
<Story name="ZeroBaseline" args={{ values: result, zeroBaseline: true }} />
<Story name="Colour" args={{ values: rising, color: "#f87171", width: 160, height: 40 }} />
