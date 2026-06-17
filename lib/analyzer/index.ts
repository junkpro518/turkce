import { A1_KEYS } from "../../data/curriculum/keys";
import { generateAnalysisRaw, generateOvercorrectionVerdict } from "../ai/calls";
import type { AnalyzerPort } from "../orchestrator/ports";
import { analyzeMessage } from "./correct";
import { filterOvercorrections } from "./overcorrection";

// Real analyzer: deep correction (strong model) → morphology gate / key tolerance → anti-
// overcorrection pass. Composition of the unit-tested pieces with the live LLM bindings.

const KNOWN_KEYS: ReadonlySet<string> = new Set(A1_KEYS.map((n) => n.key));

export const realAnalyzer: AnalyzerPort = async ({ text }) => {
  const result = await analyzeMessage({
    generate: () => generateAnalysisRaw(text),
    knownKeys: KNOWN_KEYS,
  });
  const errors = await filterOvercorrections(result.errors, generateOvercorrectionVerdict);
  return { ...result, errors };
};
