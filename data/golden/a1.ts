// Hand-authored A1 golden set (T047, MVP subset). ~12 cases targeting real A1 errors grounded in
// the A1 keys (docs/10): locative -DA, present-continuous -Iyor + person, plural -lAr (+ vowel
// harmony, numeral+plural), possessive suffixes, question particle -mI. Includes 33% correct
// sentences to measure overcorrection. NOT seeded from public GECTurk (leakage-safe).

export interface GoldenCase {
  learner: string;
  /** The corrected form (equal to `learner` when the sentence is already correct). */
  correct: string;
  isCorrect: boolean;
  /** A1 key this case exercises (traceability; not used in scoring). */
  grammarKey: string;
}

export const A1_GOLDEN: GoldenCase[] = [
  // --- errors ---
  { learner: "Kitap masa.", correct: "Kitap masada.", isCorrect: false, grammarKey: "locative-da" },
  { learner: "Ben su içiyor.", correct: "Ben su içiyorum.", isCorrect: false, grammarKey: "present-continuous-iyor" },
  { learner: "Kalemlar masada.", correct: "Kalemler masada.", isCorrect: false, grammarKey: "plural-lar" },
  { learner: "Benim ev güzel.", correct: "Benim evim güzel.", isCorrect: false, grammarKey: "possessive-suffixes" },
  { learner: "Sen geliyor mu?", correct: "Sen geliyor musun?", isCorrect: false, grammarKey: "question-particle-mi" },
  { learner: "Üç kitaplar var.", correct: "Üç kitap var.", isCorrect: false, grammarKey: "plural-lar" },
  { learner: "Ahmet ev.", correct: "Ahmet evde.", isCorrect: false, grammarKey: "locative-da" },
  { learner: "O ders çalışıyor mı?", correct: "O ders çalışıyor mu?", isCorrect: false, grammarKey: "question-particle-mi" },
  // --- correct (overcorrection probes) ---
  { learner: "Evde bir köpek var.", correct: "Evde bir köpek var.", isCorrect: true, grammarKey: "var-yok" },
  { learner: "Ben su içiyorum.", correct: "Ben su içiyorum.", isCorrect: true, grammarKey: "present-continuous-iyor" },
  { learner: "Kalemler masada.", correct: "Kalemler masada.", isCorrect: true, grammarKey: "locative-da" },
  { learner: "Bugün hava güzel.", correct: "Bugün hava güzel.", isCorrect: true, grammarKey: "adjective" },
];
