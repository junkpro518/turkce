# 02 — نموذج البيانات

> قاعدة البيانات: **Supabase (PostgreSQL)** عبر **Drizzle ORM**. المخطّط يتمحور حول **نموذج المتعلّم** (العمود الفقري). تطبيق أحادي المستخدم (أنت)، لكن المخطّط يدعم مستخدماً واحداً بنظافة.

## المبدأ
`learner_profile` + `grammar_mastery` + `vocab_cards` معاً = **ذاكرة الدماغ المتكيّف**. تُقرأ قبل كل دور وتُحدَّث بعده. هذا ما كان مفقوداً في `TR_AR_AI` (حالة في الذاكرة تضيع عند restart).

## الجداول الثمانية (v1)

### 1. `learner_profile` — أنت
| العمود | النوع | ملاحظة |
|--------|------|--------|
| `id` | uuid (pk) | |
| `telegram_user_id` | bigint (unique) | ربط عميل التيليجرام |
| `cefr_overall` | text | A1–C2 |
| `cefr_by_skill` | jsonb | `{speaking,listening,reading,writing,grammar,vocab}` تقديرات |
| `settings` | jsonb | تفضيلات التدريس (مزيج اللغتين، الصرامة، الأسلوب…) |
| `xp`, `streak_days`, `last_active_date` | int/date | تحفيز |
| `created_at`, `updated_at` | timestamptz | |

### 2. `goals` — أهدافك المتغيّرة
`id` · `title` · `priority` (int) · `status` (active/paused/done) · `is_auto` (bool) · `created_at`. قابلة للتغيير وإعادة الترتيب — المنهج يتكيّف معها.

### 3. `grammar_mastery` — خريطة إتقان القواعد
`id` · `grammar_point` (مفتاح من تصنيف ثابت) · `mastery_score` (0–1) · `evidence_count` (int) · `status` (new/learning/mastered) · `last_seen_at`. يقود المنهج والتصحيح.

### 4. `vocab_cards` — المفردات + SRS
`id` · `word` · `translation` · `example` · `pos` · حالة **FSRS** (`stability`, `difficulty`, `due_at`, `reps`, `lapses`) · `source_message_id` · `created_at`. فريد على `word`.

### 5. `sessions` — الجلسات
`id` · `started_at` · `ended_at` · `current_focus` (هدف المنهج وقتها) · `summary_id` (fk).

### 6. `messages` — الرسائل
`id` · `session_id` (fk) · `role` (user/assistant) · `content` · `mode` (discuss/answer/quiz/story/roleplay/drill) · `mode_payload` (jsonb — بيانات الاختبار حين يختار المعلّم الاختبار) · `created_at`. فهرس على `(session_id, created_at)`.

### 7. `error_log` — سجل التصحيح العميق
`id` · `message_id` (fk) · `grammar_point` · `original` · `correction` · `explanation` · `severity` · `created_at`. يغذّي تحليل الضعف وتحديث الإتقان.

### 8. `session_summaries` — الذاكرة طويلة الأمد
`id` · `session_id` (fk, unique) · `summary` · `topics` (text[]) · `vocab_introduced` (text[]) · `errors` (text[]) · `created_at`. يُحقن في prompt الجلسات اللاحقة.

## قراران مقصودان

1. **شجرة المنهج (CEFR skill graph) تبقى في الكود/config**، لا في جدول DB.
   - بيانات مرجعية ثابتة (قواعد + كفايات وظيفية مرتّبة بالمتطلّبات السابقة).
   - أسهل في النسخ (versioning) والاختبار من جدول DB.
   - التقدّم يُتتبَّع في `grammar_mastery` + `learner_profile`.

2. **بيانات الأنماط الغنية (الاختبار) تُخزَّن inline** في `messages.mode_payload` (jsonb)، لا جدول منفصل في v1 — بساطة.

## العلاقات (مبسّطة)
```
learner_profile (1) ── (N) goals
learner_profile (1) ── (N) grammar_mastery
learner_profile (1) ── (N) vocab_cards
sessions (1) ── (N) messages ── (N) error_log
sessions (1) ── (1) session_summaries
```
الحذف: CASCADE من `sessions` للرسائل والملخصات؛ من `messages` لسجل الأخطاء.

## RLS
مستخدم واحد ⇒ سياسة بسيطة (single-user). يُترك التشديد لمرحلة لاحقة إن تعدّد المستخدمون.
