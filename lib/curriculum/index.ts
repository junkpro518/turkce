import { CEFR_LEVELS } from "../config/constants";
import type { MasteryStatus } from "../mastery";
import type { CurriculumNode } from "./types";

export type { CurriculumNode } from "./types";

export interface GoalRef {
  id: string;
  priority: number;
  status: "active" | "paused" | "done";
  /** Curriculum node keys this goal favors. */
  relatedKeys?: string[];
}

/**
 * Pure next-focus selection (FR-015): from nodes whose prerequisites are all mastered and which
 * aren't mastered yet, prefer (1) nodes serving the highest-priority active goal, then (2) lower
 * CEFR level, then (3) required before borderline. Stable order otherwise (V8 Array.sort is
 * stable). Returns null when nothing is selectable (all mastered or blocked).
 */
export function selectNextFocus(
  nodes: CurriculumNode[],
  masteryByKey: Map<string, MasteryStatus>,
  activeGoals: GoalRef[] = [],
): CurriculumNode | null {
  const isMastered = (key: string) => masteryByKey.get(key) === "mastered";

  const candidates = nodes.filter(
    (n) => !isMastered(n.key) && n.prerequisites.every(isMastered),
  );
  if (candidates.length === 0) return null;

  const goalKeys = new Set(
    activeGoals
      .filter((g) => g.status === "active")
      .sort((a, b) => a.priority - b.priority)
      .flatMap((g) => g.relatedKeys ?? []),
  );

  const levelRank = (level: string) => CEFR_LEVELS.indexOf(level as never);

  const sorted = [...candidates].sort((a, b) => {
    const ga = goalKeys.has(a.key) ? 0 : 1;
    const gb = goalKeys.has(b.key) ? 0 : 1;
    if (ga !== gb) return ga - gb;
    const la = levelRank(a.level);
    const lb = levelRank(b.level);
    if (la !== lb) return la - lb;
    const ra = a.required && !a.borderline ? 0 : 1;
    const rb = b.required && !b.borderline ? 0 : 1;
    return ra - rb;
  });

  return sorted[0] ?? null;
}
