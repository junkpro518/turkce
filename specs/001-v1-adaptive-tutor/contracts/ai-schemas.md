# Contracts — AI I/O Schemas (Zod)

Per Constitution Principle I, **every LLM output the system consumes sits behind a Zod schema with
validation + fallback**. These schemas are this project's primary interface contracts. Documented
here as shapes; the actual Zod definitions are written during implementation (after `tasks`). Field
types are notional (`z.string()`, `z.enum`, etc.).

Every schema has a defined **fallback** for validation failure (logged, never shown raw to the
learner). "Critical path" schemas use the strong analyzer model at low temperature.

---

## 1. `AnalysisResult` — deep correction (analyzer, critical path)
Produced by `generateObject` over the learner's message. Background; never blocks the reply.

```
AnalysisResult {
  errors: Array<{
    original: string
    correction: string
    grammarPoint: string        // MUST be a known curriculum node key (validated post-parse)
    explanation: string         // the *why* / rule (FR-007)
    severity: "low" | "medium" | "high"
  }>
  newVocab: Array<{
    word: string
    translation: string
    example: string
    pos: string
  }>
  masterySignals: Array<{
    grammarPoint: string        // known key
    correct: boolean            // evidence for EWMA update (Q4)
  }>
}
```

- **Post-parse validation**: every `grammarPoint` ∈ curriculum keys; every Turkish `correction` /
  `word` / `example` passes `morphology.isValid` (else that item is dropped + regen attempted).
- **Anti-overcorrection**: each `errors[]` entry must survive the `OvercorrectionVerdict` pass
  before it is written to `error_log`.
- **Fallback**: empty `AnalysisResult` (no errors/vocab/signals) — the turn simply contributes no
  analysis; conversation continues (FR-003).

## 2. `OvercorrectionVerdict` — anti-overcorrection pass (analyzer, critical path)
Run per proposed correction; confirms the original was actually wrong (FR-009).

```
OvercorrectionVerdict {
  originalWasCorrect: boolean   // true ⇒ discard the "correction" (overcorrection)
  confidence: "low" | "medium" | "high"
  note: string
}
```

- A correction is recorded only if `originalWasCorrect == false`. Low confidence ⇒ the tutor
  expresses doubt rather than asserting (FR-010).
- **Fallback**: treat as `originalWasCorrect: true` (conservative — prefer missing to overcorrecting).

## 3. `QuizPayload` — interactive quiz card (teacher, structured)
Emitted by the teacher when it judges a quiz is warranted; rendered as an inline-keyboard card.

```
QuizPayload {
  question: string
  choices: string[]             // 2–5
  correctIndex: number          // 0-based, < choices.length
  explanation: string           // shown after answering
}
```

- Stored in `messages.mode_payload` with `mode = "quiz"`.
- **Validation**: `correctIndex` in range; any Turkish in `choices` passes `morphology.isValid`.
- **Fallback**: if invalid, the teacher falls back to a plain-text turn (no quiz this turn).

## 4. `VocabCardBuild` — SRS card construction (analyzer, critical path)
When promoting `newVocab` into `vocab_cards`, the strong model builds the card; repeated/new cards
get an extra LLM judge (docs/09 Q2 Layer 3).

```
VocabCardBuild {
  word: string
  translation: string
  example: string               // a natural A1–A2 example sentence
  pos: string
}
```

- **Validation**: `word` + `example` pass `morphology.isValid`; unique per `(profile_id, word)`.
- **Fallback**: skip card creation for that word (logged); it can be recaptured later.

## 5. `SessionSummary` — long-term memory (analyzer, low temperature)
Generated when a session idle-closes (FR-031); injected into later sessions' context.

```
SessionSummary {
  summary: string
  topics: string[]
  vocabIntroduced: string[]
  errors: string[]
}
```

- Persisted to `session_summaries` (unique per session).
- **Fallback**: a minimal summary derived deterministically from the session's messages/error_log
  (no blocking; never lost).

## 6. Teacher reply (streamed, not schema-bound)
The teacher's conversational text is streamed (`streamText`) and is **not** Zod-validated (it is
natural language, not consumed as structured state). Its only structured emission is `QuizPayload`
above. Teacher failure ⇒ retry, then fall back to the backup model, then a friendly error message.

---

## Cross-cutting contract rules
- Models are env-configured (`TEACHER_MODEL`, `ANALYZER_MODEL`) and swappable; schemas are
  model-agnostic.
- Critical-path schemas (1, 2, 4, 5) use `ANALYZER_MODEL` at low temperature.
- Any schema parse/validation failure is logged (structured) and uses the defined fallback —
  **never** surfaced raw to the learner (Principle IV).
- Changing the prompt or model behind schemas 1/2/4 triggers the eval gate (FR-030).
