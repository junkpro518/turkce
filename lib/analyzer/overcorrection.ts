import { logError } from "../config/logger";
import type { AnalysisError, OvercorrectionVerdict } from "../ai/schemas";

// T028: anti-overcorrection pass (FR-009). Each proposed correction is checked; only those whose
// original was actually wrong survive. Failure is conservative — drop the correction (overcorrecting
// is worse than missing).

export type VerdictFn = (e: AnalysisError) => Promise<OvercorrectionVerdict>;

export async function filterOvercorrections(
  errors: AnalysisError[],
  verdict: VerdictFn,
): Promise<AnalysisError[]> {
  const kept: AnalysisError[] = [];
  for (const e of errors) {
    let v: OvercorrectionVerdict;
    try {
      v = await verdict(e);
    } catch (err) {
      logError("analyzer.overcorrection", err);
      v = { originalWasCorrect: true, confidence: "low", note: "verdict failed; conservative drop" };
    }
    if (!v.originalWasCorrect) kept.push(e);
  }
  return kept;
}
