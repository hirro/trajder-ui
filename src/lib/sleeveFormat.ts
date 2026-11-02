/**
 * Shared sleeve-scorecard formatting (#619).
 *
 * The promotion engine writes a scorecard row for EVERY sleeve on its first nightly run — with
 * n_closed = 0. So the "no scorecard at all" path is nearly unreachable in practice, and the row a
 * user actually sees is full of PRIORS and DEFAULTS, not measurements:
 *   - xbar = 0.0 with n_closed = 0 is "no data", not a measured neutral outcome (rendering it as a
 *     green "+0.0 bps" reads as mildly good — a lie).
 *   - p_positive with n_closed = 0 is the skeptical prior the ladder acts on — real, but not evidence.
 *   - calibration_slope = 1.0 whenever fewer than CALIBRATION_MIN_N closed trades exist — the
 *     underpowered default, not a fitted slope ("perfectly calibrated" is exactly the wrong read).
 *
 * These helpers are shared by Sleeves.svelte (overview) and SleeveDetail.svelte (scorecard panel +
 * the slope beside the calibration chart) so the two views cannot drift apart on this.
 */

import type { SleevePromotion, TradeWindow, TradeWindowKey } from "./types";

// Mirrors the backend's promotion_math.py CALIBRATION_MIN_N — that file is the source of truth.
// Below this many closed trades, calibration_slope() returns the 1.0 default instead of an OLS fit.
export const CALIBRATION_MIN_N = 10;

/** Unit of every scorecard edge since #943: ATR-normalized bps scaled to a ONE-DAY hold (÷ √holding-days). */
export const EDGE_UNIT = "bps/1d";

/** Ladder ring diameter in the sleeve tables (Sleeves table): clamp(16px, 60% of a
 *  60px row, 48px) from the 2c design handoff. One constant so every surface stays the same size. */
export const TABLE_RING_SIZE = 36;

const MUTED = "text-gray-500";

export interface ScorecardFields {
  n_closed: number | null;
  xbar: number | null;
  p_positive: number | null;
  calibration_slope: number | null;
  mu_post?: number | null;
  sd_post?: number | null;
}

/** True once at least one closed trade backs the scorecard's numbers. */
export const hasClosedEvidence = (s: Pick<ScorecardFields, "n_closed">) => (s.n_closed ?? 0) > 0;

export interface Rendered {
  text: string;
  className: string;
  title?: string;
}

/** Mean excess edge. With zero closed trades xbar is 0.0 by construction — show nothing, not "+0.0 bps". */
export function meanEdge(s: Pick<ScorecardFields, "n_closed" | "xbar">): Rendered {
  if (!hasClosedEvidence(s) || s.xbar === null || s.xbar === undefined) {
    return { text: "–", className: MUTED, title: "No closed trades yet — no measured edge." };
  }
  return {
    text: `${s.xbar >= 0 ? "+" : ""}${s.xbar.toFixed(1)} ${EDGE_UNIT}`,
    className: s.xbar >= 0 ? "text-green-400" : "text-red-400",
    title: "Mean excess edge per trade, ATR-normalized and scaled to a one-day hold.",
  };
}

// --- Weekly trade results (the "4 weeks" column: TA grid + Specialist table) --------------------
//
// Four non-overlapping blocks of 5 STO trading days counted back from the last trading day
// (the backend's sleeve_trade_windows.py): w0 = newest … w3 = oldest. Each closed trade's net
// realized bps is spread evenly over its holding period (fill → close) and a week sums the shares that
// fall inside it; n counts the trades overlapping it. No overlapping trade → N/A, never 0 — a week
// whose trades netted to zero is a real result and reads "0.0".

/** Newest first, as the backend keys them. */
export const WEEK_KEYS: readonly TradeWindowKey[] = ["w0", "w1", "w2", "w3"];

export type TradeWindows = Partial<Record<TradeWindowKey, TradeWindow>> | null | undefined;

export const WEEK_UP = "#34c46a";
export const WEEK_DOWN = "#f06464";
const WEEK_FLAT = "#aab3c0";
const WEEK_NA = "#6b7585";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An ISO calendar date's [day, month index] — parsed as a calendar date, so no timezone can shift it. */
const calendarDate = (iso: string | null | undefined): [number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? [Number(m[3]), Number(m[2]) - 1] : null;
};

