# Implementation Plan: turkce v1 — Adaptive Turkish Tutor (Telegram)

**Branch**: `001-v1-adaptive-tutor` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-v1-adaptive-tutor/spec.md`

## Summary

A single-user, depth-first AI Turkish tutor over Telegram. A live **learner model** in
PostgreSQL is the backbone; an **interface-agnostic engine** (`lib/`) owns all pedagogy and a
**thin Telegram client** only talks to it. Each turn: build tiered context (deterministic) →
call the **teacher** (streaming LLM, decides the interaction mode) → deliver the reply → run the
**analyzer** (separate, Zod-structured LLM) in the background to produce deep corrections, capture
vocabulary, and emit mastery signals. Deterministic modules (FSRS scheduling, EWMA mastery,
per-skill CEFR derivation, next-focus selection, F0.5 scoring, message splitting) are pure and
Vitest-tested; every LLM output passes a Zod schema; every Turkish form the tutor emits passes a
deterministic morphological gate. Runs as a long-lived Node server (Next.js standalone) in Docker
on a VPS. Scope: A1→A2.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS; Next.js 15 (App Router).

**Primary Dependencies** (versions pinned at install time, not asserted here): `next`, `ai`
(Vercel AI SDK) + an OpenRouter provider, `drizzle-orm` + a Postgres driver, `zod`, `grammy`,
`ts-fsrs` (MIT — deterministic FSRS), `nlptoolkit-morphologicalanalysis` + `nlptoolkit-spellchecker`
(ISC — pure-Node Turkish morphology, **verified working** during planning), `vitest`.

**Storage**: Supabase (PostgreSQL) via Drizzle ORM + migrations. All learner state persisted.

**Testing**: Vitest for pure pedagogical logic (exact-match, edge cases); Zod validation +
fallback for every AI call; an evaluation harness (F0.5 over edit spans + overcorrection rate, per
CEFR level) over a hand-authored golden set.

**Target Platform**: Long-lived Node server (Next.js standalone output) in Docker on a VPS — **not
serverless**. A persistent process is required for the Telegram webhook, streamed message edits,
non-blocking background analysis, and in-process scheduling. Directly remedies the prior
`docker-compose`/Hermes deployment failures.

**Project Type**: Single TypeScript application that hosts the engine (`lib/`) + the Telegram
webhook (an API route). A light web client is a later phase and out of v1 scope.

**Performance Goals**: The teacher reply begins streaming promptly (perceived-immediate); analysis
is always asynchronous and never blocks the reply; per-turn AI cost ≈ 1 cent. Single concurrent
user.

**Constraints**: No LangGraph / LangChain / Hermes / whole-system agentic framework; AI calls go
directly via OpenRouter. The morphological analyzer is a startup singleton (heavy dictionary load)
and its data files must be present at runtime. Models are env-configured and eval-validated.
Secrets only in env. Access restricted to one authorized `telegram_user_id`; webhook authenticated
by secret token.

**Scale/Scope**: One authorized learner; CEFR A1→A2; the 8-table data model from docs/02.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Constitution v1.0.0 (7 principles). Initial check and post-design re-check below.

| Principle | How this design satisfies it | Status |
|-----------|------------------------------|--------|
| **I. Intelligence in conversation, determinism in support** | Pure, Vitest-tested modules: `srs` (FSRS), `mastery` (EWMA + CEFR derivation), `curriculum` (next-focus selection), `eval` (F0.5), `telegram` message-splitting. Every LLM output (analyzer, quiz payload, anti-overcorrection verdict, session summary) sits behind a Zod schema (see `contracts/`). The teacher LLM decides conversation mode only; curriculum/SRS/mastery are deterministic. | ✅ Pass |
| **II. Depth before breadth** | Only the v1 scope is planned (engine + Telegram text + SRS + A1→A2 curriculum + progress). Deferred items (web, voice, immersion, multi-user) are excluded. No speculative abstraction. | ✅ Pass |
| **III. Spec Kit is the only path to code** | This plan is the `plan` phase; `tasks` is next; **no implementation code is written here** (contracts are documented as schema shapes, not shipped `.ts`). | ✅ Pass |
| **IV. Reliability — no lost state, no silent failure** | All state in Postgres. Inbound message is **persisted before analysis**; `messages.analyzed_at` enables a startup backfill sweep so a crash between reply and analysis is recoverable (not silent loss). Every AI call: try/catch + structured logging + friendly fallback; analyzer degrades without blocking the reply; teacher retries then falls back to the backup model; replies >4096 chars are split. | ✅ Pass |
| **V. Teacher correctness (defense in depth)** | Every Turkish form passes the deterministic morphological gate (`morphology.isValid`, verified: garbage → 0 analyses → reject+regenerate). Correction + SRS-card path uses the strong analyzer model at low temperature behind Zod. Anti-overcorrection pass before recording. Eval harness (F0.5 + overcorrection rate per level) gates teacher/analyzer prompt/model changes in CI. | ✅ Pass |
| **VI. Curriculum grounded in authoritative sources** | The A1→A2 skill tree is authored from approved sources (Maarif Vakfı/MEB, Khozrevanidze & Arslan 2024, Yedi İklim), human-verified, stored as reference data in `data/curriculum/` — not LLM-improvised at runtime. | ✅ Pass |
| **VII. Single TypeScript codebase, engine/client separation** | One Next.js TS app. `lib/` is interface-agnostic (no Telegram/grammY imports). The Telegram client is thin: it adapts updates to engine calls and renders replies; it holds no pedagogical logic. | ✅ Pass |

**Result**: All gates pass. No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-v1-adaptive-tutor/
├── spec.md              # /speckit-specify + /speckit-clarify output
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output (decision ledger)
├── data-model.md        # Phase 1 output (8 tables + curriculum shape)
├── quickstart.md        # Phase 1 output (validation/run guide)
├── contracts/           # Phase 1 output (Zod schema shapes + webhook contract)
│   ├── ai-schemas.md
│   └── telegram-webhook.md
├── checklists/
│   └── requirements.md  # spec quality checklist (passing)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

A single Next.js 15 app. The engine lives in `lib/` and never imports client/transport code.

```text
app/
├── api/telegram/route.ts        # Telegram webhook (grammY webhookCallback); auth: secret token + allowed user id
└── layout.tsx / page.tsx        # minimal placeholder (web client is a later phase)

