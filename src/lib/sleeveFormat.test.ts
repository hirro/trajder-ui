import { describe, expect, it } from "vitest";
import {
  EDGE_UNIT,
  RUNG_INFO,
  fmtPct,
  fmtWeekRange,
  ladderView,
  meanEdge,
  posterior,
  projectedMetric,
  promotionProgress,
  rungMeaning,
  weeklyAriaLabel,
  weeklyBars,
  weeklyTotal,
  weeklyTotalText,
} from "./sleeveFormat";
import type { SleevePromotion, SleevePromotionRung } from "./types";
import type { LadderBox } from "./sleeveFormat";

// Mirrors backend/api/routes/sleeves.py::_promotion_rungs (the promotion_service constants).
const RUNGS: SleevePromotionRung[] = [
  { rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: 0.7 },
  { rung: "FULL", p_threshold: 0.95, n_min: 15, demote_threshold: 0.7 },
];
const SHADOW_PROMO: SleevePromotion = { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS };
const PROBATION_PROMO: SleevePromotion = { next_rung: "FULL", p_threshold: 0.95, n_min: 15, demote_threshold: 0.7, rungs: RUNGS };
const FULL_PROMO: SleevePromotion = { next_rung: null, p_threshold: null, n_min: 15, demote_threshold: 0.7, rungs: RUNGS };
const AT = "2026-09-25T00:00:00Z";

// Prod, Sun 27 Sep 2026 (Dip Catcher): w0 = 21–25 Sep … w3 = 31 Aug–4 Sep.
const WEEKS = {
  w0: { n: 4, total_bps: -484.2, since: "2026-09-21", until: "2026-09-25" },
  w1: { n: 1, total_bps: -67.1, since: "2026-09-14", until: "2026-09-18" },
  w2: { n: 9, total_bps: -1031.1, since: "2026-09-07", until: "2026-09-11" },
  w3: { n: 0, total_bps: null, since: "2026-08-31", until: "2026-09-04" },
};

describe("fmtWeekRange", () => {
  it("same month: '7–11 Sep'; across months: '31 Aug–4 Sep' (en dash, calendar dates)", () => {
    expect(fmtWeekRange("2026-09-07", "2026-09-11")).toBe("7–11 Sep");
    expect(fmtWeekRange("2026-08-31", "2026-09-04")).toBe("31 Aug–4 Sep");
    expect(fmtWeekRange("2026-12-28", "2027-01-04")).toBe("28 Dec–4 Jan");
  });
  it("null when either end is missing or malformed", () => {
    expect(fmtWeekRange("2026-09-07", null)).toBeNull();
    expect(fmtWeekRange(undefined, "2026-09-11")).toBeNull();
    expect(fmtWeekRange("x", "2026-09-11")).toBeNull();
  });
});

describe("weeklyBars (the 4-weeks column)", () => {
  it("returns the four weeks oldest → newest (w3 … w0) with their value, null for N/A", () => {
    const bars = weeklyBars(WEEKS);
    expect(bars.map((b) => b.key)).toEqual(["w3", "w2", "w1", "w0"]);
    expect(bars.map((b) => b.value)).toEqual([null, -1031.1, -67.1, -484.2]);
  });

  it("titles each bar with the week, its dates, the overlapping-trade count and pro-rated net", () => {
    const bars = weeklyBars(WEEKS);
    expect(bars[1].title).toBe("w2 · 7–11 Sep: 9 trades overlapping, net −1031.1 bps (pro-rated by holding time)");
    expect(bars[2].title).toBe("w1 · 14–18 Sep: 1 trade overlapping, net −67.1 bps (pro-rated by holding time)");
    expect(bars[0].title).toBe("w3 · 31 Aug–4 Sep: no closed trades");
  });

  it("a week whose trades netted to zero is a real 0, n=0 is N/A even with a stray total", () => {
    const bars = weeklyBars({ w0: { n: 2, total_bps: 0 }, w1: { n: 0, total_bps: 5 } });
    expect(bars.map((b) => b.value)).toEqual([null, null, null, 0]);
    expect(bars[3].title).toBe("w0: 2 trades overlapping, net 0.0 bps (pro-rated by holding time)");
  });

  it("missing windows (an older backend) are all N/A without dates", () => {
    expect(weeklyBars(undefined).map((b) => [b.value, b.title])).toEqual([
      [null, "w3: no closed trades"],
      [null, "w2: no closed trades"],
      [null, "w1: no closed trades"],
      [null, "w0: no closed trades"],
    ]);
  });
});

