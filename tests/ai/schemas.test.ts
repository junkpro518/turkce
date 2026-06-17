import { describe, expect, it } from "vitest";
import {
  AnalysisResultSchema,
  OvercorrectionVerdictSchema,
  QuizPayloadSchema,
} from "../../lib/ai/schemas";

describe("AI schemas", () => {
  it("accepts a well-formed analysis result", () => {
    const r = AnalysisResultSchema.safeParse({
      errors: [
        { original: "okul", correction: "okula", grammarPoint: "locative-da", explanation: "...", severity: "medium" },
      ],
      newVocab: [{ word: "okul", translation: "school", example: "Okula gidiyorum.", pos: "noun" }],
      masterySignals: [{ grammarPoint: "locative-da", correct: false }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects an analysis result with a bad severity", () => {
    const r = AnalysisResultSchema.safeParse({
      errors: [{ original: "a", correction: "b", grammarPoint: "x", explanation: "y", severity: "fatal" }],
      newVocab: [],
      masterySignals: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a quiz whose correctIndex is out of range", () => {
    const r = QuizPayloadSchema.safeParse({
      question: "?",
      choices: ["a", "b"],
      correctIndex: 2,
      explanation: "...",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a valid quiz", () => {
    const r = QuizPayloadSchema.safeParse({
      question: "?",
      choices: ["a", "b", "c"],
      correctIndex: 1,
      explanation: "...",
    });
    expect(r.success).toBe(true);
  });

  it("validates an overcorrection verdict", () => {
    expect(
      OvercorrectionVerdictSchema.safeParse({ originalWasCorrect: true, confidence: "high", note: "ok" }).success,
    ).toBe(true);
  });
});
