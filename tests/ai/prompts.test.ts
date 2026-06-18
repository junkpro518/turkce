import { describe, expect, it } from "vitest";
import { buildTeacherSystem } from "../../lib/ai/prompts";

describe("buildTeacherSystem", () => {
  it("instructs the teacher to explain in Arabic", () => {
    const s = buildTeacherSystem("A1", "arabic_heavy");
    expect(s).toContain("بالعربية");
    expect(s).toContain("A1");
  });

  it("uses the beginner clause for A1/A2", () => {
    const a1 = buildTeacherSystem("A1", "arabic_heavy");
    const a2 = buildTeacherSystem("A2", "arabic_heavy");
    expect(a1).toContain("مبتدئ (A1–A2)");
    expect(a2).toContain("مبتدئ (A1–A2)");
  });

  it("uses the advanced clause for B1+", () => {
    const b1 = buildTeacherSystem("B1", "balanced");
    expect(b1).toContain("B1 فأعلى");
    expect(b1).not.toContain("مبتدئ (A1–A2)");
  });

  it("reflects the language-mix preference", () => {
    expect(buildTeacherSystem("A1", "arabic_heavy")).toContain("الأولوية القصوى للعربية");
    expect(buildTeacherSystem("A1", "turkish_heavy")).toContain("زِد التركية");
  });

  it("defaults the level to A1 when empty", () => {
    expect(buildTeacherSystem("", "arabic_heavy")).toContain("A1");
  });
});