describe("weeklyTotal", () => {
  it("sums the non-N/A weeks", () => {
    expect(weeklyTotal(WEEKS)).toBeCloseTo(-1582.4);
  });
  it("is null only when every week is N/A", () => {
    expect(weeklyTotal(undefined)).toBeNull();
    expect(weeklyTotal({ w0: { n: 0, total_bps: null } })).toBeNull();
    expect(weeklyTotal({ w3: { n: 1, total_bps: 0 } })).toBe(0);
  });
});

describe("weeklyTotalText", () => {
  it("signed with a true minus, coloured green / red / neutral, N/A muted", () => {
    expect(weeklyTotalText(12.34)).toEqual({ text: "+12.3", colour: "#34c46a" });
    expect(weeklyTotalText(-1582.4)).toEqual({ text: "−1582.4", colour: "#f06464" });
    expect(weeklyTotalText(0.04)).toEqual({ text: "0.0", colour: "#aab3c0" });
    expect(weeklyTotalText(null)).toEqual({ text: "N/A", colour: "#6b7585" });
  });
});

describe("weeklyAriaLabel", () => {
  it("summarises the four weeks oldest first and the total", () => {
    expect(weeklyAriaLabel(WEEKS)).toBe(
      "Last 4 weeks, oldest first: w3 31 Aug–4 Sep N/A; w2 7–11 Sep −1031.1 bps; w1 14–18 Sep −67.1 bps; w0 21–25 Sep −484.2 bps. Total −1582.4 bps."
    );
    expect(weeklyAriaLabel(undefined)).toBe("Last 4 weeks, oldest first: w3 N/A; w2 N/A; w1 N/A; w0 N/A. Total N/A.");
  });
});

describe("EDGE_UNIT", () => {
  it("is bps/1d (#943 horizon scaling)", () => {
    expect(EDGE_UNIT).toBe("bps/1d");
  });
});

describe("meanEdge", () => {
  it("renders the one-day-equivalent unit suffix in green for a positive edge", () => {
    const r = meanEdge({ n_closed: 3, xbar: 12.04 });
    expect(r.text).toBe("+12.0 bps/1d");
    expect(r.className).toContain("text-green-400");
  });
});

describe("posterior", () => {
  it("renders mu_post and sd_post with the one-day-equivalent unit suffix", () => {
    const r = posterior({ n_closed: 3, mu_post: 14.3, sd_post: 26.7 });
    expect(r.text).toBe("14.3 ± 26.7 bps/1d");
  });
});

describe("projectedMetric", () => {
  it("renders em-dash for null", () => {
    expect(projectedMetric(null).text).toBe("—");
  });
  it("formats %/trade with sign and 2dp", () => {
    const r = projectedMetric({ value: 0.0926, unit: "%/trade", label: "x", as_of: null, n: 127 });
    expect(r.text).toBe("+0.09 %/trade");
    expect(r.title).toContain("not comparable across sleeves");
  });
  it("formats IC with 2dp and no sign", () => {
    expect(projectedMetric({ value: 0.0312, unit: "IC", label: "x", as_of: null, n: null }).text).toBe("0.03 IC");
  });
  it("formats Sharpe with 1dp and sign", () => {
    expect(projectedMetric({ value: 1.24, unit: "Sharpe", label: "x", as_of: null, n: 5 }).text).toBe("+1.2 Sharpe");
  });
});

describe("fmtPct", () => {
  it("renders a ratio as a whole percent and a dash when unknown", () => {
    expect(fmtPct(0.9)).toBe("90%");
    expect(fmtPct(0)).toBe("0%");
    expect(fmtPct(null)).toBe("–");
    expect(fmtPct(undefined)).toBe("–");
  });
});

