import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { getEnv } from "../config/env";

// OpenRouter via the Vercel AI SDK — direct calls, no bridge (docs/01). Models are env-configured
// and swappable; the final choice is validated by the eval harness, not asserted here.

type Provider = ReturnType<typeof createOpenRouter>;

let provider: Provider | null = null;

function getProvider(): Provider {
  if (!provider) provider = createOpenRouter({ apiKey: getEnv().OPENROUTER_API_KEY });
  return provider;
}

export function teacherModel(): LanguageModel {
  return getProvider()(getEnv().TEACHER_MODEL);
}

export function teacherFallbackModel(): LanguageModel {
  return getProvider()(getEnv().TEACHER_FALLBACK_MODEL);
}

export function analyzerModel(): LanguageModel {
  return getProvider()(getEnv().ANALYZER_MODEL);
}

export function analyzerFallbackModel(): LanguageModel {
  return getProvider()(getEnv().ANALYZER_FALLBACK_MODEL);
}

export const TEMPERATURE = { teacher: 0.7, analyzer: 0.1 } as const;
