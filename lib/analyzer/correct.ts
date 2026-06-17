import { logError, logWarn } from "../config/logger";
import { AnalysisResultSchema, EMPTY_ANALYSIS, type AnalysisResult } from "../ai/schemas";
import { isValidText as defaultIsValidText } from "../morphology";

// T027: deep-correction analyzer orchestration. The LLM call is injected (`generate`) so this is
// unit-testable offline. Post-parse: Zod validation (empty fallback on mismatch), morphology gate
// on Turkish forms, and unknown-grammarPoint tolerance (fix I1: kept + logged, not hard-failed).

export interface AnalyzeDeps {
  /** Bound LLM call returning the raw analysis object (or throwing). */
  generate: () => Promise<unknown>;
  /** Known curriculum node keys (the taxonomy). */
  knownKeys: ReadonlySet<string>;
  /** Morphology validator (injectable for tests). */
  isValidText?: (s: string) => boolean;
}

export async function analyzeMessage(deps: AnalyzeDeps): Promise<AnalysisResult> {
  const isValid = deps.isValidText ?? defaultIsValidText;

  let raw: unknown;
  try {
    raw = await deps.generate();
  } catch (err) {
    logError("analyzer.generate", err);
    return EMPTY_ANALYSIS;
  }

  const parsed = AnalysisResultSchema.safeParse(raw);
  if (!parsed.success) {
    logWarn("analyzer.parse", "schema mismatch; using empty fallback", {
      issues: parsed.error.issues.length,
    });
    return EMPTY_ANALYSIS;
  }
  const data = parsed.data;

  const errors = data.errors.filter((e) => {
    if (!isValid(e.correction)) {
      logWarn("analyzer.morphology", "dropped morphologically-invalid correction", {
        correction: e.correction,
      });
      return false;
    }
    if (!deps.knownKeys.has(e.grammarPoint)) {
      // fix I1: tolerate an unknown key during the partial-taxonomy window — keep it, log it.
      logWarn("analyzer.key", "unknown grammarPoint (kept)", { grammarPoint: e.grammarPoint });
    }
    return true;
  });

  const newVocab = data.newVocab.filter((v) => isValid(v.word) && isValid(v.example));

  return { errors, newVocab, masterySignals: data.masterySignals };
}
