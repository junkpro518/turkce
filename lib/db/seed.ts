import { eq } from "drizzle-orm";
import { getEnv } from "../config/env";
import { DEFAULT_SETTINGS } from "../config/settings";
import { getDb } from "./client";
import { learnerProfile } from "./schema";

// T011 (fix U1): seed the single learner profile with default tutor settings (FR-025).
// Idempotent: only inserts if the authorized profile does not already exist.

export async function seedProfile(): Promise<void> {
  const { ALLOWED_TELEGRAM_USER_ID } = getEnv();
  const db = getDb();

  const existing = await db
    .select({ id: learnerProfile.id })
    .from(learnerProfile)
    .where(eq(learnerProfile.telegramUserId, ALLOWED_TELEGRAM_USER_ID))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(learnerProfile).values({
    telegramUserId: ALLOWED_TELEGRAM_USER_ID,
    settings: DEFAULT_SETTINGS,
  });
}
