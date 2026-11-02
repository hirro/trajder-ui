/**
 * Client-side sort comparator for the Sleeves table (#Sleeves.svelte).
 *
 * Pure and DOM-free so it's unit-testable in isolation — see Trajder's design doc
 * docs/superpowers/specs/2026-08-07-sleeves-sortable-columns-design.md.
 *
 * Numeric metric columns (weeks, p_positive, calib_slope) must sort by the SAME
 * underlying value the display accessors in sleeveFormat.ts use, and treat as "missing"
 * exactly what those accessors render as "–" / "N/A" — never re-derive from formatted text.
 */
import type { TradeWindow, TradeWindowKey } from "./types";
import { weeklyTotal } from "./sleeveFormat";

export type SleeveSortColumn = "sleeve" | "ladder" | "intervals" | "closed" | "weeks" | "p_positive" | "fill_ratio" | "calib_slope" | "open" | "book";

export type SortDirection = "asc" | "desc";

/** The subset of Sleeves.svelte's row fields (SleeveListItem) that sorting reads. */
export interface SleeveSortRow {
  sleeve_id: string;
  display_name: string;
  ladder_status: string;
  alpha_interval: string;
  n_closed: number | null;
  p_positive: number | null;
  fill_ratio: number | null;
  calibration_slope: number | null;
  open_positions: number;
  trade_windows?: Partial<Record<TradeWindowKey, TradeWindow>> | null;
  /** The sleeve's result in kronor, realized plus open (computed by the page). */
  result?: number | null;
}

// Rung rank, descending-best. Unknown rungs (should not happen, but the type is widened by API
// JSON) rank below FROZEN so they surface first ascending / last descending.
const LADDER_RANK: Record<string, number> = { FULL: 3, PROBATION: 2, SHADOW: 1, FROZEN: 0 };
const ladderRank = (status: string): number => LADDER_RANK[status] ?? -1;

// Duration order. Unknown intervals sort last in both directions (handled via null below).
const INTERVAL_RANK: Record<string, number> = { "1m": 0, "5m": 1, "15m": 2, "1h": 3, "4h": 4, "1d": 5 };
const intervalRank = (interval: string): number | null => (interval in INTERVAL_RANK ? INTERVAL_RANK[interval] : null);


/** Comparable value per column; null means "missing" and always sorts last. */
function sortValue(r: SleeveSortRow, column: SleeveSortColumn): number | string | null {
  switch (column) {
    case "sleeve":
      return r.display_name.toLowerCase();
    case "ladder":
      return ladderRank(r.ladder_status);
    case "intervals":
      return intervalRank(r.alpha_interval);
    case "closed":
      return r.n_closed;
    case "weeks":
      // The 4-week total shown beside the bars; "N/A" (no trade in any week) is missing.
      return weeklyTotal(r.trade_windows);
    case "p_positive":
      return r.p_positive;
    case "fill_ratio":
      return r.fill_ratio;
    case "calib_slope":
      return r.calibration_slope;
    case "open":
      return r.open_positions;
    case "book":
      return r.result ?? null;
  }
}

// Ties on a column are broken by these columns, in order and in the same direction.
// Ladder: rung, then P(edge>0), then closed trades.
const TIE_BREAKERS: Partial<Record<SleeveSortColumn, SleeveSortColumn[]>> = { ladder: ["p_positive", "closed"] };

/** Compares one column; missing values (null) sort last in both directions. */
function compareColumn(a: SleeveSortRow, b: SleeveSortRow, column: SleeveSortColumn, sign: number): number {
  const va = sortValue(a, column);
  const vb = sortValue(b, column);
  if (va === null && vb === null) return 0;
  if (va === null) return 1; // missing always last
  if (vb === null) return -1;
  if (va < vb) return -1 * sign;
  if (va > vb) return 1 * sign;
  return 0;
}

/** Returns a new sorted array; never mutates `sleeves`. Missing values (null) sort last in both directions. */
export function sortSleeves<T extends SleeveSortRow>(sleeves: T[], column: SleeveSortColumn, direction: SortDirection): T[] {
  const sign = direction === "asc" ? 1 : -1;
  const columns = [column, ...(TIE_BREAKERS[column] ?? [])];
  return [...sleeves].sort((a, b) => {
    for (const c of columns) {
      const result = compareColumn(a, b, c, sign);
      if (result !== 0) return result;
    }
    return 0;
  });
}
