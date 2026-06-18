import { generateObject } from "ai";
import { TEMPERATURE, teacherFallbackModel, teacherModel } from "../ai/provider";
import { buildTeacherSystem } from "../ai/prompts";
import { TeacherDecisionSchema, type QuizPayload, type TeacherDecision } from "../ai/schemas";
import { logError, logWarn } from "../config/logger";

// T032 (revised for FR-002): the teacher makes a STRUCTURED judgment per turn — it decides the
// interaction mode and, when it chooses to quiz, emits a structured quiz. This trades token-level
// streaming for reliable mode/quiz judgment; the client still shows a typing indicator and splits
// long replies (FR-004 reduced to typing + full message for the structured path).
//
// The system prompt is built per learner (level + language mix) — Arabic-dominant, see ai/prompts.

export interface TeacherMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DecideDeps {
  /** Bound LLM call returning the raw decision object (or throwing). */
  generate: () => Promise<unknown>;
}

/**
 * Parse + validate the teacher's structured decision. Returns null on a failed/invalid call so the
 * caller can show a friendly fallback. A quiz with an out-of-range correctIndex is dropped and the
 * mode downgraded to "discuss" — the turn is not lost.
 */
export async function decideTurn(deps: DecideDeps): Promise<TeacherDecision | null> {
  let raw: unknown;
  try {
    raw = await deps.generate();
  } catch (err) {
    logError("teacher.generate", err);
    return null;
  }

  const parsed = TeacherDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("teacher.parse", "schema mismatch", { issues: parsed.error.issues.length });
    return null;
  }
  const d = parsed.data;

  let quiz: QuizPayload | null = null;
  if (d.quiz) {
    if (d.quiz.correctIndex < d.quiz.choices.length) {
      quiz = d.quiz;
    } else {
      logWarn("teacher.quiz", "invalid quiz dropped (correctIndex out of range)");
    }
  }
  const mode = d.mode === "quiz" && !quiz ? "discuss" : d.mode;

  return { mode, reply: d.reply, quiz };
}

/**
 * Live binding: structured teacher decision via the fast model, with backup-model fallback. The
 * `system` prompt is built per learner (Arabic-dominant, level-scaled) by the caller via
 * buildTeacherSystem; defaults to an A1 / arabic_heavy prompt.
 */
export async function generateTeacherDecisionRaw(
  messages: TeacherMessage[],
  system: string = buildTeacherSystem("A1", "arabic_heavy"),
): Promise<unknown> {
  const call = async (model: ReturnType<typeof teacherModel>) => {
    const { object } = await generateObject({
      model,
      schema: TeacherDecisionSchema,
      temperature: TEMPERATURE.teacher,
      system,
      messages,
    });
    return object;
  };
  try {
    return await call(teacherModel());
  } catch (err) {
    logError("teacher.primary", err);
    return await call(teacherFallbackModel());
  }
}
