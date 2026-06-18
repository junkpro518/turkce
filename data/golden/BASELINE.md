# Eval Baseline (A1)

Recorded by `npm run eval` (T049, FR-030) over the hand-authored A1 golden set
([a1.ts](./a1.ts), 12 cases — 8 errors + 4 correct).

| Run date | Model | precision | recall | F0.5 | overcorrection | tp/fp/fn |
|----------|-------|-----------|--------|------|----------------|----------|
| 2026-06-18 | `openai/gpt-5` | 1.000 | 0.875 | **0.972** | **0.0%** | 7/0/1 |

**Interpretation**: Precision 1.0 and 0% overcorrection on the correct-sentence subset — the
critical bar (overcorrecting is worse than missing, docs/09 Q2/Q3). The single false negative is
`"Kitap masa."` (ambiguous: two bare nouns, arguably elliptical), a weak golden case rather than a
clear model failure.

**Gate (deferred to T050, Phase 6)**: the CI gate should block any teacher/analyzer prompt or
model change that drops F0.5 below this baseline or raises overcorrection. Re-run on model change;
results vary slightly run-to-run (LLM non-determinism), so treat the threshold with a small margin.
