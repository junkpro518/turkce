import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client";
import { errorLog, grammarMastery, learnerProfile, messages, sessions } from "../db/schema";
import { SESSION } from "../config/constants";
import { initialMastery, updateMastery, type MasteryState, type MasteryStatus } from "../mastery";
import type { MasterySignal } from "../ai/schemas";
import type { NewMessage, TurnStores } from "./ports";

// DB-backed TurnStores (Drizzle). Typecheck-verified; needs a Postgres database to run.
// Idle-session closing (FR-031) is handled by the scheduler (T044, US4) — here we reuse the open
// session or open a new one.

export const dbStores: TurnStores = {
  async getOrOpenSession(profileId) {
    const db = getDb();
    const open = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.profileId, profileId), isNull(sessions.endedAt)))
      .orderBy(desc(sessions.startedAt))
      .limit(1);
    if (open[0]) return { id: open[0].id };
    const created = await db.insert(sessions).values({ profileId }).returning({ id: sessions.id });
    return { id: created[0]!.id };
  },

  async insertMessage(m: NewMessage) {
    const db = getDb();
    const r = await db
      .insert(messages)
      .values({
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        mode: m.mode ?? null,
        modePayload: m.modePayload ?? null,
      })
      .returning({ id: messages.id });
    return { id: r[0]!.id };
  },

  async markAnalyzed(messageId) {
    const db = getDb();
    await db.update(messages).set({ analyzedAt: new Date() }).where(eq(messages.id, messageId));
  },

  async insertErrors(messageId, errors) {
    if (errors.length === 0) return;
    const db = getDb();
    await db.insert(errorLog).values(
      errors.map((e) => ({
        messageId,
        grammarPoint: e.grammarPoint,
        original: e.original,
        correction: e.correction,
        explanation: e.explanation,
        severity: e.severity,
      })),
    );
  },

  async applyMasterySignals(profileId, signals: MasterySignal[]) {
    const db = getDb();
    const idleMs = SESSION.idleTimeoutMin * 60_000;
    for (const sig of signals) {
      const rows = await db
        .select()
        .from(grammarMastery)
        .where(and(eq(grammarMastery.profileId, profileId), eq(grammarMastery.grammarPoint, sig.grammarPoint)))
        .limit(1);
      const existing = rows[0];
      const prev: MasteryState = existing
        ? {
            score: existing.masteryScore,
            evidenceCount: existing.evidenceCount,
            sessionsSeen: existing.sessionsSeen,
            status: existing.status as MasteryStatus,
          }
        : initialMastery();
      const now = new Date();
      const newSession = !existing?.lastSeenAt || now.getTime() - existing.lastSeenAt.getTime() > idleMs;
      const next = updateMastery(prev, { correct: sig.correct, newSession });

      if (existing) {
        await db
          .update(grammarMastery)
          .set({
            masteryScore: next.score,
            evidenceCount: next.evidenceCount,
            sessionsSeen: next.sessionsSeen,
            status: next.status,
            lastSeenAt: now,
          })
          .where(eq(grammarMastery.id, existing.id));
      } else {
        await db.insert(grammarMastery).values({
          profileId,
          grammarPoint: sig.grammarPoint,
          masteryScore: next.score,
          evidenceCount: next.evidenceCount,
          sessionsSeen: next.sessionsSeen,
          status: next.status,
          lastSeenAt: now,
        });
      }
    }
  },
};

/** Resolve the single authorized learner's profile id by Telegram user id. */
export async function getProfileId(telegramUserId: number): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: learnerProfile.id })
    .from(learnerProfile)
    .where(eq(learnerProfile.telegramUserId, telegramUserId))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** Learner context for building the teacher prompt (level + language mix). */
export async function getProfileContext(
  profileId: string,
): Promise<{ cefrOverall: string; languageMix: string }> {
  const db = getDb();
  const rows = await db
    .select({ cefrOverall: learnerProfile.cefrOverall, settings: learnerProfile.settings })
    .from(learnerProfile)
    .where(eq(learnerProfile.id, profileId))
    .limit(1);
  const row = rows[0];
  return {
    cefrOverall: row?.cefrOverall ?? "A1",
    languageMix: row?.settings?.language_mix ?? "arabic_heavy",
  };
}

/** Mark a message flagged (🚩) by the learner (FR-010). */
export async function flagMessage(messageId: string): Promise<void> {
  const db = getDb();
  await db.update(messages).set({ flagged: true }).where(eq(messages.id, messageId));
}
