import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { TutorSettings } from "../config/settings";

// 8-table data model (data-model.md). Single-user app; everything fans out from learner_profile.

const tz = { withTimezone: true } as const;

export const learnerProfile = pgTable("learner_profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull().unique(),
  cefrOverall: text("cefr_overall").notNull().default("A1"),
  cefrBySkill: jsonb("cefr_by_skill").$type<Record<string, string>>().notNull().default({}),
  settings: jsonb("settings").$type<TutorSettings>().notNull(),
  xp: integer("xp").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  lastActiveDate: date("last_active_date"),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", tz).notNull().defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => learnerProfile.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  priority: integer("priority").notNull().default(100),
  status: text("status").notNull().default("active"), // active | paused | done
  isAuto: boolean("is_auto").notNull().default(false),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
});

export const grammarMastery = pgTable(
  "grammar_mastery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => learnerProfile.id, { onDelete: "cascade" }),
    grammarPoint: text("grammar_point").notNull(),
    masteryScore: real("mastery_score").notNull().default(0),
    evidenceCount: integer("evidence_count").notNull().default(0),
    sessionsSeen: integer("sessions_seen").notNull().default(0),
    status: text("status").notNull().default("new"), // new | learning | mastered
    lastSeenAt: timestamp("last_seen_at", tz),
  },
  (t) => [uniqueIndex("grammar_mastery_profile_point").on(t.profileId, t.grammarPoint)],
);

export const vocabCards = pgTable(
  "vocab_cards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => learnerProfile.id, { onDelete: "cascade" }),
    word: text("word").notNull(),
    translation: text("translation"),
    example: text("example"),
    pos: text("pos"),
    stability: real("stability").notNull().default(0),
    difficulty: real("difficulty").notNull().default(0),
    dueAt: timestamp("due_at", tz).notNull(),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    state: text("state").notNull().default("new"),
    sourceMessageId: uuid("source_message_id"),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("vocab_cards_profile_word").on(t.profileId, t.word)],
);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => learnerProfile.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", tz).notNull().defaultNow(),
  endedAt: timestamp("ended_at", tz),
  currentFocus: text("current_focus"),
  summaryId: uuid("summary_id"),
});

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // user | assistant
    content: text("content").notNull(),
    mode: text("mode"), // discuss | answer | quiz | story | roleplay | drill
    modePayload: jsonb("mode_payload"),
    analyzedAt: timestamp("analyzed_at", tz), // null = pending analysis (backfill target)
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", tz).notNull().defaultNow(),
  },
  (t) => [index("messages_session_created").on(t.sessionId, t.createdAt)],
);

export const errorLog = pgTable("error_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  grammarPoint: text("grammar_point"),
  original: text("original").notNull(),
  correction: text("correction").notNull(),
  explanation: text("explanation").notNull(),
  severity: text("severity").notNull().default("medium"),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
});

export const sessionSummaries = pgTable("session_summaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  topics: text("topics").array(),
  vocabIntroduced: text("vocab_introduced").array(),
  errors: text("errors").array(),
  createdAt: timestamp("created_at", tz).notNull().defaultNow(),
});
