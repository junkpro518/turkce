import { describe, expect, it } from "vitest";
import { renderProgress } from "../../lib/progress";

describe("renderProgress", () => {
  it("includes per-skill CEFR, focus, weaknesses, due reviews, streak and XP", () => {
    const out = renderProgress({
      cefrBySkill: [
        { skill: "grammar", level: "A2" },
        { skill: "vocab", level: "A1" },
      ],
      currentFocus: "locative-da",
      topWeaknesses: [{ grammarPoint: "possessive-suffixes", score: 0.42 }],
      dueReviewCount: 7,
      streakDays: 3,
      xp: 120,
    });
    expect(out).toContain("grammar: A2");
    expect(out).toContain("vocab: A1");
    expect(out).toContain("locative-da");
    expect(out).toContain("possessive-suffixes");
    expect(out).toContain("0.42");
    expect(out).toContain("7");
    expect(out).toContain("3d");
    expect(out).toContain("120");
  });

  it("handles an empty/new learner gracefully", () => {
    const out = renderProgress({
      cefrBySkill: [],
      currentFocus: null,
      topWeaknesses: [],
      dueReviewCount: 0,
      streakDays: 0,
      xp: 0,
    });
    expect(out).toContain("none yet");
    expect(out).toContain("—");
  });
});
