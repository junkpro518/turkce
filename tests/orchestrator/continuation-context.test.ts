import { describe, expect, it } from "vitest";
import { buildContinuationContext } from "../../lib/orchestrator/continuation-context";
import type { QuizPayload } from "../../lib/ai/schemas";

const quiz: QuizPayload = {
  question: "Ben ___ gidiyorum.",
  choices: ["okul", "okula", "okulda"],
  correctIndex: 1,
  explanation: "dative",
};

describe("buildContinuationContext", () => {
  it("returns exactly one teacher message", () => {
    expect(buildContinuationContext(quiz, 1, true)).toHaveLength(1);
  });

  it("describes a correct answer and asks to advance", () => {
    const [msg] = buildContinuationContext(quiz, 1, true);
    expect(msg!.role).toBe("user");
    expect(msg!.content).toContain("صحيح");
    expect(msg!.content).toContain(quiz.question);
    expect(msg!.content).toContain("okula");
  });

  it("describes a wrong answer with the correct choice and asks to reinforce", () => {
    const [msg] = buildContinuationContext(quiz, 0, false);
    expect(msg!.content).toContain("خاطئ");
    expect(msg!.content).toContain("okul"); // chosen
    expect(msg!.content).toContain("okula"); // correct
    expect(msg!.content).toContain("عزّز");
  });
});
