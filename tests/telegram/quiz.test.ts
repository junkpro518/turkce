import { describe, expect, it } from "vitest";
import { gradeQuiz } from "../../lib/telegram/quiz";
import type { QuizPayload } from "../../lib/ai/schemas";

const quiz: QuizPayload = {
  question: "Ben ___ gidiyorum.",
  choices: ["okul", "okula", "okulda"],
  correctIndex: 1,
  explanation: "Dative case -a/-e for direction.",
};

describe("gradeQuiz", () => {
  it("marks the correct choice correct and returns the explanation", () => {
    const g = gradeQuiz(quiz, 1);
    expect(g.correct).toBe(true);
    expect(g.explanation).toContain("Dative");
  });

  it("marks a wrong choice incorrect", () => {
    expect(gradeQuiz(quiz, 0).correct).toBe(false);
    expect(gradeQuiz(quiz, 2).correct).toBe(false);
  });
});
