import { InlineKeyboard } from "grammy";
import type { QuizPayload } from "../ai/schemas";

// T038: quiz card rendering + grading. `gradeQuiz` is pure (unit-tested); `buildQuizKeyboard`
// builds the inline keyboard whose callback data carries the chosen index.

export function buildQuizKeyboard(quiz: QuizPayload): InlineKeyboard {
  const kb = new InlineKeyboard();
  quiz.choices.forEach((choice, i) => {
    kb.text(choice, `quiz:${i}`).row();
  });
  return kb;
}

export interface QuizGrade {
  correct: boolean;
  explanation: string;
}

export function gradeQuiz(quiz: QuizPayload, choiceIndex: number): QuizGrade {
  return { correct: choiceIndex === quiz.correctIndex, explanation: quiz.explanation };
}
