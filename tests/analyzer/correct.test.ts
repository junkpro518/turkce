import { describe, expect, it } from "vitest";
import { analyzeMessage } from "../../lib/analyzer/correct";
import { filterOvercorrections } from "../../lib/analyzer/overcorrection";
import type { AnalysisError } from "../../lib/ai/schemas";

const KNOWN = new Set(["locative-da", "present-continuous-iyor"]);
// Fake morphology: only these forms are "valid".
const VALID = new Set(["okula", "gidiyorum", "Okula gidiyorum.", "ev", "Evdeyim."]);
const fakeIsValid = (s: string) => s.split(/\s+/).every((t) => VALID.has(t) || VALID.has(s));

function good() {
  return {
    errors: [
      { original: "okul", correction: "okula", grammarPoint: "locative-da", explanation: "why", severity: "medium" },
    ],
    newVocab: [{ word: "ev", translation: "house", example: "Evdeyim.", pos: "noun" }],
    masterySignals: [{ grammarPoint: "locative-da", correct: false }],
  };
}

describe("analyzeMessage", () => {
  it("returns a clean valid result unchanged", async () => {
    const r = await analyzeMessage({
      generate: async () => good(),
      knownKeys: KNOWN,
      isValidText: fakeIsValid,
    });
    expect(r.errors).toHaveLength(1);
    expect(r.newVocab).toHaveLength(1);
    expect(r.masterySignals).toHaveLength(1);
  });

  it("drops a morphologically-invalid correction", async () => {
    const bad = good();
    bad.errors[0]!.correction = "okulaa"; // not in VALID
    const r = await analyzeMessage({ generate: async () => bad, knownKeys: KNOWN, isValidText: fakeIsValid });
    expect(r.errors).toHaveLength(0);
  });

  it("tolerates an unknown grammarPoint (keeps it)", async () => {
    const g = good();
    g.errors[0]!.grammarPoint = "not-a-real-key";
    const r = await analyzeMessage({ generate: async () => g, knownKeys: KNOWN, isValidText: fakeIsValid });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.grammarPoint).toBe("not-a-real-key");
  });

  it("returns empty when the LLM call throws", async () => {
    const r = await analyzeMessage({
      generate: async () => {
        throw new Error("network");
      },
      knownKeys: KNOWN,
      isValidText: fakeIsValid,
    });
    expect(r.errors).toHaveLength(0);
    expect(r.newVocab).toHaveLength(0);
  });

  it("returns empty when the output fails schema validation", async () => {
    const r = await analyzeMessage({
      generate: async () => ({ errors: "nope" }),
      knownKeys: KNOWN,
      isValidText: fakeIsValid,
    });
    expect(r.errors).toHaveLength(0);
  });
});

describe("filterOvercorrections", () => {
  const err: AnalysisError = {
    original: "x",
    correction: "y",
    grammarPoint: "locative-da",
    explanation: "z",
    severity: "low",
  };

  it("keeps corrections whose original was actually wrong", async () => {
    const kept = await filterOvercorrections([err], async () => ({
      originalWasCorrect: false,
      confidence: "high",
      note: "",
    }));
    expect(kept).toHaveLength(1);
  });

  it("drops overcorrections (original was correct)", async () => {
    const kept = await filterOvercorrections([err], async () => ({
      originalWasCorrect: true,
      confidence: "high",
      note: "",
    }));
    expect(kept).toHaveLength(0);
  });

  it("is conservative when the verdict call fails (drops)", async () => {
    const kept = await filterOvercorrections([err], async () => {
      throw new Error("verdict down");
    });
    expect(kept).toHaveLength(0);
  });
});
