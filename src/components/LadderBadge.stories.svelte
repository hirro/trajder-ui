<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import LadderBadge from "./LadderBadge.svelte";
  import type { PromotionInputs } from "../lib/sleeveFormat";
  import type { SleevePromotion, SleevePromotionRung } from "../lib/types";

  // Most stories open the hover card (initialOpen) so the stepper shows next to the ring cell.
  const { Story } = defineMeta({
    title: "Sleeves/LadderBadge",
    component: LadderBadge,
    parameters: {
      docs: {
        // An open card is portaled to <body>, so on the docs page each story gets its own frame.
        story: { inline: false, height: "620px" },
        description: {
          component:
            "A sleeve's place on the promotion ladder as three rings: the rung (outer), P(edge>0) toward the next gate (middle) and closed trades toward the minimum (inner). Hover the ring for the card that steps through the ladder. Set `LADDER_DOCS` for the card's docs link.",
        },
      },
    },
  });

  // The promotion rungs as the backend sends them.
  const rungs: SleevePromotionRung[] = [
    { rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: 0.7 },
    { rung: "FULL", p_threshold: 0.95, n_min: 15, demote_threshold: 0.7 },
  ];
  const shadowPromo: SleevePromotion = { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs };
  const probationPromo: SleevePromotion = { next_rung: "FULL", p_threshold: 0.95, n_min: 15, demote_threshold: 0.7, rungs };
  const fullPromo: SleevePromotion = { next_rung: null, p_threshold: null, n_min: 15, demote_threshold: 0.7, rungs };

  const row = (n: number, p: number, promotion: SleevePromotion | null): PromotionInputs => ({
    n_closed: n,
    p_positive: p,
    scorecard_computed_at: "2026-09-25T00:00:00Z",
    promotion,
  });
</script>

<!-- The design handoff's screenshot case: 4/15 closed trades, P(edge>0) 51%. -->
<Story name="ShadowFourOfFifteen" args={{ status: "SHADOW", sleeve: row(4, 0.51, shadowPromo), initialOpen: true }} />
<!-- No closed trades yet: the 42% skeptical prior is never drawn as progress. -->
<Story name="ShadowPriorOnly" args={{ status: "SHADOW", sleeve: row(0, 0.42, shadowPromo), initialOpen: true }} />
<Story name="ShadowBothMet" args={{ status: "SHADOW", sleeve: row(20, 0.93, shadowPromo), initialOpen: true }} />
<Story name="Probation" parameters={{ docs: { story: { height: "460px" } } }} args={{ status: "PROBATION", sleeve: row(18, 0.92, probationPromo), initialOpen: true }} />
<Story name="FullHolding" parameters={{ docs: { story: { height: "400px" } } }} args={{ status: "FULL", sleeve: row(40, 0.97, fullPromo), initialOpen: true }} />
<Story name="FullBelowDemoteLine" parameters={{ docs: { story: { height: "400px" } } }} args={{ status: "FULL", sleeve: row(40, 0.62, fullPromo), initialOpen: true }} />
<Story name="Frozen" parameters={{ docs: { story: { height: "300px" } } }} args={{ status: "FROZEN", sleeve: row(10, 0.45, null), initialOpen: true }} />
<!-- A sleeve grid row's size (60px rows → 36px ring); proportional geometry at every size. -->
<Story name="Size36" parameters={{ docs: { story: { height: "70px" } } }} args={{ status: "SHADOW", sleeve: row(4, 0.51, shadowPromo), size: 36 }} />
<Story name="Size48" parameters={{ docs: { story: { height: "80px" } } }} args={{ status: "PROBATION", sleeve: row(18, 0.92, probationPromo), size: 48 }} />
<!-- A disabled sleeve: grey rings, fills kept. -->
<Story name="Disabled" parameters={{ docs: { story: { height: "70px" } } }} args={{ status: "SHADOW", sleeve: row(4, 0.51, shadowPromo), size: 36, disabled: true }} />
<!-- A caller that only knows the rung (Signals, SleeveInfoModal, decision history). -->
<Story name="ShadowNoProgress" parameters={{ docs: { story: { height: "320px" } } }} args={{ status: "SHADOW", initialOpen: true }} />
