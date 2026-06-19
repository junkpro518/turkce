import { describe, expect, it, vi } from "vitest";
import { continueAfterQuiz } from "../../lib/orchestrator/continuation";
import type { QuizPayload } from "../../lib/ai/schemas";

const quiz: QuizPayload = {
  question: "Ben ___ gidiyorum.",
  choices: ["okul", "okula"],
  correctIndex: 1,
  explanation: "dative",
};

const opts = { level: "A1", languageMix: "arabic_heavy" };

describe("continueAfterQuiz (US1)", () => {
  it("returns one teacher decision and calls the LLM exactly once", async () => {
    const generate = vi.fn(async () => ({ mode: "discuss", reply: "أحسنت! والآن…", quiz: null }));
    const decision = await continueAfterQuiz(quiz, 1, true, { ...opts, generate });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(decision).not.toBeNull();
    expect(decision!.mode).toBe("discuss");
    expect(decision!.reply).toContain("أحسنت");
  });

  it("may lead with a follow-up quiz (one step forward, not a loop)", async () => {
    const generate = vi.fn(async () => ({
      mode: "quiz",
      reply: "جرّب هذه:",
      quiz: { question: "Ev ___?", choices: ["de", "da"], correctIndex: 1, explanation: "locative" },
    }));
    const decision = await continueAfterQuiz(quiz, 0, false, { ...opts, generate });
    expect(decision!.mode).toBe("quiz");
    expect(decision!.quiz).not.toBeNull();
  });

  it("returns null when the LLM call fails (caller shows a friendly note)", async () => {
    const generate = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await continueAfterQuiz(quiz, 1, true, { ...opts, generate })).toBeNull();
  });
});
