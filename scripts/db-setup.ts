/**
 * One-off DB bootstrap: apply Drizzle migrations and seed the single learner profile with default
 * settings. Reads DATABASE_URL + ALLOWED_TELEGRAM_USER_ID directly (no full env needed). Run:
 *
 *   npx tsx --env-file=.env scripts/db-setup.ts
 */
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { DEFAULT_SETTINGS } from "../lib/config/settings";
import { learnerProfile } from "../lib/db/schema";

const url = process.env.DATABASE_URL;
const allowed = Number(process.env.ALLOWED_TELEGRAM_USER_ID);
if (!url || !Number.isFinite(allowed) || allowed <= 0) {
  console.error("Need DATABASE_URL and ALLOWED_TELEGRAM_USER_ID in env.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", connect_timeout: 15 });
const db = drizzle(sql);

try {
  console.log("Applying migrations from ./drizzle ...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ migrations applied");

  const existing = await db
    .select({ id: learnerProfile.id })
    .from(learnerProfile)
    .where(eq(learnerProfile.telegramUserId, allowed))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(learnerProfile).values({ telegramUserId: allowed, settings: DEFAULT_SETTINGS });
    console.log(`✓ seeded learner profile for telegram_user_id=${allowed}`);
  } else {
    console.log(`✓ profile already exists for telegram_user_id=${allowed}`);
  }
  console.log("DB setup done.");
} catch (err) {
  console.error("DB setup failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
