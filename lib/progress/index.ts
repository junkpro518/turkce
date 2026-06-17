import type { CefrLevel } from "../config/constants";

// Pure progress derivation (FR-023). Produces the text summary shown by /progress.

export interface SkillCefr {
  skill: string;
  level: CefrLevel;
}

export interface Weakness {
  grammarPoint: string;
  score: number;
}

export interface ProgressInput {
  cefrBySkill: SkillCefr[];
  currentFocus: string | null;
  topWeaknesses: Weakness[];
  dueReviewCount: number;
  streakDays: number;
  xp: number;
}

export function renderProgress(p: ProgressInput): string {
  const lines: string[] = [];
  lines.push("📊 *Progress*");

  if (p.cefrBySkill.length > 0) {
    const skills = p.cefrBySkill.map((s) => `${s.skill}: ${s.level}`).join(" · ");
    lines.push(`Level — ${skills}`);
  }

  lines.push(`Current focus — ${p.currentFocus ?? "—"}`);

  if (p.topWeaknesses.length > 0) {
    const weak = p.topWeaknesses
      .map((w) => `${w.grammarPoint} (${w.score.toFixed(2)})`)
      .join(", ");
    lines.push(`Top weaknesses — ${weak}`);
  } else {
    lines.push("Top weaknesses — none yet");
  }

  lines.push(`Due reviews — ${p.dueReviewCount}`);
  lines.push(`Streak — ${p.streakDays}d · XP — ${p.xp}`);

  return lines.join("\n");
}
