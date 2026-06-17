import { describe, expect, it } from "vitest";
import {
  deriveCefr,
  initialMastery,
  updateMastery,
  type MasteryState,
} from "../../lib/mastery";

function apply(seq: { correct: boolean; newSession: boolean }[]): MasteryState {
  return seq.reduce((s, i) => updateMastery(s, i), initialMastery());
}

describe("updateMastery", () => {
  it("reaches mastered after 5 correct uses across 2 sessions", () => {
    const s = apply([
      { correct: true, newSession: true }, // session 1
      { correct: true, newSession: false },
      { correct: true, newSession: false },
      { correct: true, newSession: true }, // session 2
      { correct: true, newSession: false },
    ]);
    expect(s.evidenceCount).toBe(5);
    expect(s.sessionsSeen).toBe(2);
    expect(s.status).toBe("mastered");
  });

  it("does NOT master on luck: 5 correct in a single session", () => {
    const s = apply([
      { correct: true, newSession: true },
      { correct: true, newSession: false },
      { correct: true, newSession: false },
      { correct: true, newSession: false },
      { correct: true, newSession: false },
    ]);
    expect(s.evidenceCount).toBe(5);
    expect(s.sessionsSeen).toBe(1);
    expect(s.status).toBe("learning");
  });

  it("does NOT master with high score but too few evidences", () => {
    const s = apply([
      { correct: true, newSession: true },
      { correct: true, newSession: true },
    ]);
    expect(s.score).toBeGreaterThanOrEqual(0.8);
    expect(s.status).toBe("learning");
  });

  it("a single error does NOT demote a mastered point", () => {
    const mastered = apply([
      { correct: true, newSession: true },
      { correct: true, newSession: false },
      { correct: true, newSession: false },
      { correct: true, newSession: true },
      { correct: true, newSession: false },
    ]);
    const afterOneError = updateMastery(mastered, { correct: false, newSession: false });
    expect(afterOneError.status).toBe("mastered");
  });

  it("two consecutive errors demote a mastered point to learning", () => {
    let s = apply([
      { correct: true, newSession: true },
      { correct: true, newSession: false },
      { correct: true, newSession: false },
      { correct: true, newSession: true },
      { correct: true, newSession: false },
    ]);
    s = updateMastery(s, { correct: false, newSession: false });
    s = updateMastery(s, { correct: false, newSession: false });
    expect(s.status).toBe("learning");
  });

  it("starts new and becomes learning after the first attempt", () => {
    expect(initialMastery().status).toBe("new");
    const afterWrong = updateMastery(initialMastery(), { correct: false, newSession: true });
    expect(afterWrong.status).toBe("learning");
    expect(afterWrong.score).toBe(0);
  });
});

describe("deriveCefr", () => {
  it("stays A1 when A1 mastery is below the ratio", () => {
    expect(deriveCefr([{ level: "A1", requiredTotal: 10, requiredMastered: 5 }])).toBe("A1");
  });

  it("moves to A2 when A1 is met but A2 is not", () => {
    expect(
      deriveCefr([
        { level: "A1", requiredTotal: 10, requiredMastered: 9 },
        { level: "A2", requiredTotal: 10, requiredMastered: 2 },
      ]),
    ).toBe("A2");
  });

  it("clamps to the top provided level when all are met", () => {
    expect(
      deriveCefr([
        { level: "A1", requiredTotal: 10, requiredMastered: 10 },
        { level: "A2", requiredTotal: 10, requiredMastered: 10 },
      ]),
    ).toBe("A2");
  });

  it("defaults to A1 with no stats", () => {
    expect(deriveCefr([])).toBe("A1");
  });
});
