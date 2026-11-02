import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/svelte";

import LadderBadge from "./LadderBadge.svelte";
import type { SleevePromotion, SleevePromotionRung } from "../lib/types";
import { LADDER_DOCS, type PromotionInputs } from "../lib/sleeveFormat";

// Mirrors backend/api/routes/sleeves.py::_promotion_rungs.
const RUNGS: SleevePromotionRung[] = [
  { rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: 0.7 },
  { rung: "FULL", p_threshold: 0.95, n_min: 15, demote_threshold: 0.7 },
];
const SHADOW_PROMO: SleevePromotion = { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS };
const PROBATION_PROMO: SleevePromotion = { next_rung: "FULL", p_threshold: 0.95, n_min: 15, demote_threshold: 0.7, rungs: RUNGS };
const FULL_PROMO: SleevePromotion = { next_rung: null, p_threshold: null, n_min: 15, demote_threshold: 0.7, rungs: RUNGS };
const AT = "2026-09-25T00:00:00Z";

const sleeve = (n: number, p: number, promotion: SleevePromotion | null): PromotionInputs => ({
  n_closed: n,
  p_positive: p,
  scorecard_computed_at: AT,
  promotion,
});

const trigger = () => screen.getByRole("button", { name: /Ladder rung/ });

async function openCard(): Promise<HTMLElement> {
  await fireEvent.mouseEnter(trigger());
  return waitFor(() => screen.getByTestId("ladder-card"));
}

