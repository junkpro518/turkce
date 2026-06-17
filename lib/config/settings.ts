// Tutor settings (docs/08). In v1 these are config/seed-provided and shape the tutor; they are
// NOT runtime-editable via Telegram (FR-025, clarify). Seeded into learner_profile.settings (T011).

export type LanguageMix = "arabic_heavy" | "balanced" | "turkish_heavy";
export type CorrectionStrictness = "gentle" | "moderate" | "strict";
export type ResponseStyle = "casual" | "formal";

export interface TutorSettings {
  language_mix: LanguageMix;
  correction_strictness: CorrectionStrictness;
  response_style: ResponseStyle;
  focus_areas: string[];
  custom_instructions: string;
}

export const DEFAULT_SETTINGS: TutorSettings = {
  language_mix: "balanced",
  correction_strictness: "moderate",
  response_style: "casual",
  focus_areas: ["grammar", "conversation", "vocabulary"],
  custom_instructions: "",
};
