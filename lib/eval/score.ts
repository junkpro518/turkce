// Pure TypeScript F0.5 scorer over edit spans + overcorrection rate, per docs/09 Q3 / FR-030.
// No Python / M2 / ERRANT. F0.5 weights precision 2x (overcorrecting is worse than missing).

export interface Edit {
  start: number;
  end: number;
  replacement: string;
}

export interface EvalCase {
  /** Gold-standard edits (empty for a correct sentence). */
  gold: Edit[];
  /** Predicted edits from the analyzer. */
  pred: Edit[];
  /** True if the source sentence is grammatically correct (no gold edits expected). */
  isCorrectSentence: boolean;
}

export interface EvalScore {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f05: number;
  /** Fraction of correct sentences for which any edit was (wrongly) proposed. */
  overcorrectionRate: number;
}

function editKey(e: Edit): string {
  return `${e.start}:${e.end}:${e.replacement}`;
}

export function scoreCases(cases: EvalCase[]): EvalScore {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let correctSentences = 0;
  let overcorrected = 0;

  for (const c of cases) {
    const goldSet = new Set(c.gold.map(editKey));
    const predSet = new Set(c.pred.map(editKey));
    for (const k of predSet) {
      if (goldSet.has(k)) tp++;
      else fp++;
    }
    for (const k of goldSet) {
      if (!predSet.has(k)) fn++;
    }
    if (c.isCorrectSentence) {
      correctSentences++;
      if (c.pred.length > 0) overcorrected++;
    }
  }

  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const beta2 = 0.25; // beta = 0.5 -> beta^2 = 0.25
  const denom = beta2 * precision + recall;
  const f05 = denom === 0 ? 0 : ((1 + beta2) * precision * recall) / denom;
  const overcorrectionRate = correctSentences === 0 ? 0 : overcorrected / correctSentences;

  return { tp, fp, fn, precision, recall, f05, overcorrectionRate };
}
