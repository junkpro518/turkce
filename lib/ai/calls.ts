import { generateObject } from "ai";
import { analyzerModel, TEMPERATURE } from "./provider";
import {
  AnalysisResultSchema,
  OvercorrectionVerdictSchema,
  type AnalysisError,
  type OvercorrectionVerdict,
} from "./schemas";

// Live OpenRouter bindings for the critical analyzer path (strong model, low temperature, Zod).
// Not unit-tested (requires the network); exercised via the eval harness and live use.

const ANALYZER_SYSTEM = `You are a precise Turkish grammar analyzer for an Arabic-speaking A1–A2 learner.
Analyze ONLY the learner's message. Use a real Turkish grammatical taxonomy (vowel harmony, case
suffixes, possessives, tense/conjugation, word order, negation, question formation, plurals,
connectors). Make MINIMAL edits — do not rewrite correct sentences. For each genuine error give the
corrected form, the specific grammar point, and an explanation (in Arabic) of WHY. Also capture
genuinely new vocabulary and per-grammar-point mastery signals. If the message is already correct,
return empty arrays.`;

const OVERCORRECTION_SYSTEM = `You verify a proposed Turkish correction. Decide whether the learner's
ORIGINAL was already grammatically correct (i.e. the correction would be an overcorrection). Be
conservative: if unsure, say the original was correct.`;

export async function generateAnalysisRaw(userText: string): Promise<unknown> {
  const { object } = await generateObject({
    model: analyzerModel(),
    schema: AnalysisResultSchema,
    temperature: TEMPERATURE.analyzer,
    system: ANALYZER_SYSTEM,
    prompt: userText,
  });
  return object;
}

export async function generateOvercorrectionVerdict(
  e: AnalysisError,
): Promise<OvercorrectionVerdict> {
  const { object } = await generateObject({
    model: analyzerModel(),
    schema: OvercorrectionVerdictSchema,
    temperature: TEMPERATURE.analyzer,
    system: OVERCORRECTION_SYSTEM,
    prompt: `Original: ${e.original}\nProposed correction: ${e.correction}\nWas the original already correct?`,
  });
  return object;
}