describe("LadderBadge cell", () => {
  it("renders a triple ring and no visible text — the rung lives on the inner ring and in the aria-label", () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    const btn = trigger();
    expect(btn.textContent?.trim()).toBe("");
    expect(btn).toHaveAttribute("aria-label", "Ladder rung SHADOW — hover for promotion details");
    const ring = screen.getByTestId("ladder-ring");
    expect(ring).toHaveAttribute("data-p-fill", String(Math.round((0.51 / 0.9) * 1000) / 1000));
    expect(ring).toHaveAttribute("data-trades-fill", String(Math.round((4 / 15) * 1000) / 1000));
    expect(ring).toHaveAttribute("data-stage-fill", "0.333");
  });

  it("orders the rings outer → inner as rung (red), P(edge>0) (green), closed trades (blue)", () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    const tracks = [...screen.getByTestId("ladder-ring").querySelectorAll("circle[data-ring]")];
    const byRadius = tracks.sort((a, b) => Number(b.getAttribute("r")) - Number(a.getAttribute("r")));
    expect(byRadius.map((c) => c.getAttribute("data-ring"))).toEqual(["stage", "p", "trades"]);
  });

  it("fills the stage ring by rung", () => {
    for (const [status, fill] of [["FROZEN", "0"], ["SHADOW", "0.333"], ["PROBATION", "0.667"], ["FULL", "1"]] as const) {
      const { unmount } = render(LadderBadge, { props: { status } });
      expect(screen.getByTestId("ladder-ring")).toHaveAttribute("data-stage-fill", fill);
      unmount();
    }
  });

  it("carries the promotion verdict as the trigger's accessible description, not a native tooltip", () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    expect(trigger()).toHaveAccessibleDescription(/to reach PROBATION/);
    // A title attribute would pop the browser's tooltip over the hover card.
    expect(trigger()).not.toHaveAttribute("title");
  });

  it("colours the stepper connectors like the rung ring (red)", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    const card = await openCard();
    const fill = within(card).getByTestId("ladder-connector-1").firstElementChild as HTMLElement;
    expect(fill).toHaveStyle({ backgroundColor: "#FA114F" });
  });

  it("colours the card's requirement bars like their rings: trades blue, P(edge>0) green", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    const card = await openCard();
    expect(within(card).getByTestId("ladder-bar-trades")).toHaveStyle({ backgroundColor: "#1EEAEF" });
    expect(within(card).getByTestId("ladder-bar-confidence")).toHaveStyle({ backgroundColor: "#92E82A" });
  });

  it("draws nothing on the P ring while only the prior exists", () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(0, 0.42, SHADOW_PROMO) } });
    expect(screen.getByTestId("ladder-ring")).toHaveAttribute("data-p-fill", "0");
  });

  it("names an unknown rung with an em dash in the aria-label when status is null or undefined", () => {
    const { unmount } = render(LadderBadge, { props: { status: null } });
    expect(trigger()).toHaveAttribute("aria-label", "Ladder rung — — hover for promotion details");
    unmount();
    render(LadderBadge, { props: { status: undefined } });
    expect(screen.getByTestId("ladder-ring")).toHaveAttribute("data-stage-fill", "0");
  });

  it("a caller without a scorecard (status only) gets empty rings", () => {
    render(LadderBadge, { props: { status: "FULL" } });
    const ring = screen.getByTestId("ladder-ring");
    expect(ring).toHaveAttribute("data-p-fill", "0");
    expect(ring).toHaveAttribute("data-trades-fill", "0");
    expect(ring).toHaveAttribute("data-stage-fill", "1");
  });

  it("marks a FROZEN ring as frozen and unfilled", () => {
    render(LadderBadge, { props: { status: "FROZEN", sleeve: sleeve(10, 0.45, null) } });
    const ring = screen.getByTestId("ladder-ring");
    expect(ring).toHaveAttribute("data-frozen", "true");
    expect(ring).toHaveAttribute("data-p-fill", "0");
  });

  const tracks = () =>
    Object.fromEntries(
      [...screen.getByTestId("ladder-ring").querySelectorAll("circle[data-ring]")].map((c) => [
        c.getAttribute("data-ring"),
        { r: Number(c.getAttribute("r")), sw: Number(c.getAttribute("stroke-width") ?? c.parentElement?.getAttribute("stroke-width")) },
      ]),
    );

  it("defaults to a 26px ring", () => {
    render(LadderBadge, { props: { status: "SHADOW" } });
    const ring = screen.getByTestId("ladder-ring");
    expect(ring).toHaveAttribute("width", "26");
    expect(ring).toHaveAttribute("height", "26");
    expect(ring).toHaveAttribute("viewBox", "0 0 26 26");
  });

  it("scales proportionally with `size`: stroke ≈10.4% of D, middle/inner rings inset 14.6% / 29.2% of D", () => {
    const D = 36;
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO), size: D } });
    const ring = screen.getByTestId("ladder-ring");
    expect(ring).toHaveAttribute("width", String(D));
    expect(ring).toHaveAttribute("viewBox", `0 0 ${D} ${D}`);
    const t = tracks();
    const sw = 0.104 * D;
    // Each ring's stroke band starts at its inset: outer edge radius = D/2 − inset.
    expect(t.stage.r + sw / 2).toBeCloseTo(D / 2, 2);
    expect(t.p.r + sw / 2).toBeCloseTo(D / 2 - 0.146 * D, 2);
    expect(t.trades.r + sw / 2).toBeCloseTo(D / 2 - 0.292 * D, 2);
    expect(t.stage.sw).toBeCloseTo(sw, 2);
    // Evenly spaced and concentric.
    expect(t.stage.r - t.p.r).toBeCloseTo(t.p.r - t.trades.r, 5);
  });

  it("a disabled sleeve draws grey rings but keeps its fills and rung", () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO), disabled: true } });
    const ring = screen.getByTestId("ladder-ring");
    expect(ring).toHaveAttribute("data-disabled", "true");
    expect(ring).toHaveAttribute("data-stage-fill", "0.333");
    const strokes = [...ring.querySelectorAll("circle")].map((c) => c.getAttribute("stroke"));
    expect(strokes.every((s) => s === "#4b5566" || s === "#2b3444")).toBe(true);
    expect(strokes).toContain("#4b5566");
  });

  it("calls onclick when the ring is clicked (the grid opens the sleeve from it)", async () => {
    let clicks = 0;
    render(LadderBadge, { props: { status: "SHADOW", onclick: () => clicks++ } });
    await fireEvent.click(trigger());
    expect(clicks).toBe(1);
  });

  it("an enabled sleeve keeps the Activity colours", () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    const ring = screen.getByTestId("ladder-ring");
    expect(ring).not.toHaveAttribute("data-disabled");
    const strokes = [...ring.querySelectorAll("circle")].map((c) => c.getAttribute("stroke"));
    expect(strokes).toContain("#FA114F");
    expect(strokes).toContain("#92E82A");
    expect(strokes).toContain("#1EEAEF");
  });
});

