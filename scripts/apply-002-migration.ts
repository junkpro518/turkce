/**
 * Idempotent apply of the 002 schema changes (messages.telegram_message_id + outreach_log) when
 * drizzle-kit is unavailable. Safe to re-run. Run:
 *   npx tsx --env-file=.env scripts/apply-002-migration.ts
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Need DATABASE_URL");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", connect_timeout: 20 });

try {
  await sql.unsafe(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS telegram_message_id bigint;`);
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS messages_telegram_message_id ON messages (telegram_message_id);`,
  );
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS outreach_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id uuid NOT NULL REFERENCES learner_profile(id) ON DELETE CASCADE,
      type text NOT NULL,
      sent_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS outreach_log_profile_sent ON outreach_log (profile_id, sent_at);`,
  );
  console.log("✓ 002 schema applied (telegram_message_id, outreach_log)");
} catch (err) {
  console.error("apply failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
