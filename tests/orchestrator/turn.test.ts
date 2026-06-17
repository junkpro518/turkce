import { describe, expect, it } from "vitest";
import { handleTurn } from "../../lib/orchestrator/turn";
import type { TurnStores } from "../../lib/orchestrator/ports";
import { EMPTY_ANALYSIS, type AnalysisResult } from "../../lib/ai/schemas";

interface StoredMsg {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  analyzed: boolean;
}

function makeStores() {
  const messages: StoredMsg[] = [];
  const errorsByMsg = new Map<string, AnalysisResult["errors"]>();
  let seq = 0;
  const stores: TurnStores = {
    async getOrOpenSession() {
      return { id: "session-1" };
    },
    async insertMessage(m) {
      const id = `m${++seq}`;
      messages.push({ id, sessionId: m.sessionId, role: m.role, content: m.content, analyzed: false });
      return { id };
    },
    async markAnalyzed(messageId) {
      const m = messages.find((x) => x.id === messageId);
      if (m) m.analyzed = true;
    },
    async insertErrors(messageId, errs) {
      errorsByMsg.set(messageId, errs);
    },
    async applyMasterySignals() {},
  };
  return { stores, messages, errorsByMsg };
}

const goodAnalysis: AnalysisResult = {
  errors: [
    { original: "okul", correction: "okula", grammarPoint: "locative-da", explanation: "w", severity: "medium" },
  ],
  newVocab: [],
  masterySignals: [{ grammarPoint: "locative-da", correct: false }],
};

describe("handleTurn (US1)", () => {
  it("persists the user message and replies WITHOUT running analysis first", async () => {
    const { stores, messages, errorsByMsg } = makeStores();
    const result = await handleTurn("p1", "Ben okul gidiyorum", {
      stores,
      teacher: async () => ({ reply: "Harika! 🙂", mode: "discuss" }),
      analyzer: async () => goodAnalysis,
    });

    // Reply is available immediately; both messages persisted; analysis NOT yet run.
    expect(result.reply).toBe("Harika! 🙂");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    const userMsg = messages.find((m) => m.role === "user")!;
    expect(userMsg.analyzed).toBe(false); // persist-before-analysis (FR-003)
    expect(errorsByMsg.size).toBe(0);

    // Now run the background analysis.
    await result.runAnalysis();
    expect(messages.find((m) => m.id === userMsg.id)!.analyzed).toBe(true);
    expect(errorsByMsg.get(userMsg.id)).toHaveLength(1);
  });

  it("degrades gracefully when analysis fails — reply unaffected, message still marked analyzed", async () => {
    const { stores, messages } = makeStores();
    const result = await handleTurn("p1", "merhaba", {
      stores,
      teacher: async () => ({ reply: "Merhaba!", mode: "discuss" }),
      analyzer: async () => {
        throw new Error("analyzer down");
      },
    });
    expect(result.reply).toBe("Merhaba!");
    await expect(result.runAnalysis()).resolves.toBeUndefined();
    const userMsg = messages.find((m) => m.role === "user")!;
    expect(userMsg.analyzed).toBe(true); // finally{} marked it → backfill won't loop on it
  });

  it("handles a clean message with no corrections", async () => {
    const { stores, errorsByMsg } = makeStores();
    const result = await handleTurn("p1", "Bugün okula gidiyorum", {
      stores,
      teacher: async () => ({ reply: "Aferin!", mode: "discuss" }),
      analyzer: async () => EMPTY_ANALYSIS,
    });
    await result.runAnalysis();
    expect(errorsByMsg.size).toBe(0);
  });
});
