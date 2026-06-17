import type { CurriculumNode } from "../../lib/curriculum/types";

/**
 * T010 (fix I1): the A1 grammar-point KEY SKELETON only — keys + level + prerequisites +
 * required/borderline flags. `canDo`/`targetVocab`/full `grammarPoint` wording are authored later
 * (T045). Ordering and prerequisites are grounded in docs/10 (Turkish-specific ordering rules:
 * vowel harmony + consonant changes + buffer-y first; locative before other cases; tenses begin
 * with -Iyor). This is the taxonomy that curriculum selection (T017) and analyzer grammarPoint
 * validation (T027) reference before the full tree exists.
 */
export const A1_KEYS: CurriculumNode[] = [
  node("alphabet-sounds", "Alphabet & sounds", []),
  node("vowel-harmony", "Major vowel harmony", ["alphabet-sounds"]),
  node("consonant-changes", "Consonant softening & assimilation", ["alphabet-sounds"]),
  node("buffer-consonant-y", "Buffer consonant -y-", ["vowel-harmony"]),
  node("personal-pronouns", "Personal pronouns", []),
  node("demonstratives", "Demonstratives (bu/şu/o)", []),
  node("negation-degil", "Negation with değil", []),
  node("var-yok", "var / yok", []),
  node("plural-lar", "Plural -lAr", ["vowel-harmony"]),
  node("question-particle-mi", "Question particle -mI", ["vowel-harmony"]),
  node("possessive-suffixes", "Possessive suffixes", ["vowel-harmony", "buffer-consonant-y"]),
  node("locative-da", "Locative case -DA", ["vowel-harmony", "consonant-changes"]),
  node("imperative", "Imperative (verb root)", []),
  node("infinitive-mak", "Infinitive -mAk", ["vowel-harmony"]),
  node("present-continuous-iyor", "Present continuous -Iyor", ["vowel-harmony", "consonant-changes"]),
];

function node(key: string, grammarPoint: string, prerequisites: string[]): CurriculumNode {
  return {
    key,
    level: "A1",
    grammarPoint,
    canDo: "",
    targetVocab: [],
    prerequisites,
    required: true,
    borderline: false,
  };
}
