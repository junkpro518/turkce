import { generateObject } from "ai";
import { analyzerModel, TEMPERATURE } from "./provider";
import { ANALYZER_SYSTEM, OVERCORRECTION_SYSTEM } from "./prompts";
import {
  AnalysisResultSchema,
  OvercorrectionVerdictSchema,
  type AnalysisError,
  type OvercorrectionVerdict,
} from "./schemas";

// Live OpenRouter bindings for the critical analyzer path (strong model, low temperature, Zod).
// Not unit-tested (requires the network); exercised via the eval harness and live use.

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
