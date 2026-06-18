import { z } from "zod";

// Zod contracts for every LLM I/O (Principle I; contracts/ai-schemas.md). Each consumer has a
// defined fallback for validation failure.

export const AnalysisErrorSchema = z.object({
  original: z.string(),
  correction: z.string(),
  grammarPoint: z.string(),
  explanation: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});
export type AnalysisError = z.infer<typeof AnalysisErrorSchema>;

export const NewVocabSchema = z.object({
  word: z.string(),
  translation: z.string(),
  example: z.string(),
  pos: z.string(),
});
export type NewVocab = z.infer<typeof NewVocabSchema>;

export const MasterySignalSchema = z.object({
  grammarPoint: z.string(),
  correct: z.boolean(),
});
export type MasterySignal = z.infer<typeof MasterySignalSchema>;

export const AnalysisResultSchema = z.object({
  errors: z.array(AnalysisErrorSchema),
  newVocab: z.array(NewVocabSchema),
  masterySignals: z.array(MasterySignalSchema),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const OvercorrectionVerdictSchema = z.object({
  originalWasCorrect: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  note: z.string(),
});
export type OvercorrectionVerdict = z.infer<typeof OvercorrectionVerdictSchema>;

export const QuizCoreSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()).min(2).max(5),
  correctIndex: z.number().int().nonnegative(),
  explanation: z.string(),
});

export const QuizPayloadSchema = QuizCoreSchema.refine((q) => q.correctIndex < q.choices.length, {
  message: "correctIndex out of range",
  path: ["correctIndex"],
});
export type QuizPayload = z.infer<typeof QuizPayloadSchema>;

export const TEACHER_MODES = ["discuss", "answer", "quiz", "story", "roleplay", "drill"] as const;

// The teacher's structured judgment per turn (FR-002): it chooses the interaction mode and, when
// it chooses to quiz, emits a structured quiz. `quiz` uses the unrefined core; correctIndex range
// is validated in decideTurn so a bad quiz downgrades to a plain reply rather than losing the turn.
export const TeacherDecisionSchema = z.object({
  mode: z.enum(TEACHER_MODES),
  reply: z.string(),
  quiz: QuizCoreSchema.nullable().optional(),
});
export type TeacherDecision = z.infer<typeof TeacherDecisionSchema>;

export const VocabCardBuildSchema = z.object({
  word: z.string(),
  translation: z.string(),
  example: z.string(),
  pos: z.string(),
});
export type VocabCardBuild = z.infer<typeof VocabCardBuildSchema>;

export const SessionSummarySchema = z.object({
  summary: z.string(),
  topics: z.array(z.string()),
  vocabIntroduced: z.array(z.string()),
  errors: z.array(z.string()),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const EMPTY_ANALYSIS: AnalysisResult = {
  errors: [],
  newVocab: [],
  masterySignals: [],
};
