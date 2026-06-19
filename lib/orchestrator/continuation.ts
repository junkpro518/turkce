import { buildTeacherSystem } from "../ai/prompts";
import type { QuizPayload, TeacherDecision } from "../ai/schemas";
import { buildContinuationContext } from "./continuation-context";
import { decideTurn, generateTeacherDecisionRaw } from "./teacher";

// 002 T014 (US1): produce ONE next-step turn after a quiz answer, reusing the existing structured
// teacher (Arabic, level-scaled). Exactly one teacher call; never recurses (no self-talk loop —
// FR-003). Returns null on failure so the caller shows a short friendly message (the reveal was
// already delivered).

export interface ContinuationOpts {
  level: string;
  languageMix: string;
  /** Injectable LLM call for tests; defaults to the live structured teacher. */
  generate?: () => Promise<unknown>;
}

export async function continueAfterQuiz(
  quiz: QuizPayload,
  chosenIndex: number,
  correct: boolean,
  opts: ContinuationOpts,
): Promise<TeacherDecision | null> {
  const messages = buildContinuationContext(quiz, chosenIndex, correct);
  const system = buildTeacherSystem(opts.level, opts.languageMix);
  const generate = opts.generate ?? (() => generateTeacherDecisionRaw(messages, system));
  return decideTurn({ generate });
}