describe("rungMeaning", () => {
  it("joins the shared meaning and rule for a known rung", () => {
    expect(rungMeaning("SHADOW")).toBe(`SHADOW: ${RUNG_INFO.SHADOW.meaning} ${RUNG_INFO.SHADOW.rule}`);
  });
  it("covers every ladder rung", () => {
    expect(Object.keys(RUNG_INFO).sort()).toEqual(["FROZEN", "FULL", "PROBATION", "SHADOW"]);
  });
  it("degrades to the raw id for an unknown rung", () => {
    expect(rungMeaning("WEIRD")).toBe("Rung: WEIRD.");
    expect(rungMeaning(null)).toBe("Rung: unknown.");
  });
});

describe("promotionProgress", () => {
  it("returns null when promotion is missing (FROZEN, unknown rung, old backend)", () => {
    expect(
      promotionProgress({ n_closed: 10, p_positive: 0.71, scorecard_computed_at: "2026-09-25T00:00:00Z" })
    ).toBeNull();
  });

  it("SHADOW n=10 p=0.71: both gates unmet", () => {
    const r = promotionProgress({
      n_closed: 10,
      p_positive: 0.71,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS },
    });
    expect(r?.kind).toBe("promote");
    expect(r?.nextRung).toBe("PROBATION");
    const trades = r?.gates.find((g) => g.id === "trades");
    const confidence = r?.gates.find((g) => g.id === "confidence");
    expect(trades?.caption).toBe("10/15");
    expect(trades?.fill).toBeCloseTo(0.667, 2);
    expect(trades?.met).toBe(false);
    expect(confidence?.caption).toBe("71%/90%");
    expect(confidence?.met).toBe(false);
    expect(r?.verdict).toBe("Needs 5 more closed trades and P(edge>0) at 90% (now 71%) to reach PROBATION.");
  });

  it("SHADOW n=20 p=0.95: both gates met, promotes", () => {
    const r = promotionProgress({
      n_closed: 20,
      p_positive: 0.95,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS },
    });
    expect(r?.gates.every((g) => g.met)).toBe(true);
    expect(r?.verdict).toBe("Promotes to PROBATION at the next nightly review.");
  });

  it("SHADOW n=15 p=0.80: only confidence unmet", () => {
    const r = promotionProgress({
      n_closed: 15,
      p_positive: 0.8,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS },
    });
    expect(r?.gates.find((g) => g.id === "trades")?.met).toBe(true);
    expect(r?.gates.find((g) => g.id === "confidence")?.met).toBe(false);
    expect(r?.verdict).toBe("Needs P(edge>0) to reach 90% (now 80%) to reach PROBATION.");
  });

  it("SHADOW n=14 p=0.95: only trades unmet, singular trade", () => {
    const r = promotionProgress({
      n_closed: 14,
      p_positive: 0.95,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS },
    });
    expect(r?.verdict).toBe("Needs 1 more closed trade to reach PROBATION.");
  });

  it("PROBATION n=5 p=0.60: below the demotion line takes precedence", () => {
    const r = promotionProgress({
      n_closed: 5,
      p_positive: 0.6,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: "FULL", p_threshold: 0.95, n_min: 15, demote_threshold: 0.7, rungs: RUNGS },
    });
    expect(r?.verdict).toBe("Below the 70% demotion line — drops one rung at the next nightly review.");
  });

  it("FULL p=0.82 n=30: holding, buffer met", () => {
    const r = promotionProgress({
      n_closed: 30,
      p_positive: 0.82,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: null, p_threshold: null, n_min: 15, demote_threshold: 0.7, rungs: RUNGS },
    });
    expect(r?.kind).toBe("hold");
    expect(r?.nextRung).toBeNull();
    expect(r?.gates[0].met).toBe(true);
    expect(r?.verdict).toBe("Holding FULL — 12 points above the 70% demotion line.");
  });

  it("FULL n=0 p=0.42: holding on priors, no closed trades yet", () => {
    const r = promotionProgress({
      n_closed: 0,
      p_positive: 0.42,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: null, p_threshold: null, n_min: 15, demote_threshold: 0.7, rungs: RUNGS },
    });
    expect(r?.verdict).toBe("Holding FULL on priors — no closed trades yet.");
  });

  it("unevaluated SHADOW: dash captions, zero fills, awaiting verdict", () => {
    const r = promotionProgress({
      n_closed: null,
      p_positive: null,
      scorecard_computed_at: null,
      promotion: { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS },
    });
    expect(r?.gates.find((g) => g.id === "trades")?.caption).toBe("–/15");
    expect(r?.gates.find((g) => g.id === "confidence")?.caption).toBe("–/90%");
    expect(r?.gates.every((g) => g.fill === 0)).toBe(true);
    expect(r?.verdict).toBe("Awaiting the first nightly evaluation.");
  });

  it("unevaluated SHADOW: both details show the dash the caption shows, not a zero", () => {
    const r = promotionProgress({
      n_closed: null,
      p_positive: null,
      scorecard_computed_at: null,
      promotion: { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS },
    });
    expect(r?.gates.find((g) => g.id === "trades")?.detail).toBe("Closed non-paper trades: – of 15 required.");
    expect(r?.gates.find((g) => g.id === "confidence")?.detail).toBe(
      "Skeptical prior — no closed trades yet, not measured evidence. 90% required."
    );
  });

  it("evaluated SHADOW n=0 p=0.42: the skeptical prior is never drawn as confidence progress", () => {
    const r = promotionProgress({
      n_closed: 0,
      p_positive: 0.42,
      scorecard_computed_at: "2026-09-25T00:00:00Z",
      promotion: { next_rung: "PROBATION", p_threshold: 0.9, n_min: 15, demote_threshold: null, rungs: RUNGS },
    });
    const trades = r?.gates.find((g) => g.id === "trades");
    const confidence = r?.gates.find((g) => g.id === "confidence");
    expect(trades?.caption).toBe("0/15");
    expect(trades?.fill).toBe(0);
    expect(trades?.met).toBe(false);
    expect(confidence?.caption).toBe("–/90%");
    expect(confidence?.fill).toBe(0);
    expect(confidence?.met).toBe(false);
    expect(confidence?.detail).toContain("Skeptical prior (42%)");
    expect(r?.verdict).toBe("Needs 15 more closed trades and P(edge>0) at 90% (now 42%, prior) to reach PROBATION.");
  });
});

