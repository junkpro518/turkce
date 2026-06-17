import { describe, expect, it } from "vitest";
import { scoreCases, type EvalCase } from "../../lib/eval/score";

const e = (start: number, end: number, replacement: string) => ({ start, end, replacement });

describe("scoreCases", () => {
  it("perfect prediction → precision/recall/F0.5 = 1, no overcorrection", () => {
    const cases: EvalCase[] = [
      { gold: [e(0, 3, "okula")], pred: [e(0, 3, "okula")], isCorrectSentence: false },
      { gold: [], pred: [], isCorrectSentence: true },
    ];
    const s = scoreCases(cases);
    expect(s.precision).toBe(1);
    expect(s.recall).toBe(1);
    expect(s.f05).toBe(1);
    expect(s.overcorrectionRate).toBe(0);
  });

  it("weights precision over recall (F0.5)", () => {
    // 1 TP, 1 FP, 0 FN: precision 0.5, recall 1.0 → F0.5 < F1 (0.667)
    const cases: EvalCase[] = [
      { gold: [e(0, 3, "okula")], pred: [e(0, 3, "okula"), e(5, 8, "evde")], isCorrectSentence: false },
    ];
    const s = scoreCases(cases);
    expect(s.precision).toBeCloseTo(0.5, 5);
    expect(s.recall).toBe(1);
    // F0.5 = 1.25*0.5*1 / (0.25*0.5 + 1) = 0.625 / 1.125 ≈ 0.5556
    expect(s.f05).toBeCloseTo(0.5556, 3);
    expect(s.f05).toBeLessThan(0.667); // strictly below F1
  });

  it("counts overcorrection on correct sentences", () => {
    const cases: EvalCase[] = [
      { gold: [], pred: [e(0, 2, "ben")], isCorrectSentence: true },
      { gold: [], pred: [], isCorrectSentence: true },
    ];
    const s = scoreCases(cases);
    expect(s.overcorrectionRate).toBe(0.5);
    expect(s.fp).toBe(1);
  });

  it("counts misses as false negatives", () => {
    const cases: EvalCase[] = [
      { gold: [e(0, 3, "okula")], pred: [], isCorrectSentence: false },
    ];
    const s = scoreCases(cases);
    expect(s.fn).toBe(1);
    expect(s.recall).toBe(0);
  });
});
