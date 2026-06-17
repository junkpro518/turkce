import { z } from "zod";

// Zod-parsed environment (docs/08). Parsed lazily so importing modules for tests / type-checking
// / migration generation never requires real secrets.

const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1),
  TEACHER_MODEL: z.string().min(1).default("google/gemini-3.1-flash-lite"),
  ANALYZER_MODEL: z.string().min(1).default("openai/gpt-5"),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  ALLOWED_TELEGRAM_USER_ID: z.coerce.number().int().positive(),
  APP_URL: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}