describe("ladderView", () => {
  const states = (v: ReturnType<typeof ladderView>) => Object.fromEntries(v.chips.map((c) => [c.rung, c.state]));
  const row = (box: LadderBox | null, id: string) => box?.rows.find((r) => r.id === id);

  it("SHADOW 4/15 at 51%: the design's screenshot case", () => {
    const v = ladderView({ ladder_status: "SHADOW", n_closed: 4, p_positive: 0.51, scorecard_computed_at: AT, promotion: SHADOW_PROMO });
    expect(v.stage).toBe("SHADOW");
    expect(v.label).toBe("SHADOW");
    expect(v.frozen).toBe(false);
    expect(v.priorOnly).toBe(false);
    expect(v.tradesFill).toBeCloseTo(4 / 15);
    expect(v.pFill).toBeCloseTo(0.51 / 0.9);
    expect(states(v)).toEqual({ SHADOW: "current", PROBATION: "next", FULL: "later" });
    expect(v.connectors[0]).toBeCloseTo(4 / 15); // the binding gate: min(trades, P)
    expect(v.connectors[1]).toBe(0);
    expect(v.gateLabels).toEqual(["P ≥ 90%", "P ≥ 95%"]);

    expect(v.nextGate?.rung).toBe("PROBATION");
    expect(v.nextGate?.footer).toBe(RUNG_INFO.PROBATION.meaning);
    const trades = row(v.nextGate, "trades");
    expect(trades).toMatchObject({ label: "Closed trades", value: "4/15", note: "11 more", met: false, marker: null });
    expect(trades?.fill).toBeCloseTo(4 / 15);
    const conf = row(v.nextGate, "confidence");
    expect(conf).toMatchObject({ label: "P(edge>0)", value: "51%", note: "+39 pts", met: false, marker: 0.9, tone: "muted" });
    expect(conf?.fill).toBeCloseTo(0.51); // the bar is the raw P, the marker is the target

    expect(v.thenFull?.rung).toBe("FULL");
    expect(v.thenFull?.footer).toBe(RUNG_INFO.FULL.meaning);
    expect(row(v.thenFull, "trades")).toMatchObject({ value: "≥ 15", fill: 0, marker: null });
    expect(row(v.thenFull, "confidence")).toMatchObject({ value: "≥ 95%", fill: 0, marker: 0.95 });
    expect(v.hold).toBeNull();
    expect(v.demoteThreshold).toBe(0.7); // SHADOW's own demote_threshold is null; the legend reads it from rungs
    expect(v.verdict).toContain("to reach PROBATION");
  });

  it("SHADOW with zero closed trades: the skeptical prior never renders as progress", () => {
    const v = ladderView({ ladder_status: "SHADOW", n_closed: 0, p_positive: 0.42, scorecard_computed_at: AT, promotion: SHADOW_PROMO });
    expect(v.priorOnly).toBe(true);
    expect(v.pFill).toBe(0);
    expect(v.tradesFill).toBe(0);
    expect(v.connectors).toEqual([0, 0]);
    expect(row(v.nextGate, "confidence")).toMatchObject({ value: "–", note: "prior only", fill: 0, met: false });
    expect(row(v.nextGate, "trades")).toMatchObject({ value: "0/15", note: "15 more" });
  });

  it("SHADOW with both gates met: ✓ met on both rows, connector full", () => {
    const v = ladderView({ ladder_status: "SHADOW", n_closed: 20, p_positive: 0.93, scorecard_computed_at: AT, promotion: SHADOW_PROMO });
    expect(row(v.nextGate, "trades")).toMatchObject({ value: "20/15", note: "✓ met", met: true, fill: 1 });
    expect(row(v.nextGate, "confidence")).toMatchObject({ value: "93%", note: "✓ met", met: true });
    expect(v.connectors[0]).toBe(1);
  });

  it("never reads '+0 pts' for a P that rounds onto the target without reaching it", () => {
    const v = ladderView({ ladder_status: "SHADOW", n_closed: 20, p_positive: 0.898, scorecard_computed_at: AT, promotion: SHADOW_PROMO });
    expect(row(v.nextGate, "confidence")?.note).toBe("+1 pts");
  });

  it("PROBATION 18 closed at 92%: first connector passed, second at min(1, 92/95)", () => {
    const v = ladderView({ ladder_status: "PROBATION", n_closed: 18, p_positive: 0.92, scorecard_computed_at: AT, promotion: PROBATION_PROMO });
    expect(states(v)).toEqual({ SHADOW: "past", PROBATION: "current", FULL: "next" });
    expect(v.connectors[0]).toBe(1);
    expect(v.connectors[1]).toBeCloseTo(0.92 / 0.95);
    expect(v.tradesFill).toBe(1);
    expect(v.pFill).toBeCloseTo(0.92 / 0.95);
    expect(v.nextGate?.rung).toBe("FULL");
    expect(v.nextGate?.footer).toBe(RUNG_INFO.FULL.meaning);
    expect(row(v.nextGate, "trades")).toMatchObject({ value: "18/15", note: "✓ met", met: true });
    expect(row(v.nextGate, "confidence")).toMatchObject({ value: "92%", note: "+3 pts", met: false, marker: 0.95 });
    expect(v.thenFull).toBeNull(); // only SHADOW previews the rung after next
    expect(v.hold).toBeNull();
  });

  it("PROBATION with both gates met", () => {
    const v = ladderView({ ladder_status: "PROBATION", n_closed: 30, p_positive: 0.97, scorecard_computed_at: AT, promotion: PROBATION_PROMO });
    expect(row(v.nextGate, "trades")?.note).toBe("✓ met");
    expect(row(v.nextGate, "confidence")?.note).toBe("✓ met");
    expect(v.connectors).toEqual([1, 1]);
  });

  it("FULL above the demotion line: hold box instead of a next gate", () => {
    const v = ladderView({ ladder_status: "FULL", n_closed: 40, p_positive: 0.97, scorecard_computed_at: AT, promotion: FULL_PROMO });
    expect(states(v)).toEqual({ SHADOW: "past", PROBATION: "past", FULL: "current" });
    expect(v.connectors).toEqual([1, 1]);
    expect(v.nextGate).toBeNull();
    expect(v.thenFull).toBeNull();
    expect(v.hold?.rung).toBe("FULL");
    expect(v.hold?.footer).toBeNull();
    expect(row(v.hold, "confidence")).toMatchObject({ value: "97%", note: "✓ above 70%", met: true, marker: 0.7, tone: "met" });
    expect(row(v.hold, "confidence")?.fill).toBeCloseTo(0.97);
    expect(row(v.hold, "trades")).toMatchObject({ value: "40 closed", fill: null, note: "" });
    expect(v.pFill).toBe(1); // 97% against FULL's 95% entry gate
    expect(v.demoteThreshold).toBe(0.7);
  });

  it("FULL below the demotion line", () => {
    const v = ladderView({ ladder_status: "FULL", n_closed: 40, p_positive: 0.62, scorecard_computed_at: AT, promotion: FULL_PROMO });
    expect(row(v.hold, "confidence")).toMatchObject({ value: "62%", note: "below 70%", met: false, tone: "danger" });
    expect(v.verdict).toContain("demotion line");
  });

  it("FULL with no closed trades holds on priors: nothing drawn", () => {
    const v = ladderView({ ladder_status: "FULL", n_closed: 0, p_positive: 0.99, scorecard_computed_at: AT, promotion: FULL_PROMO });
    expect(v.pFill).toBe(0);
    expect(row(v.hold, "confidence")).toMatchObject({ value: "–", note: "prior only", fill: 0, met: false, tone: "muted" });
  });

  it("FROZEN: grey, unfilled, no chip current, no gate boxes", () => {
    const v = ladderView({ ladder_status: "FROZEN", n_closed: 10, p_positive: 0.45, scorecard_computed_at: AT, promotion: null });
    expect(v.frozen).toBe(true);
    expect(v.label).toBe("FROZEN");
    expect(v.pFill).toBe(0);
    expect(v.tradesFill).toBe(0);
    expect(Object.values(states(v))).toEqual(["later", "later", "later"]);
    expect(v.connectors).toEqual([0, 0]);
    expect(v.nextGate).toBeNull();
    expect(v.thenFull).toBeNull();
    expect(v.hold).toBeNull();
    expect(v.demoteThreshold).toBeNull();
    expect(v.verdict).toBeNull();
  });

  it("no promotion data (a caller without a scorecard row): structure only, no numbers", () => {
    const v = ladderView({ ladder_status: "PROBATION" });
    expect(v.hasProgress).toBe(false);
    expect(v.pFill).toBe(0);
    expect(v.tradesFill).toBe(0);
    expect(states(v)).toEqual({ SHADOW: "past", PROBATION: "current", FULL: "next" });
    expect(v.connectors).toEqual([1, 0]);
    expect(v.gateLabels).toEqual([null, null]);
    expect(v.nextGate).toBeNull();
    expect(v.hold).toBeNull();
  });

  it("stageFill places the rung on the inner ring: FROZEN 0, SHADOW ⅓, PROBATION ⅔, FULL 1", () => {
    expect(ladderView({ ladder_status: "FROZEN" }).stageFill).toBe(0);
    expect(ladderView({ ladder_status: "SHADOW" }).stageFill).toBeCloseTo(1 / 3);
    expect(ladderView({ ladder_status: "PROBATION" }).stageFill).toBeCloseTo(2 / 3);
    expect(ladderView({ ladder_status: "FULL" }).stageFill).toBe(1);
  });

  it("null / unknown status degrades to an em dash without crashing", () => {
    for (const status of [null, undefined, "SIDEWAYS"]) {
      const v = ladderView({ ladder_status: status });
      expect(v.stage).toBeNull();
      expect(v.label).toBe("—");
      expect(v.pFill).toBe(0);
      expect(v.stageFill).toBe(0);
      expect(v.chips.every((c) => c.state === "later")).toBe(true);
      expect(v.nextGate).toBeNull();
    }
  });
});
