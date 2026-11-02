/** The payload shapes the shared helpers read. Each app's API types must stay assignable to these. */
export type TradeWindowKey = "w0" | "w1" | "w2" | "w3";

export interface TradeWindow {
  n: number;
  total_bps: number | null;
  /** ISO date of the block's first STO trading day (from 00:00 Europe/Stockholm); absent on an older backend. */
  since?: string | null;
  /** ISO date of the block's last STO trading day; absent on an older backend. */
  until?: string | null;
}

export interface SleevePromotion {
  next_rung: "PROBATION" | "FULL" | null;
  p_threshold: number | null;
  n_min: number;
  demote_threshold: number | null;
  /** Every promotable rung (PROBATION, FULL), whatever rung this sleeve is on — drives the ladder card's stepper. */
  rungs: SleevePromotionRung[];
}

export interface SleevePromotionRung {
  rung: "PROBATION" | "FULL";
  p_threshold: number;
  n_min: number;
  demote_threshold: number;
}
