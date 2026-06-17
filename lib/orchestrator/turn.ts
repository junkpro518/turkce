import { logError } from "../config/logger";
import type { HandleTurnDeps, TurnResult } from "./ports";

// T033: per-turn orchestration. The inbound message is persisted FIRST; the teacher reply is
// produced and returned to the caller (which streams it); analysis is returned as a closure the
// caller runs AFTER replying, so the reply is never blocked (FR-003). `markAnalyzed` runs in a
// finally so a crash mid-analysis is recoverable by the backfill sweep — no silent loss (Principle
// IV).

export async function handleTurn(
  profileId: string,
  text: string,
  deps: HandleTurnDeps,
): Promise<TurnResult> {
  const session = await deps.stores.getOrOpenSession(profileId);

  const userMsg = await deps.stores.insertMessage({
    sessionId: session.id,
    role: "user",
    content: text,
  });

  const t = await deps.teacher({ profileId, text });

  const assistant = await deps.stores.insertMessage({
    sessionId: session.id,
    role: "assistant",
    content: t.reply,
    mode: t.mode,
    modePayload: t.quiz ?? null,
  });

  const runAnalysis = async (): Promise<void> => {
    try {
      const result = await deps.analyzer({ profileId, text });
      if (result.errors.length > 0) await deps.stores.insertErrors(userMsg.id, result.errors);
      if (result.masterySignals.length > 0) {
        await deps.stores.applyMasterySignals(profileId, result.masterySignals);
      }
    } catch (err) {
      logError("turn.analysis", err);
    } finally {
      await deps.stores.markAnalyzed(userMsg.id);
    }
  };

  return {
    reply: t.reply,
    mode: t.mode,
    quiz: t.quiz ?? null,
    userMessageId: userMsg.id,
    assistantMessageId: assistant.id,
    runAnalysis,
  };
}