describe("LadderBadge hover card", () => {
  it("stays closed until hovered, then portals to <body>", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    expect(screen.queryByTestId("ladder-card")).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    const card = await openCard();
    expect(card.parentElement).toBe(document.body);
    expect(card).toHaveAttribute("role", "tooltip");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(within(card).queryByRole("link")).toBeNull(); // no docs link until the app sets one
  });

  it("links the docs the app set", async () => {
    Object.assign(LADDER_DOCS, { href: "#/doc/sleeves/LIFECYCLE.md", label: "Lifecycle docs →" });
    try {
      render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
      const card = await openCard();
      const link = within(card).getByRole("link", { name: /Lifecycle docs/ });
      expect(link).toHaveAttribute("href", "#/doc/sleeves/LIFECYCLE.md");
      expect(link).not.toHaveAttribute("target");
    } finally {
      LADDER_DOCS.href = "";
    }
  });

  it("SHADOW 4/15 at 51%: stepper, next gate and the greyed Then FULL preview", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    const card = await openCard();
    expect(within(card).getByTestId("ladder-step-SHADOW")).toHaveAttribute("data-state", "current");
    expect(within(card).getByTestId("ladder-step-PROBATION")).toHaveAttribute("data-state", "next");
    expect(within(card).getByTestId("ladder-step-FULL")).toHaveAttribute("data-state", "later");
    expect(card).toHaveTextContent("P ≥ 90%");
    expect(card).toHaveTextContent("P ≥ 95%");

    const trades = within(card).getByTestId("ladder-req-trades");
    expect(trades).toHaveTextContent("4/15");
    expect(trades).toHaveTextContent("11 more");
    const conf = within(card).getByTestId("ladder-req-confidence");
    expect(conf).toHaveTextContent("51%");
    expect(conf).toHaveTextContent("+39 pts");

    expect(card).toHaveTextContent("To reach PROBATION");
    const then = within(card).getByTestId("ladder-then-full");
    expect(then).toHaveTextContent("Then FULL");
    expect(then).toHaveTextContent("≥ 15");
    expect(then).toHaveTextContent("≥ 95%");
    expect(within(card).queryByTestId("ladder-hold")).toBeNull();

    expect(card).toHaveTextContent("Demotes one step if P < 70%");
    expect(card).toHaveTextContent(/Kill switch → FROZEN if drawdown > 2× its shadow-era worst · unfreeze manual only/);
  });

  it("prior only: P reads – with a 'prior only' note", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(0, 0.42, SHADOW_PROMO) } });
    const card = await openCard();
    const conf = within(card).getByTestId("ladder-req-confidence");
    expect(conf).toHaveTextContent("–");
    expect(conf).toHaveTextContent("prior only");
    expect(conf).not.toHaveTextContent("42%");
  });

  it("PROBATION: SHADOW past, FULL next, no Then FULL preview", async () => {
    render(LadderBadge, { props: { status: "PROBATION", sleeve: sleeve(18, 0.92, PROBATION_PROMO) } });
    const card = await openCard();
    expect(within(card).getByTestId("ladder-step-SHADOW")).toHaveAttribute("data-state", "past");
    expect(within(card).getByTestId("ladder-step-PROBATION")).toHaveAttribute("data-state", "current");
    expect(within(card).getByTestId("ladder-step-FULL")).toHaveAttribute("data-state", "next");
    expect(card).toHaveTextContent("To reach FULL");
    expect(within(card).getByTestId("ladder-req-trades")).toHaveTextContent("✓ met");
    expect(within(card).getByTestId("ladder-req-confidence")).toHaveTextContent("+3 pts");
    expect(within(card).queryByTestId("ladder-then-full")).toBeNull();
  });

  it("FULL: a Holding FULL box against the demotion line instead of a next gate", async () => {
    render(LadderBadge, { props: { status: "FULL", sleeve: sleeve(40, 0.97, FULL_PROMO) } });
    const card = await openCard();
    const hold = within(card).getByTestId("ladder-hold");
    expect(hold).toHaveTextContent("Holding FULL");
    expect(hold).toHaveTextContent("97%");
    expect(hold).toHaveTextContent("✓ above 70%");
    expect(hold).toHaveTextContent("40 closed");
    expect(within(card).queryByTestId("ladder-next-gate")).toBeNull();
    expect(within(card).queryByTestId("ladder-then-full")).toBeNull();
  });

  it("FULL below the demotion line says so", async () => {
    render(LadderBadge, { props: { status: "FULL", sleeve: sleeve(40, 0.62, FULL_PROMO) } });
    const hold = within(await openCard()).getByTestId("ladder-hold");
    expect(hold).toHaveTextContent("below 70%");
  });

  it("FROZEN: no current chip, a FROZEN note, no gate box", async () => {
    render(LadderBadge, { props: { status: "FROZEN", sleeve: sleeve(10, 0.45, null) } });
    const card = await openCard();
    for (const rung of ["SHADOW", "PROBATION", "FULL"]) {
      expect(within(card).getByTestId(`ladder-step-${rung}`)).toHaveAttribute("data-state", "later");
    }
    expect(card).toHaveTextContent("FROZEN · Kill switch");
    expect(within(card).queryByTestId("ladder-req-trades")).toBeNull();
    expect(within(card).queryByTestId("ladder-hold")).toBeNull();
    expect(card).toHaveTextContent(/Kill switch → FROZEN/);
  });

  it("status-only caller: stepper + stage rule, no gate numbers", async () => {
    render(LadderBadge, { props: { status: "SHADOW" } });
    const card = await openCard();
    expect(within(card).getByTestId("ladder-step-SHADOW")).toHaveAttribute("data-state", "current");
    expect(card).toHaveTextContent("Scored, never funded.");
    expect(card).toHaveTextContent("Promoted when P(edge>0)");
    expect(within(card).queryByTestId("ladder-req-trades")).toBeNull();
    expect(within(card).queryByTestId("ladder-then-full")).toBeNull();
  });

  it("unknown status: a muted line, no stepper state", async () => {
    render(LadderBadge, { props: { status: null } });
    const card = await openCard();
    expect(within(card).queryByTestId("ladder-req-trades")).toBeNull();
    expect(card).toHaveTextContent(/unknown/i);
  });

  it("opens on keyboard focus and closes on Escape", async () => {
    render(LadderBadge, { props: { status: "FULL", sleeve: sleeve(40, 0.97, FULL_PROMO) } });
    await fireEvent.focus(trigger());
    await waitFor(() => expect(screen.getByTestId("ladder-card")).toBeInTheDocument());
    await fireEvent.keyDown(trigger(), { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("ladder-card")).toBeNull());
  });

  it("closes shortly after the pointer leaves, so it can cross into the card first", async () => {
    render(LadderBadge, { props: { status: "FULL" } });
    await openCard();
    await fireEvent.mouseLeave(trigger());
    expect(screen.getByTestId("ladder-card")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("ladder-card")).toBeNull());
  });

  it("waits a moment before opening on hover, so sweeping the pointer across the table stays quiet", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    await fireEvent.mouseEnter(trigger());
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByTestId("ladder-card")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("ladder-card")).toBeInTheDocument());
  });

  it("never opens when the pointer leaves before the delay runs out", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    await fireEvent.mouseEnter(trigger());
    await fireEvent.mouseLeave(trigger());
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByTestId("ladder-card")).toBeNull();
  });

  it("opens immediately on keyboard focus (no hover delay)", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO) } });
    await fireEvent.focus(trigger());
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("ladder-card")).toBeInTheDocument();
  });

  it("initialOpen renders the card straight away (stories)", async () => {
    render(LadderBadge, { props: { status: "SHADOW", sleeve: sleeve(4, 0.51, SHADOW_PROMO), initialOpen: true } });
    await waitFor(() => expect(screen.getByTestId("ladder-card")).toBeInTheDocument());
  });
});
