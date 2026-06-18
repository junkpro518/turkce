import { describe, expect, it } from "vitest";
import { decideTurn } from "../../lib/orchestrator/teacher";

describe("decideTurn (FR-002 mode judgment)", () => {
  it("returns a discuss decision with no quiz", async () => {
    const d = await decideTurn({
      generate: async () => ({ mode: "discuss", reply: "Merhaba!", quiz: null }),
    });
    expect(d).not.toBeNull();
    expect(d!.mode).toBe("discuss");
    expect(d!.quiz).toBeNull();
  });

  it("returns a quiz decision with a valid quiz", async () => {
    const d = await decideTurn({
      generate: async () => ({
        mode: "quiz",
        reply: "Hadi küçük bir alıştırma:",
        quiz: { question: "Ben ___ gidiyorum.", choices: ["okul", "okula"], correctIndex: 1, explanation: "dative" },
      }),
    });
    expect(d!.mode).toBe("quiz");
    expect(d!.quiz).not.toBeNull();
    expect(d!.quiz!.correctIndex).toBe(1);
  });

  it("drops an invalid quiz (correctIndex out of range) and downgrades to discuss", async () => {
    const d = await decideTurn({
      generate: async () => ({
        mode: "quiz",
        reply: "...",
        quiz: { question: "?", choices: ["a", "b"], correctIndex: 5, explanation: "x" },
      }),
    });
    expect(d!.mode).toBe("discuss");
    expect(d!.quiz).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    const d = await decideTurn({
      generate: async () => {
        throw new Error("down");
      },
    });
    expect(d).toBeNull();
  });

  it("returns null on schema mismatch", async () => {
    const d = await decideTurn({ generate: async () => ({ mode: "weird", reply: 5 }) });
    expect(d).toBeNull();
  });
});
