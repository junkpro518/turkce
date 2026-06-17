import type { AnalysisResult, MasterySignal, QuizPayload } from "../ai/schemas";

// Ports the turn handler depends on. Real implementations are DB- and AI-backed (composition root);
// tests inject in-memory fakes. This keeps the orchestrator pure-ish and offline-testable.

export interface NewMessage {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  mode?: string | null;
  modePayload?: unknown;
}

export interface TurnStores {
  getOrOpenSession(profileId: string): Promise<{ id: string }>;
  insertMessage(m: NewMessage): Promise<{ id: string }>;
  markAnalyzed(messageId: string): Promise<void>;
  insertErrors(messageId: string, errors: AnalysisResult["errors"]): Promise<void>;
  applyMasterySignals(profileId: string, signals: MasterySignal[]): Promise<void>;
}

export interface TeacherInput {
  profileId: string;
  text: string;
}
export interface TeacherOutput {
  reply: string;
  mode: string;
  quiz?: QuizPayload | null;
}
export type TeacherPort = (input: TeacherInput) => Promise<TeacherOutput>;

export type AnalyzerPort = (input: { profileId: string; text: string }) => Promise<AnalysisResult>;

export interface HandleTurnDeps {
  stores: TurnStores;
  teacher: TeacherPort;
  analyzer: AnalyzerPort;
}

export interface TurnResult {
  reply: string;
  mode: string;
  quiz: QuizPayload | null;
  userMessageId: string;
  assistantMessageId: string;
  /** Run the background analysis. The caller invokes this AFTER delivering the reply. */
  runAnalysis: () => Promise<void>;
}
