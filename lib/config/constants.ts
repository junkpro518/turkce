// Tunable constants for the deterministic engine (docs/09 Q4). All values are calibration
// targets — adjust against real data later; they are locked by Vitest scenarios.

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export const CEFR_LEVELS: readonly CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export const MASTERY = {
  /** EWMA recency weight: score = alpha*result + (1-alpha)*score. */
  alpha: 0.3,
  /** Minimum score to be eligible for "mastered". */
  masteredScore: 0.8,
  /**
   * Demotion threshold. Deliberately 0.5 (not 0.6): with alpha=0.3 this guarantees a single
   * error never demotes a mastered point (0.8 -> 0.56 stays mastered; demotion needs >=2 errors),
   * satisfying FR-012 "demotion harder than promotion / no single-error demotion".
   */
  demoteScore: 0.5,
  /** Correct-usage evidences required for mastery. */
  minEvidence: 5,
  /** Distinct sessions the evidence must span (prevents luck). */
  minSessions: 2,
} as const;

export const CEFR = {
  /** Fraction of a level's required nodes that must be mastered to move past it. */
  promotionRatio: 0.8,
} as const;

export const SESSION = {
  /** A session closes after this many minutes of inactivity (FR-031). */
  idleTimeoutMin: 30,
} as const;
