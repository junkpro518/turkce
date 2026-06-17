# Phase 0 — Research & Decision Ledger

Most technical choices were already decided during planning (docs/09 Q1–Q14). This ledger
**records** those decisions with rationale and citation, and reserves real investigation for the
few load-bearing items that were assumptions rather than verified facts. Each entry: Decision /
Rationale / Alternatives.

## A. Verified during this planning phase (were assumptions, now facts)

### A1. Morphological grounding works in pure Node — VERIFIED

- **Decision**: Use `nlptoolkit-morphologicalanalysis` (v1.0.20, ISC) as the deterministic
  Layer-0 gate. Wrap it as `morphology.isValid(word) = analyses > 0`.
- **Verification (run during planning)**: Installed in a throwaway project. No `java`/`jvm`/
  `python` anywhere in the dependency tree (pure JS). `FsmMorphologicalAnalyzer.morphologicalAnalysis`
  returned: `kitap`→1, `okula`→1, `gidiyorum`→1, `okul`→1, and the nonsense `xqzwk`→**0**. The
  reject-garbage behavior that Principle V / FR-008 depend on is real.
- **Integration facts the plan must honor**:
  - The analyzer requires data files at runtime cwd: `turkish_finite_state_machine.xml`,
    `turkish_dictionary.txt`, `suffixes.txt`, `turkish_misspellings.txt`,
    `turkish_morphological_lexicon.txt` (shipped inside the npm package). These MUST be copied into
    the Docker image / made available at the working directory, or explicit paths passed to the
    constructor.
  - The constructor loads a large dictionary — instantiate **once as a startup singleton**, never
    per request.
- **Rationale**: Catches vowel-harmony / impossible-suffix errors at ≈ zero cost with no LLM call
  (docs/09 Q2). It is a "definitely-reject" filter (morphological validity only, not meaning).
- **Alternatives**: JVM/Python morphology (Zemberek) — rejected: violates Principle VII (single TS
  codebase) and reintroduces a fragile subprocess bridge (the prior failure mode).

### A2. Background-work execution model — DECIDED (was deferred "deployment details")

- **Decision**: Long-lived Node server running Next.js 15 standalone in Docker on a VPS. **Not
  serverless.** Background analysis runs in-process after the reply is sent; the daily reminder,
  idle-session sweep, SRS-due reminder, and analysis-backfill run on a single in-process scheduler.
- **No-silent-loss handling (Principle IV)**: The inbound learner message is **persisted to
  `messages` before** analysis starts; a nullable `messages.analyzed_at` marks completion. A
  startup/periodic **backfill sweep** re-runs analysis for any message with `analyzed_at IS NULL`.
  So a crash between "reply sent" and "analysis done" is recoverable, not silent data loss — without
  a heavyweight external queue (overkill for one user).
- **Idle-session close (FR-031)**: Hybrid trigger — *lazy* close on the next inbound message (if
  the gap since the last message exceeds the idle timeout, close + summarize the previous session,
  open a new one) **plus** a periodic scheduler sweep that closes/summarizes sessions idle past the
  timeout even with no new message. Same scheduler as the reminders.
- **Rationale**: Webhook + streamed message edits (FR-004) + non-blocking analysis (FR-003) +
  scheduling (FR-024/031) all require a persistent process. Directly fixes the documented prior
  failures (in-memory loss; docker-compose that never defined the service).
- **Alternatives**: Serverless/edge — rejected: loses background work and streaming. External job
  queue (BullMQ/Redis) — rejected for v1: unnecessary infra for a single user; the persist-first +
  backfill pattern meets the reliability bar more simply.

## B. Recorded decisions (already settled in docs)

### B1. Stack & framework

- **Decision**: Next.js 15 (App Router) + TypeScript; Drizzle ORM over Supabase Postgres; Vercel AI
  SDK over OpenRouter (direct); Zod for all AI output; grammY for Telegram; Vitest for tests.
- **Rationale**: docs/01. One TS codebase hosts engine + webhook (+ later web). Direct OpenRouter
  avoids the Hermes 502 fragility.
- **Alternatives**: LangGraph/LangChain/Hermes — **constitutionally rejected** (Principle / docs/01).

### B2. Two-call separation (teacher vs analyzer)

- **Decision**: Teacher = `streamText`, fast cheap model, temp ~0.7, decides interaction mode,
  streams. Analyzer = `generateObject` with Zod, strong model, temp ~0.1, background, structured.