lib/                             # interface-agnostic pedagogical engine
├── orchestrator/                # per-turn: build tiered context → call teacher → schedule analysis
├── learner/                     # read/update learner model
├── curriculum/                  # next-focus selection (PURE) + loader for the authored tree
├── analyzer/                    # deep correction + anti-overcorrection + vocab/card building (Zod)
├── morphology/                  # FsmMorphologicalAnalyzer singleton + isValid() gate
├── srs/                         # ts-fsrs wrappers (PURE)
├── mastery/                     # EWMA mastery + per-skill CEFR derivation (PURE)
├── progress/                    # progress view derivation (PURE)
├── ai/                          # OpenRouter provider, model config (env), call wrappers, Zod schemas
├── telegram/                    # thin client: streaming edit, message splitting, inline keyboards
├── scheduler/                   # in-process cron: daily reminder, idle-session sweep, analysis backfill, SRS due
├── db/                          # drizzle schema + client + typed queries
├── eval/                        # F0.5 scorer (PURE) + golden-set runner
└── config/                      # env parsing, constants (mastery α/thresholds, idle timeout)

data/
├── curriculum/                  # authored A1→A2 skill tree (grounded, human-verified)
└── golden/                      # hand-authored A1–A2 golden set (≥150 cases, 25–30% correct)

drizzle/                         # generated SQL migrations
tests/                           # Vitest suites (mirroring lib/ pure modules) + eval
Dockerfile, compose, .env.example, vitest.config.ts, drizzle.config.ts
```

**Structure Decision**: Single project (Option 1), specialized for a Next.js app that hosts both
the engine and the Telegram webhook. The `lib/` boundary enforces Principle VII: pure pedagogical
modules are isolated and unit-tested; transport (`telegram/`, `app/api`) and AI I/O (`ai/`) are
thin shells around them.

## Complexity Tracking

> No Constitution Check violations. This section is intentionally empty.
