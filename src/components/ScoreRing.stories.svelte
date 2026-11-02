<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import ScoreRing from "./ScoreRing.svelte";

  const { Story } = defineMeta({
    title: "Charts/ScoreRing",
    component: ScoreRing,
    parameters: {
      docs: { description: { component: "A 0–100 score as a ring: green from 70, amber from 50, grey below that or with no score." } },
    },
  });
</script>

<Story name="High" args={{ score: 82 }} />
<Story name="Middle" args={{ score: 58 }} />
<Story name="Low" args={{ score: 31 }} />
<Story name="NoScore" args={{ score: null }} />
<Story name="Large" args={{ score: 74, size: 64, strokeWidth: 5 }} />