/** A week's trading-day span: "7–11 Sep" within a month, "31 Aug–4 Sep" across months; null without both dates. */
export function fmtWeekRange(since: string | null | undefined, until: string | null | undefined): string | null {
  const a = calendarDate(since);
  const b = calendarDate(until);
  if (!a || !b) return null;
  return a[1] === b[1] ? `${a[0]}–${b[0]} ${MONTHS[b[1]]}` : `${a[0]} ${MONTHS[a[1]]}–${b[0]} ${MONTHS[b[1]]}`;
}

/** Signed one-decimal bps with a true minus sign (U+2212); the sign follows the rounded value. */
const signedBps = (v: number): string => {
  const r = Math.round(v * 10) / 10;
  if (r === 0) return "0.0";
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}`;
};

/** One week's net bps, or null when it is N/A (no window, or no trade overlapped it). */
export function tradeWindowTotal(w: TradeWindow | null | undefined): number | null {
  if (!w || w.n <= 0 || w.total_bps === null || w.total_bps === undefined) return null;
  return w.total_bps;
}

export interface WeekBar {
  key: TradeWindowKey;
  /** Net pro-rated bps, or null for N/A. */
  value: number | null;
  /** "w2 · 7–11 Sep: 9 trades overlapping, net −1031.1 bps (pro-rated by holding time)". */
  title: string;
}

const weekLabel = (key: TradeWindowKey, w: TradeWindow | undefined): string => {
  const range = fmtWeekRange(w?.since, w?.until);
  return range ? `${key} · ${range}` : key;
};

/** The four weeks in drawing order — oldest → newest (w3 … w0), so time runs left to right. */
export function weeklyBars(windows: TradeWindows): WeekBar[] {
  return [...WEEK_KEYS].reverse().map((key) => {
    const w = windows?.[key];
    const value = tradeWindowTotal(w);
    const label = weekLabel(key, w);
    if (!w || value === null) return { key, value: null, title: `${label}: no closed trades` };
    const trades = `${w.n} trade${w.n === 1 ? "" : "s"} overlapping`;
    return { key, value, title: `${label}: ${trades}, net ${signedBps(value)} bps (pro-rated by holding time)` };
  });
}

/** The 4-week total: the sum of the non-N/A weeks; null only when every week is N/A. Also the Specialist sort key. */
export function weeklyTotal(windows: TradeWindows): number | null {
  const values = WEEK_KEYS.map((k) => tradeWindowTotal(windows?.[k])).filter((v): v is number => v !== null);
  return values.length ? values.reduce((s, v) => s + v, 0) : null;
}

/** The total beside the bars: signed, green / red / neutral by the rounded value; muted "N/A" when null. */
export function weeklyTotalText(total: number | null): { text: string; colour: string } {
  if (total === null) return { text: "N/A", colour: WEEK_NA };
  const r = Math.round(total * 10) / 10;
  return { text: signedBps(total), colour: r > 0 ? WEEK_UP : r < 0 ? WEEK_DOWN : WEEK_FLAT };
}

/** Screen-reader summary of the (visual-only) bars: every week oldest first, then the total. */
export function weeklyAriaLabel(windows: TradeWindows): string {
  const weeks = weeklyBars(windows).map((b) => {
    const range = fmtWeekRange(windows?.[b.key]?.since, windows?.[b.key]?.until);
    return `${b.key}${range ? ` ${range}` : ""} ${b.value === null ? "N/A" : `${signedBps(b.value)} bps`}`;
  });
  const total = weeklyTotal(windows);
  return `Last 4 weeks, oldest first: ${weeks.join("; ")}. Total ${total === null ? "N/A" : `${signedBps(total)} bps`}.`;
}

/** P(edge>0): keep the number even at n=0 (the ladder acts on it) but mark it as the prior. */
export function pPositive(s: Pick<ScorecardFields, "n_closed" | "p_positive">): Rendered {
  if (s.p_positive === null || s.p_positive === undefined) {
    return { text: "–", className: MUTED };
  }
  const text = `${(s.p_positive * 100).toFixed(0)}%`;
  if (!hasClosedEvidence(s)) {
    return { text, className: MUTED, title: "Skeptical prior — no closed trades yet, this is not measured evidence." };
  }
  return { text, className: "text-gray-200" };
}

/** Posterior mu ± sd. At n=0 this IS the prior — say so. */
export function posterior(s: Pick<ScorecardFields, "n_closed" | "mu_post" | "sd_post">): Rendered {
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toFixed(1));
  const text = `${fmt(s.mu_post)} ± ${fmt(s.sd_post)} ${EDGE_UNIT}`;
  if (!hasClosedEvidence(s)) {
    return { text, className: MUTED, title: "Prior — no closed trades yet; the posterior has not moved off the prior." };
  }
  return { text, className: "text-gray-200" };
}

/** Calibration slope: 1.0 below CALIBRATION_MIN_N closed trades is the default, not a fit. */
export function calibrationSlope(s: Pick<ScorecardFields, "n_closed" | "calibration_slope">): Rendered {
  if (s.calibration_slope === null || s.calibration_slope === undefined) {
    return { text: "–", className: MUTED };
  }
  const value = s.calibration_slope.toFixed(2);
  if ((s.n_closed ?? 0) < CALIBRATION_MIN_N) {
    return {
      text: `${value} (default)`,
      className: MUTED,
      title: `Default 1.0 — fewer than ${CALIBRATION_MIN_N} closed trades, not enough evidence to fit a slope.`,
    };
  }
  return { text: value, className: "text-gray-200" };
}

export interface ProjectedFields {
  value: number;
  unit: string;
  label: string;
  as_of: string | null;
  n: number | null;
}

const PROJECTED_CAVEAT =
  "Backtest/projected — optimistic (gross of costs, in-sample selection) and not comparable across sleeves. Realized edge is the empirical columns.";

/** Projected (backtest) metric: native per-sleeve unit, never cross-comparable. Em-dash when absent. */
export function projectedMetric(p: ProjectedFields | null | undefined): Rendered {
  if (!p) {
    return { text: "—", className: MUTED };
  }
  const dp = p.unit === "Sharpe" ? 1 : 2;
  const signed = p.unit !== "IC";
  const sign = signed && p.value >= 0 ? "+" : "";
  const nPart = p.n != null ? ` · n=${p.n}` : "";
  return {
    text: `${sign}${p.value.toFixed(dp)} ${p.unit}`,
    className: "text-gray-300",
    title: `${p.label}${nPart}\n${PROJECTED_CAVEAT}`,
  };
}

/** A ratio in [0, 1] as a whole percent (fill ratio); "–" when unknown. Shared by the Sleeves table,
 *  SleeveDetail and SleeveInfoModal so the three never format it differently. */
export const fmtPct = (v: number | null | undefined): string => (v === null || v === undefined ? "–" : `${(v * 100).toFixed(0)}%`);

/**
 * What each promotion-ladder rung means and the rule that moves a sleeve off it — the single source
 * of truth for LadderBadge's hover card and SleeveInfoModal's "what the rung means" line (they used to
 * carry two divergent copies). Thresholds in the `rule` prose mirror the backend's promotion_service.py
 * (P_PROBATION / P_FULL / P_DEMOTE / N_MIN) and the kill-switch rule in docs/sleeves/LIFECYCLE.md —
 * keep them in sync when those change. LadderBadge's card draws every number from the backend
 * `promotion` payload (ladderView) and shows `rule` only where no payload exists, so a constant changed
 * in promotion_service.py must be mirrored here or the two contradict each other. Since #943
 * the edge feeding P(edge>0) is scaled to a one-day-equivalent hold (÷ √holding-days) before the
 * posterior update — see HORIZON_REF_DAYS in the backend's promotion_math.py.
 */
export interface RungInfo {
  meaning: string;
  rule: string;
}
// An app may reword a rung's `meaning` at startup (e.g. to say where its orders go).
export const RUNG_INFO: Record<string, RungInfo> = {
  SHADOW: {
    meaning: "Scored, never funded. Every sleeve starts here.",
    rule: "Promoted when P(edge>0) ≥ 90% over ≥ 15 closed trades; edge is scaled to a one-day hold.",
  },
  PROBATION: {
    meaning: "Funded with a small fixed share (5%) of the risk budget.",
    rule: "Promoted when P(edge>0) ≥ 95% over ≥ 15 closed trades. Demoted below 70%.",
  },
  FULL: {
    meaning: "Full participant. Splits the remaining budget with the other FULL sleeves.",
    rule: "Demoted one rung when P(edge>0) drops below 70%.",
  },
  FROZEN: {
    meaning: "Kill switch: drawdown exceeded 2× its shadow-era worst.",
    rule: "Off the ladder. Only a human can unfreeze it.",
  },
};

/** One sentence pair for a rung, e.g. "SHADOW: Scored, never funded. … Promoted when …". Unknown rungs degrade to their raw id. */
/** The ladder card's docs link. Each app sets it once at startup; an empty href hides the link. */
export const LADDER_DOCS = { href: "", label: "Docs →" };

export function rungMeaning(status: string | null | undefined): string {
  const info = status ? RUNG_INFO[status] : undefined;
  if (!info) return `Rung: ${status ?? "unknown"}.`;
  return `${status}: ${info.meaning} ${info.rule}`;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

const demotionVerdict = (demoteThreshold: number): string =>
  `Below the ${fmtPct(demoteThreshold)} demotion line — drops one rung at the next nightly review.`;

export interface PromotionGate {
  id: "trades" | "confidence" | "buffer";
  /** Short caption shown beside the bar, e.g. "10/15" or "71%/90%". */
  caption: string;
  /** Longer explanation for a title attribute / the popover. */
  detail: string;
  /** 0..1 fill of the bar. */
  fill: number;
  met: boolean;
}

export interface PromotionProgress {
  /** "promote": a next rung exists (SHADOW, PROBATION). "hold": FULL — only the demotion line applies. */
  kind: "promote" | "hold";
  nextRung: "PROBATION" | "FULL" | null;
  gates: PromotionGate[];
  /** One sentence: what the next nightly review will do / what is still missing. */
  verdict: string;
}

export interface PromotionInputs {
  n_closed: number | null | undefined;
  p_positive: number | null | undefined;
  scorecard_computed_at: string | null | undefined;
  promotion?: SleevePromotion | null;
}

/** Turns a sleeve row's promotion gates into bar fills, captions and a one-sentence verdict for the ladder indicator. */
export function promotionProgress(s: PromotionInputs): PromotionProgress | null {
  const promotion = s.promotion;
  if (!promotion) return null;

  const n = s.n_closed ?? 0;
  const p = s.p_positive ?? null;
  const evaluated = s.scorecard_computed_at != null;
  // With zero closed trades p_positive is the skeptical prior the ladder acts on, not evidence (see
  // the header comment) — so the confidence bar shows no progress at all until the first trade closes.
  const evidence = hasClosedEvidence({ n_closed: n });
  const { next_rung: nextRung, p_threshold: pThreshold, n_min: nMin, demote_threshold: demoteThreshold } = promotion;

  // n >= 1 mirrors the n_closed >= 1 gate in the backend's promotion_service.py: zero evidence must
  // never demote a sleeve on the prior alone.
  const demotionApplies = demoteThreshold != null && p != null && p < demoteThreshold && n >= 1;

  if (nextRung !== null) {
    const priorNote = `Skeptical prior${p == null ? "" : ` (${fmtPct(p)})`} — no closed trades yet, not measured evidence.`;
    const tradesMet = n >= nMin;
    const confidenceMet = evidence && p != null && pThreshold != null && p >= pThreshold;

    const tradesGate: PromotionGate = {
      id: "trades",
      caption: `${evaluated ? n : "–"}/${nMin}`,
      fill: clamp01(n / nMin),
      met: tradesMet,
      detail: `Closed non-paper trades: ${evaluated ? n : "–"} of ${nMin} required.`,
    };
    const confidenceGate: PromotionGate = evidence
      ? {
          id: "confidence",
          caption: `${fmtPct(p)}/${fmtPct(pThreshold)}`,
          fill: p == null || pThreshold == null ? 0 : clamp01(p / pThreshold),
          met: confidenceMet,
          detail: `P(edge>0): ${fmtPct(p)} of ${fmtPct(pThreshold)} required.`,
        }
      : {
          id: "confidence",
          caption: `–/${fmtPct(pThreshold)}`,
          fill: 0,
          met: false,
          detail: `${priorNote} ${fmtPct(pThreshold)} required.`,
        };
    // "(now 42%, prior)" so a verdict can never read as if the prior were a measurement.
    const nowP = `${fmtPct(p)}${evidence ? "" : ", prior"}`;

    let verdict: string;
    if (!evaluated) {
      verdict = "Awaiting the first nightly evaluation.";
    } else if (demotionApplies) {
      verdict = demotionVerdict(demoteThreshold as number);
    } else if (tradesMet && confidenceMet) {
      verdict = `Promotes to ${nextRung} at the next nightly review.`;
    } else if (!tradesMet && confidenceMet) {
      const need = nMin - n;
      verdict = `Needs ${need} more closed trade${need === 1 ? "" : "s"} to reach ${nextRung}.`;
    } else if (tradesMet && !confidenceMet) {
      verdict = `Needs P(edge>0) to reach ${fmtPct(pThreshold)} (now ${nowP}) to reach ${nextRung}.`;
    } else {
      const need = nMin - n;
      verdict = `Needs ${need} more closed trade${need === 1 ? "" : "s"} and P(edge>0) at ${fmtPct(pThreshold)} (now ${nowP}) to reach ${nextRung}.`;
    }

    return { kind: "promote", nextRung, gates: [tradesGate, confidenceGate], verdict };
  }

  // kind "hold" (FULL): only the demotion buffer applies.
  if (demoteThreshold == null) return null;

  const bufferMet = p != null && p >= demoteThreshold;
  const bufferGate: PromotionGate = {
    id: "buffer",
    caption: `${fmtPct(p)} vs ${fmtPct(demoteThreshold)}`,
    fill: p == null ? 0 : clamp01((p - demoteThreshold) / (1 - demoteThreshold)),
    met: bufferMet,
    detail: `P(edge>0) ${fmtPct(p)}; demoted below ${fmtPct(demoteThreshold)}.`,
  };

  let verdict: string;
  if (!evaluated) {
    verdict = "Awaiting the first nightly evaluation.";
  } else if (demotionApplies) {
    verdict = demotionVerdict(demoteThreshold);
  } else if (n === 0) {
    verdict = "Holding FULL on priors — no closed trades yet.";
  } else {
    const points = p == null ? 0 : Math.round((p - demoteThreshold) * 100);
    verdict = `Holding FULL — ${points} points above the ${fmtPct(demoteThreshold)} demotion line.`;
  }

  return { kind: "hold", nextRung: null, gates: [bufferGate], verdict };
}

// ---------------------------------------------------------------------------
// Ladder control view-model (LadderBadge): the twin-ring cell + the stepper hover card.
// Every threshold comes from the backend `promotion` payload (its `rungs` list for the stepper) —
// nothing here hard-codes the promotion_service constants.
// ---------------------------------------------------------------------------

export type LadderStage = "SHADOW" | "PROBATION" | "FULL" | "FROZEN";
export type LadderRung = "SHADOW" | "PROBATION" | "FULL";
/** current: the sleeve's rung · next: the rung it can promote to · past: rungs below · later: beyond next. */
export type LadderChipState = "current" | "next" | "past" | "later";

export interface LadderReqRow {
  id: "trades" | "confidence";
  label: string;
  /** 0..1 bar fill (the raw P for the confidence row); null = the row has no bar. */
  fill: number | null;
  /** 0..1 position of the target/threshold marker on the bar; null = no marker. */
  marker: number | null;
  /** Monospace value, e.g. "4/15", "51%", "≥ 95%", "18 closed". */
  value: string;
  /** Short note after the value, e.g. "11 more", "+39 pts", "✓ met", "prior only". */
  note: string;
  met: boolean;
  /** Colour of the note (and bar): green when met, danger below the demotion line, muted otherwise. */
  tone: "met" | "muted" | "danger";
}

export interface LadderBox {
  rung: "PROBATION" | "FULL";
  rows: LadderReqRow[];
  /** What the rung means (RUNG_INFO[rung].meaning), shown under the rows. Null for the FULL hold box,
   *  where the current-stage line above already carries it. */
  footer: string | null;
}

export interface LadderView {
  /** Null for a missing or unknown status. */
  stage: LadderStage | null;
  /** The stage name, or "—" when unknown. */
  label: string;
  frozen: boolean;
  /** True when a `promotion` payload was supplied (the sleeve is on the ladder and the caller has its scorecard). */
  hasProgress: boolean;
  /** No closed trades yet: P is the skeptical prior and is never drawn as progress. */
  priorOnly: boolean;
  /** Middle ring: min(P / the next rung's threshold, 1); 0 while prior-only. */
  pFill: number;
  /** Inner ring: min(closed trades / required, 1). */
  tradesFill: number;
  /** Outer ring: the rung itself — FROZEN/unknown 0, SHADOW ⅓, PROBATION ⅔, FULL 1. */
  stageFill: number;
  chips: { rung: LadderRung; state: LadderChipState }[];
  /** Fill of the SHADOW→PROBATION and PROBATION→FULL connectors. */
  connectors: [number, number];
  /** Gate captions under the connectors, e.g. "P ≥ 90%"; null without promotion data. */
  gateLabels: [string | null, string | null];
  /** "To reach <rung>" box (SHADOW, PROBATION). */
  nextGate: LadderBox | null;
  /** Greyed "Then FULL" preview (SHADOW only). */
  thenFull: LadderBox | null;
  /** "Holding FULL" box: P against the demotion line (FULL only). */
  hold: LadderBox | null;
  /** Demotion line for the legend; null without promotion data. */
  demoteThreshold: number | null;
  /** promotionProgress's one-sentence verdict (for the trigger's title / screen readers). */
  verdict: string | null;
}

export interface LadderInputs extends Partial<PromotionInputs> {
  ladder_status: string | null | undefined;
}

const LADDER_RUNGS: LadderRung[] = ["SHADOW", "PROBATION", "FULL"];
const STAGES: LadderStage[] = ["SHADOW", "PROBATION", "FULL", "FROZEN"];

const pts = (from: number, to: number): string => `+${Math.max(1, Math.round((to - from) * 100))} pts`;

/** Everything LadderBadge renders — ring fills, stepper, gate boxes, legend — from one sleeve row. */
export function ladderView(s: LadderInputs): LadderView {
  const stage = STAGES.includes(s.ladder_status as LadderStage) ? (s.ladder_status as LadderStage) : null;
  const frozen = stage === "FROZEN";
  const promotion = stage && !frozen ? (s.promotion ?? null) : null;
  const rungs = promotion?.rungs ?? [];
  const rungOf = (r: "PROBATION" | "FULL") => rungs.find((x) => x.rung === r) ?? null;

  const n = s.n_closed ?? 0;
  const p = s.p_positive ?? null;
  const evaluated = s.scorecard_computed_at != null;
  const priorOnly = !hasClosedEvidence({ n_closed: n });
  const evidenceP = priorOnly ? null : p;

  // Chip states follow the ladder order; FROZEN / unknown sits off the ladder, so nothing is current.
  const idx = stage && !frozen ? LADDER_RUNGS.indexOf(stage as LadderRung) : -1;
  const chips = LADDER_RUNGS.map((rung, i) => ({
    rung,
    state: (idx < 0 ? "later" : i === idx ? "current" : i < idx ? "past" : i === idx + 1 ? "next" : "later") as LadderChipState,
  }));

  const gateLabels: [string | null, string | null] = [rungOf("PROBATION"), rungOf("FULL")].map((r) =>
    r ? `P ≥ ${fmtPct(r.p_threshold)}` : null
  ) as [string | null, string | null];

  // The ring target: the next rung's threshold, or FULL's own entry gate while holding FULL.
  const target = promotion ? (promotion.p_threshold ?? rungOf("FULL")?.p_threshold ?? null) : null;
  const nMin = promotion?.n_min ?? null;
  const tradesFill = nMin ? clamp01(n / nMin) : 0;
  const pFill = evidenceP != null && target ? clamp01(evidenceP / target) : 0;
  const gate = Math.min(tradesFill, pFill);

  // Connectors already passed are full; the one into the next rung shows the binding gate.
  const connectors = [0, 1].map((i) => (idx < 0 ? 0 : i < idx ? 1 : i === idx && promotion ? gate : 0)) as [number, number];

  let nextGate: LadderBox | null = null;
  let thenFull: LadderBox | null = null;
  let hold: LadderBox | null = null;

  if (promotion && promotion.next_rung && promotion.p_threshold != null) {
    const thr = promotion.p_threshold;
    const tradesMet = n >= promotion.n_min;
    const confMet = evidenceP != null && evidenceP >= thr;
    nextGate = {
      rung: promotion.next_rung,
      footer: RUNG_INFO[promotion.next_rung].meaning,
      rows: [
        {
          id: "trades",
          label: "Closed trades",
          fill: tradesFill,
          marker: null,
          value: `${evaluated ? n : "–"}/${promotion.n_min}`,
          note: tradesMet ? "✓ met" : `${promotion.n_min - n} more`,
          met: tradesMet,
          tone: tradesMet ? "met" : "muted",
        },
        {
          id: "confidence",
          label: "P(edge>0)",
          fill: evidenceP == null ? 0 : clamp01(evidenceP),
          marker: thr,
          value: evidenceP == null ? "–" : fmtPct(evidenceP),
          note: confMet ? "✓ met" : evidenceP == null ? "prior only" : pts(evidenceP, thr),
          met: confMet,
          tone: confMet ? "met" : "muted",
        },
      ],
    };
    const full = rungOf("FULL");
    if (stage === "SHADOW" && full) {
      const preview = { note: "", met: false, tone: "muted" as const };
      thenFull = {
        rung: "FULL",
        footer: RUNG_INFO.FULL.meaning,
        rows: [
          { id: "trades", label: "Closed trades", fill: 0, marker: null, value: `≥ ${full.n_min}`, ...preview },
          { id: "confidence", label: "P(edge>0)", fill: 0, marker: full.p_threshold, value: `≥ ${fmtPct(full.p_threshold)}`, ...preview },
        ],
      };
    }
  } else if (promotion && stage === "FULL" && promotion.demote_threshold != null) {
    const line = promotion.demote_threshold;
    const above = evidenceP != null && evidenceP >= line;
    hold = {
      rung: "FULL",
      footer: null,
      rows: [
        {
          id: "confidence",
          label: "P(edge>0)",
          fill: evidenceP == null ? 0 : clamp01(evidenceP),
          marker: line,
          value: evidenceP == null ? "–" : fmtPct(evidenceP),
          note: evidenceP == null ? "prior only" : above ? `✓ above ${fmtPct(line)}` : `below ${fmtPct(line)}`,
          met: above,
          tone: above ? "met" : evidenceP == null ? "muted" : "danger",
        },
        { id: "trades", label: "Closed trades", fill: null, marker: null, value: `${evaluated ? n : "–"} closed`, note: "", met: false, tone: "muted" },
      ],
    };
  }

  const demoteThreshold = promotion ? (promotion.demote_threshold ?? rungs[0]?.demote_threshold ?? null) : null;
  const verdict = promotion ? (promotionProgress({ n_closed: s.n_closed, p_positive: s.p_positive, scorecard_computed_at: s.scorecard_computed_at, promotion })?.verdict ?? null) : null;

  return {
    stage,
    label: stage ?? "—",
    frozen,
    hasProgress: promotion != null,
    priorOnly,
    pFill,
    tradesFill,
    stageFill: stage === "SHADOW" ? 1 / 3 : stage === "PROBATION" ? 2 / 3 : stage === "FULL" ? 1 : 0,
    chips,
    connectors,
    gateLabels,
    nextGate,
    thenFull,
    hold,
    demoteThreshold,
    verdict,
  };
}
