import { MASTERY, CEFR } from "../config/constants";
import type { CefrLevel } from "../config/constants";

// Deterministic grammar-mastery math (docs/09 Q4). Pure functions, Vitest-locked.

export type MasteryStatus = "new" | "learning" | "mastered";

export interface MasteryState {
  /** EWMA score in [0,1]. */
  score: number;
  /** Count of correct-usage evidences. */
  evidenceCount: number;
  /** Distinct sessions in which evidence was seen (luck guard). */
  sessionsSeen: number;
  status: MasteryStatus;
}

export interface MasteryInput {
  correct: boolean;
  /** True on the first evidence within a new session (increments sessionsSeen). */
  newSession: boolean;
}

type MasteryConfig = typeof MASTERY;

export function initialMastery(): MasteryState {
  return { score: 0, evidenceCount: 0, sessionsSeen: 0, status: "new" };
}

export function updateMastery(
  prev: MasteryState,
  input: MasteryInput,
  cfg: MasteryConfig = MASTERY,
): MasteryState {
  const result = input.correct ? 1 : 0;
  // Seed the score on the very first observation; EWMA thereafter.
  const isFirst = prev.status === "new" && prev.evidenceCount === 0 && prev.score === 0;
  const score = isFirst ? result : cfg.alpha * result + (1 - cfg.alpha) * prev.score;
  const evidenceCount = prev.evidenceCount + (input.correct ? 1 : 0);
  const sessionsSeen = prev.sessionsSeen + (input.newSession ? 1 : 0);
  const status = nextStatus(prev.status, { score, evidenceCount, sessionsSeen }, cfg);
  return { score, evidenceCount, sessionsSeen, status };
}

function nextStatus(
  prevStatus: MasteryStatus,
  s: { score: number; evidenceCount: number; sessionsSeen: number },
  cfg: MasteryConfig,
): MasteryStatus {
  if (prevStatus === "mastered") {
    // Demotion is hard: only when the score falls below demoteScore.
    return s.score < cfg.demoteScore ? "learning" : "mastered";
  }
  const meetsMastery =
    s.score >= cfg.masteredScore &&
    s.evidenceCount >= cfg.minEvidence &&
    s.sessionsSeen >= cfg.minSessions;
  return meetsMastery ? "mastered" : "learning";
}

export interface LevelMasteryStat {
  level: CefrLevel;
  requiredTotal: number;
  requiredMastered: number;
}

/**
 * Per-skill CEFR derivation: climb levels while each level's required-node mastery meets the
 * promotion ratio; return the level currently being worked on. Never jumps from one message
 * (FR-013) because it reads accumulated mastery, not a single result. `stats` must be ordered
 * low→high.
 */
export function deriveCefr(stats: LevelMasteryStat[], cfg: typeof CEFR = CEFR): CefrLevel {
  if (stats.length === 0) return "A1";
  let idx = 0;
  for (; idx < stats.length; idx++) {
    const s = stats[idx]!;
    const ratio = s.requiredTotal === 0 ? 1 : s.requiredMastered / s.requiredTotal;
    if (ratio < cfg.promotionRatio) break;
  }
  const clamped = Math.min(idx, stats.length - 1);
  return stats[clamped]!.level;
}
