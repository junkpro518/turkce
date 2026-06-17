# Feature Specification: turkce v1 — Adaptive Turkish Tutor (Telegram)

**Feature Branch**: `001-v1-adaptive-tutor`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "turkce v1 — full pedagogical engine + intelligent text conversation with deep correction over Telegram + SRS (spaced repetition) + adaptive curriculum (A1→A2 first) + progress. Derived from docs/. Single-user app. Out of scope: web, voice, immersion, multi-user."

## Overview

A personal AI Turkish tutor for a single Arabic-speaking learner, used through Telegram. The
product is built around a **living learner model** (the learner's per-skill level, changing
goals, grammar mastery, vocabulary knowledge, and recurring error patterns). Every interaction
reads from and updates this model. The tutor holds an intelligent conversation and corrects the
learner deeply — explaining the *grammatical reason*, not just "wrong → right" — while
deterministic support systems track mastery, schedule vocabulary review, and choose what to
practice next. Scope is deliberately depth-first: a small, excellent core covering CEFR levels
**A1→A2**, delivered over Telegram.

## Clarifications

### Session 2026-06-17

- Q: How does authoring the A1→A2 curriculum tree and the 150–300-case golden set fit into v1? → A: In-scope as explicit v1 tasks with a defined minimum (full A1→A2 tree + ≥150 golden cases including 25–30% correct sentences); this content gates v1 completion.
- Q: How is a session bounded (drives summary generation and current-focus snapshot)? → A: Idle timeout — a session ends after a configurable period of inactivity (default ~30 minutes); the session summary is generated on close.
- Q: How are tutor settings managed in v1, given docs/08 puts a runtime settings-approval UI out of scope? → A: Config/seed only — settings exist and shape the tutor but are not runtime-editable via Telegram in v1.
- Q: How does the learner add/edit/reprioritize goals (FR-016)? → A: Natural language via the tutor — the learner expresses intent in conversation and the tutor updates goals; no dedicated goal commands in v1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Intelligent conversation with deep correction (Priority: P1)

The learner chats with the tutor in free-form Turkish/Arabic over Telegram. The tutor responds
naturally like a real teacher, deciding on its own whether to discuss, answer, quiz, tell a
story, role-play, or drill a weakness — grounded in the learner's live state. When the learner
makes a mistake, the tutor (separately and without blocking the reply) produces a deep
correction that names the specific Turkish grammar point and explains *why* the correct form is
correct, at a depth appropriate to the learner's level.

**Why this priority**: This is the heart of the product and the direct answer to the prior
versions' core failure ("shallow and unrealistic"). On its own it already delivers the felt
experience of "talking to a smart tutor who actually corrects me."

**Independent Test**: Send a series of Turkish messages (some with deliberate case/possessive/
vowel-harmony/tense errors, some correct) and verify: (a) the reply arrives promptly and reads
naturally, never blocked by analysis; (b) errors are returned with the grammar point + a
reason-based explanation; (c) correct sentences are not "corrected" (no overcorrection).

**Acceptance Scenarios**:

1. **Given** the learner sends a grammatically correct Turkish sentence, **When** the tutor
   replies, **Then** the reply is natural and no false correction is produced for that sentence.