- **Rationale**: docs/04. Keeps conversation intelligent and non-blocking while corrections are
  precise and testable. Merging them (or a graph) was the prior failure.

### B3. Model selection

- **Decision**: Defaults `TEACHER_MODEL=google/gemini-3.1-flash-lite` (fallback
  `deepseek/deepseek-v4-flash`), `ANALYZER_MODEL=openai/gpt-5` (fallback
  `anthropic/claude-sonnet-4.5`). **Env-configured, swappable, eval-validated.** The plan does NOT
  assert these IDs are currently live — `api/v1/models` MUST be re-pulled before production (docs/08).
- **Rationale**: docs/09 Q5. Strong model on the correction critical path; cheap model for chat.
- **Alternatives**: One model for both — rejected (cost vs. correctness tradeoff, docs/09 Q5).

### B4. Mastery & CEFR math (deterministic)

- **Decision**: Grammar mastery = recency-weighted EWMA (`score = α·result + (1−α)·score`, α≈0.3);
  `mastered` at `score ≥ 0.8` AND ≈5 correct uses across ≥2 sessions; demote below 0.6. Per-skill
  CEFR derived from the proportion of mastered required nodes; gradual; demotion harder than
  promotion. Parameters live in `config/` and are tunable.
- **Rationale**: docs/09 Q4. Pure functions, Vitest scenarios (improvement, oscillation, luck).
- **Alternatives**: LLM-judged level — rejected (non-deterministic, untestable; Principle I).

### B5. SRS

- **Decision**: `ts-fsrs` (v5.x, MIT) wrapped behind pure scheduling functions; deterministic;
  Vitest-tested. Auto-capture vocab from analysis; unique per word; review ratings (forgot/hard/
  good/easy) map to deterministic next due dates.
- **Rationale**: docs/03. FSRS = better retention than SM-2; deterministic.
- **Alternatives**: Hand-rolled SM-2 — rejected (reinvents a solved, tested library).

### B6. Curriculum content

- **Decision**: A1→A2 skill tree (node = grammar point + can-do competency + target vocab, ordered
  by prerequisites, borderline nodes marked) authored from approved sources, human-verified, stored
  as reference data in `data/curriculum/`. In-scope v1 deliverable (clarify).
- **Rationale**: docs/09 Q1 + docs/10. Grounding prevents shallow LLM improvisation.
- **Alternatives**: Runtime LLM-generated curriculum — rejected (Principle VI).

### B7. Eval harness & gate

- **Decision**: F0.5 over edit spans + overcorrection rate, **implemented in TypeScript** (no
  M2/ERRANT/Python), per CEFR level, over a hand-authored golden set (≥150 cases incl. 25–30%
  correct sentences; clarify). Home: an `npm run eval` script runnable locally **and** a **GitHub
  Actions** workflow that runs Vitest + eval on PRs touching teacher/analyzer prompts or model
  config; the gate blocks merge on F0.5 regression or raised overcorrection.
- **Rationale**: docs/09 Q3 + FR-030. Repo is on GitHub → Actions is the natural enforcement point;
  the local script keeps it usable for a solo developer.
- **Alternatives**: Pure local git hook only — kept as a convenience but not the gate of record
  (hooks are bypassable); M2/ERRANT — rejected (Python/English-only, docs/09 Q3).

### B8. Tiered context & prompt caching

- **Decision**: Build context in tiers (Tier 1 static profile/settings; Tier 2 dynamic: current
  focus, last ~5 distinct errors, weakest ~20 words, last topic, last session summary). Enable
  provider prompt caching where supported.
- **Rationale**: docs/04 + docs/08. Bounds token growth and cost; avoids the prior "huge slow
  prompt" failure.

### B9. Telegram streaming & reliability

- **Decision**: Simulate streaming by editing the message every ~1.5s with a typing action; split
  replies >4096 chars; inline keyboards for quizzes and SRS review; friendly fallback on errors;
  structured logging + self-alert to the learner on failures.
- **Rationale**: docs/05 + docs/09 Q12. Telegram lacks token streaming; editing feels live.

## C. Deliberately deferred (out of v1, do not design now)

Web client, voice/pronunciation, immersion content, multi-user hardening, old-data migration,
rich export tooling. (docs/06 roadmap; spec Assumptions.)
