import { z } from "zod";

// Zod-parsed environment (docs/08). Parsed lazily so importing modules for tests / type-checking
// / migration generation never requires real secrets.

const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  TEACHER_MODEL: z.string().min(1).default("google/gemini-3.1-flash-lite"),
  TEACHER_FALLBACK_MODEL: z.string().min(1).default("deepseek/deepseek-v4-flash"),
  ANALYZER_MODEL: z.string().min(1).default("openai/gpt-5"),
  ANALYZER_FALLBACK_MODEL: z.string().min(1).default("anthropic/claude-sonnet-4.5"),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  ALLOWED_TELEGRAM_USER_ID: z.coerce.number().int().positive(),
  APP_URL: z.string().url(),
  // 002 outreach overrides (optional; defaults in lib/config/constants.ts OUTREACH).
  OUTREACH_TZ: z.string().min(1).optional(),
  OUTREACH_DAILY_CAP: z.coerce.number().int().positive().optional(),
  OUTREACH_INACTIVITY_DAYS: z.coerce.number().int().positive().optional(),
  OUTREACH_ACTIVE_START: z.coerce.number().int().min(0).max(23).optional(),
  OUTREACH_ACTIVE_END: z.coerce.number().int().min(1).max(24).optional(),
  SCHEDULER_TICK_MIN: z.coerce.number().int().positive().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}