2. **Given** the learner sends "Ben okula gidiyorum" with a wrong case suffix (e.g. "Ben okul
   gidiyorum"), **When** analysis completes, **Then** a correction is recorded naming the case
   (dative) and explaining why "-a/-e" is required, scaled to the learner's level.
3. **Given** the learner asks a direct question about a word or rule, **When** the tutor decides
   the mode, **Then** it answers immediately in natural language rather than forcing a quiz.
4. **Given** the tutor decides to quiz, **When** it presents the quiz, **Then** it is an
   interactive card (buttons) with a question, choices, the correct answer, and an explanation.
5. **Given** the tutor produces any Turkish word/form, **When** that form is morphologically
   invalid, **Then** it is rejected and regenerated before reaching the learner.

---

### User Story 2 - Adaptive backbone: learner model & curriculum (Priority: P2)

The tutor maintains a persistent model of the learner across sessions: a per-skill CEFR estimate
(speaking, listening, reading, writing, grammar, vocab can differ), a grammar-mastery map, and
prioritized, changeable goals. A deterministic curriculum (grounded in authoritative Turkish
sources, A1→A2) selects the "next focus" from this model, rebalancing whenever mastery or goals
change. The tutor visibly builds on previous sessions.

**Why this priority**: This is the backbone that makes the experience adaptive rather than a
stateless chat. It is the answer to "doesn't remember / doesn't really adapt." It depends on the
conversation (P1) existing to generate evidence.

**Independent Test**: Over multiple sessions, demonstrate a wrong answer then sustained correct
usage of a grammar point and verify its mastery score rises and only reaches "mastered" after
sustained evidence across at least two sessions (never from one lucky message); change a goal and
verify the selected next-focus shifts accordingly.

**Acceptance Scenarios**:

1. **Given** the learner repeatedly uses a grammar point correctly across two sessions, **When**
   mastery is recomputed, **Then** its status advances toward "mastered" only after the evidence
   threshold is met (no single-message jumps).
2. **Given** the learner makes one mistake on a previously strong point, **When** mastery is
   recomputed, **Then** the score dips but the point is not instantly demoted (demotion is harder
   than promotion).
3. **Given** the learner adds or reprioritizes a goal, **When** the next focus is computed,
   **Then** the selection reflects the active, highest-priority goal.
4. **Given** a new session starts, **When** the tutor builds context, **Then** it incorporates a
   summary of prior sessions (topics covered, vocab introduced, recent errors).
5. **Given** sustained mastery of the required nodes at a level, **When** the per-skill CEFR is
   re-derived, **Then** it changes gradually from accumulated evidence — never from one message.

---

### User Story 3 - Spaced-repetition vocabulary (Priority: P3)

New vocabulary surfacing in conversation is automatically captured as review cards. The learner
reviews due cards over Telegram (reveal → rate: forgot / hard / good / easy), and a deterministic
scheduler sets the next due date for each card. Weak vocabulary feeds back into the tutor's
context.

**Why this priority**: Reinforcement is what makes learning stick ("repeated/forgotten content").
It is valuable but builds on the conversation and learner model already existing.

**Independent Test**: Hold a conversation that introduces new words, confirm cards are created and
linked to their source, run a review session, rate cards, and verify due dates are rescheduled
deterministically per rating.

**Acceptance Scenarios**:

1. **Given** a new word appears in conversation, **When** analysis completes, **Then** a review
   card (word, translation, example) is created and linked to its source message.
2. **Given** review cards are due, **When** the learner starts a review, **Then** cards are shown
   one at a time with reveal-then-rate buttons.
3. **Given** the learner rates a card, **When** the rating is applied, **Then** the next due date
   is set deterministically and the same rating always yields the same schedule.
4. **Given** a word already has a card, **When** it reappears, **Then** no duplicate card is
   created (cards are unique per word).

---

### User Story 4 - Onboarding, progress & daily engagement (Priority: P4)

On first use the learner is gently placed (a light question plus fast early calibration — no
formal placement test). At any time the learner can view progress (per-skill CEFR, current
curriculum focus, top weaknesses, due reviews, streak/XP) via a command. A daily reminder nudges
the learner to review or hold a session.

**Why this priority**: Onboarding removes first-use friction and progress/engagement sustain
long-term use, but the learning value exists without them.

**Independent Test**: Start fresh and verify a conservative A1 start with faster-moving early
estimates; request progress and verify an accurate text summary; verify a daily reminder is sent.

**Acceptance Scenarios**:

1. **Given** a brand-new learner, **When** the first session starts, **Then** the tutor asks a
   light background question and begins conservatively at A1 with a lower early evidence bar so the
   estimate can move quickly.
2. **Given** an existing learner, **When** they request progress, **Then** they receive a text
   summary of per-skill CEFR, current focus, top weaknesses, due reviews, and streak/XP.
3. **Given** a day with due reviews or no session yet, **When** the daily schedule runs, **Then**
   the learner receives a reminder over Telegram.

---

### Edge Cases

- **Reply must never be blocked by analysis**: if analysis (correction/vocab/mastery) fails or is
  slow, the conversation continues normally; analysis for that turn is simply skipped/degraded.
- **Teacher (conversation) failure**: the learner sees a friendly message and the system retries
  and/or falls back to a backup model; the technical error is logged, never shown.
- **Long replies**: replies exceeding the Telegram message size limit are split into sequential
  messages, never silently dropped.
- **Restart mid-session**: no learner state is lost across a restart (all state is persisted).
- **Uncertain correctness**: if the tutor is unsure whether a form is correct, it expresses doubt
  rather than asserting a possibly wrong correction; the learner can flag (🚩) a suspected bad
  correction, which feeds review.
- **Unauthorized user**: messages from any Telegram user other than the authorized learner are
  ignored.
- **Borderline curriculum nodes**: grammar points with contested CEFR placement are treated
  flexibly and placed according to the learner model rather than a fixed level.
- **Overcorrection guard**: every correction passes an anti-overcorrection check before being
  recorded, because incorrectly "correcting" a correct sentence is worse than missing an error.

## Requirements *(mandatory)*

### Functional Requirements

**Conversation & teaching (P1)**

- **FR-001**: The system MUST let the authorized learner hold a free-form text conversation in
  Turkish/Arabic over Telegram, with replies that feel immediate and natural.
- **FR-002**: The tutor MUST decide the interaction mode per turn by pedagogical judgment
  (discuss, answer, quiz, story, role-play, weakness-drill), grounded in the learner's live state,
  rather than a fixed pre-scripted router.
- **FR-003**: The reply MUST NOT be blocked while the learner's message is analyzed; analysis runs
  in the background after the reply is delivered.
- **FR-004**: The tutor MUST provide progressive "typing"/streaming feedback during a reply and
  MUST split replies that exceed the Telegram size limit into sequential messages.
- **FR-005**: When the tutor quizzes, it MUST present an interactive card (buttons) containing a
  question, choices, the correct answer, and an explanation, with correct/incorrect feedback.

**Deep correction & teacher correctness (P1)**

- **FR-006**: For each learner message, the system MUST analyze it for errors using a real Turkish
  grammatical taxonomy (vowel harmony, case suffixes, possessives, tense/conjugation, word order,
  negation, question formation, plurals, connectors).
- **FR-007**: Each detected error MUST be recorded with the original, the correction, the specific
  grammar point, an explanation of *why* (the rule), and a severity, scaled to the learner's level.
- **FR-008**: The system MUST validate the morphological correctness of every Turkish word/form/
  review-card it produces; any form that fails validation MUST be rejected and regenerated before
  reaching the learner.
- **FR-009**: The correction and review-card-building path MUST run a separate anti-overcorrection
  check that confirms the learner's original was actually wrong before recording a correction.
- **FR-010**: When confidence is low, the tutor MUST express uncertainty rather than assert a
  possibly incorrect correction, and the learner MUST be able to flag (🚩) a suspected bad
  correction for review.

**Adaptive learner model & curriculum (P2)**

- **FR-011**: The system MUST persist a learner model: per-skill CEFR estimate, prioritized and
  changeable goals, grammar-mastery map (score + evidence + status per point), vocabulary
  knowledge, and recurring error patterns.
- **FR-012**: Grammar mastery MUST be updated deterministically from usage evidence: a point
  reaches "mastered" only after sustained correct usage (score and evidence thresholds, across at
  least two sessions); demotion MUST be harder than promotion (no demotion on a single error).
- **FR-013**: Per-skill CEFR MUST be derived from the proportion of mastered curriculum nodes at a
  level and MUST change gradually — never jump from a single message.
- **FR-014**: The curriculum MUST be a deterministic CEFR skill tree (A1→A2 for v1) grounded in
  authoritative Turkish sources (not improvised), ordered by prerequisites, with contested nodes
  marked borderline. Authoring the full A1→A2 tree (grounded in approved sources, human-verified)
  is an in-scope v1 deliverable and gates v1 completion.
- **FR-015**: The system MUST select the "next focus" from the learner model, balancing curriculum
  progress, pressing weaknesses, and active goals, and MUST recompute when mastery or goals change.
- **FR-016**: The learner MUST be able to add, edit, reprioritize, and pause/complete goals through
  natural-language conversation with the tutor (no dedicated goal commands in v1); the tutor MAY
  propose a goal automatically on detecting a pattern, subject to the learner's approval.
- **FR-017**: The tutor MUST build on prior sessions by incorporating session summaries (topics,
  vocab introduced, errors) into its context, and MUST avoid recently-covered topics where
  possible.

**Spaced repetition (P3)**

- **FR-018**: The system MUST automatically capture new vocabulary from conversation as review
  cards (word, translation, example), linked to the source message, unique per word.
- **FR-019**: The system MUST schedule reviews deterministically with a spaced-repetition method,
  setting each card's next due date from the learner's rating.
- **FR-020**: The learner MUST be able to review due cards over Telegram (reveal then rate: forgot
  / hard / good / easy), with the same rating always producing the same schedule.
- **FR-021**: Weak vocabulary MUST feed back into the tutor's conversation context.

**Onboarding, progress & engagement (P4)**

- **FR-022**: On first use the system MUST place the learner via a light question and fast early
  calibration (no formal placement test), starting conservatively at A1 with a lower early evidence
  bar so the estimate can move quickly.
- **FR-023**: The learner MUST be able to view progress on demand: per-skill CEFR, current focus,
  top weaknesses, due reviews, and streak/XP.
- **FR-024**: The system MUST send a daily reminder over Telegram to review or hold a session.
- **FR-025**: Tutor behavior MUST be influenceable through settings (language mix, correction
  strictness, response style, focus areas, custom instructions). In v1 these settings are
  config/seed-provided and shape the tutor, but are NOT runtime-editable via Telegram (a runtime
  settings UI is deferred, per docs/08).

**Reliability, security & quality (cross-cutting)**

- **FR-026**: All learner state MUST be persisted durably; no state may be lost on restart.
- **FR-027**: Every AI call MUST be wrapped with error handling, structured logging, and a
  friendly user-facing fallback; technical errors MUST NOT be shown to the learner and MUST NOT be
  silently swallowed. Teacher failure MUST retry/fall back; analyzer failure MUST degrade without
  blocking the reply.
- **FR-028**: Access MUST be restricted to the single authorized learner; messages from other
  Telegram users MUST be ignored, and the inbound channel MUST be authenticated.
- **FR-029**: All deterministic pedagogical logic (spaced-repetition scheduling, mastery math,
  per-skill CEFR derivation, next-focus selection, message splitting) MUST be covered by automated
  tests.
- **FR-030**: Teacher/analyzer correction quality MUST be measurable by an evaluation harness
  (precision-weighted F0.5 over edit spans plus an overcorrection rate, per CEFR level) over a
  hand-authored A1–A2 golden set, and a quality gate MUST block any teacher/analyzer prompt or
  model change that drops quality below the established baseline or raises overcorrection. Authoring
  the golden set is an in-scope v1 deliverable with a minimum size of ≥150 cases including 25–30%
  correct sentences; it gates v1 completion.
- **FR-031**: A session MUST be bounded by an idle timeout — it ends after a configurable period of
  inactivity (default ~30 minutes) — and the session summary MUST be generated when the session
  closes. A new learner message after a closed session MUST start a new session.

### Key Entities *(include if feature involves data)*

- **Learner profile**: the single learner — overall and per-skill CEFR, teaching settings, streak/
  XP, last-active. The root of the model.
- **Goal**: a learner objective — title, priority, status (active/paused/done), whether
  auto-suggested. Changeable; drives curriculum weighting.
- **Grammar mastery**: per grammar point — mastery score (0–1), evidence count, status
  (new/learning/mastered), last seen. Drives curriculum and correction depth.
- **Vocabulary card**: a word with translation, example, part of speech, and spaced-repetition
  state (scheduling fields), linked to its source message; unique per word.
- **Session**: a learning session — start/end, the curriculum focus at the time, and a link to its
  summary. Bounded by an idle timeout (configurable, default ~30 min); the summary is generated on
  close, and a message after a closed session opens a new one.
- **Message**: a conversation turn — role (learner/tutor), content, the interaction mode used, and
  any structured mode payload (e.g. quiz data).
- **Error log**: a recorded correction — grammar point, original, correction, explanation,
  severity — tied to a message; feeds weakness analysis and mastery updates.
- **Session summary**: long-term memory of a session — summary text, topics, vocab introduced,
  errors; injected into later sessions' context.
- **Curriculum skill tree**: authoritative reference data (A1→A2 nodes = grammar point + can-do
  competency + target vocabulary, ordered by prerequisites, borderline nodes marked). Reference
  content, not learner data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the hand-authored A1–A2 golden set, deep correction meets or exceeds the
  established baseline F0.5 (per level) and stays at or below the established overcorrection-rate
  ceiling on the correct-sentence subset; no shipped change regresses either metric.
- **SC-002**: Corrections explain the grammatical *reason* (name the rule and why), not merely
  "wrong → right", on 100% of recorded corrections in review samples.
- **SC-003**: The conversation reply is never blocked by analysis — the tutor begins responding
  promptly on every turn, with analysis completing afterward.
- **SC-004**: Zero learner-state loss across restarts (100% of learner state persists), and zero
  silent failures (every error is either handled with a friendly fallback or logged).
- **SC-005**: A grammar point's per-skill CEFR and mastery never change from a single message; a
  point reaches "mastered" only after sustained correct evidence across at least two sessions.
- **SC-006**: Changing a goal demonstrably changes the selected next focus within the same session.
- **SC-007**: Spaced-repetition scheduling is fully deterministic — the same card and rating always
  produce the same next due date — and is covered by automated tests.
- **SC-008**: Over a multi-session usage period, the learner can point to concrete evidence of
  adaptation (e.g. "mastered X, now working on Y") via the progress view.
- **SC-009**: 100% of Turkish forms presented to the learner pass morphological validation (invalid
  forms are regenerated, never shown).
- **SC-010**: All deterministic pedagogical logic has passing automated test coverage before v1 is
  considered complete.

## Assumptions

- **Single user**: the app serves exactly one authorized learner (you); the data model supports one
  user cleanly and multi-user hardening is out of scope.
- **Primary interface is Telegram text**; web, voice/pronunciation, and immersion content are
  explicitly deferred to later phases and out of scope for v1.
- **Curriculum scope is A1→A2** for v1; higher levels are deferred.
- **Curriculum content** is authored by grounding AI output in approved authoritative sources and
  verifying it by hand (rephrased, never copied verbatim); it is reference data maintained in the
  codebase, not user-editable at runtime.
- **Eval thresholds** (F0.5 minimum and overcorrection ceiling per level) are established as a
  baseline during initial evaluation; the gate enforces "no regression" against that baseline
  rather than a number fixed in advance here.
- **Cold start** uses light self-report plus fast calibration; there is no formal placement exam.
- **Daily reminder timing** uses a sensible default and is adjustable via settings.
- **Data start** is clean for v1 (no migration of prior data into the core); importing only old
  vocabulary as review seeds is an optional later add-on, out of v1 scope.
- **Backups** rely on the hosting platform's automatic backups plus a periodic export of learning
  data; rich export tooling may arrive with the later web phase.
- **Self-monitoring** uses structured logging plus a self-alert to the learner over Telegram on
  errors/outages (suited to a single-user app).
