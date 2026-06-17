// Structured logging + friendly user-facing fallback (Principle IV / FR-027).
// Technical detail goes to logs; the learner only ever sees a friendly message.

type Meta = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", scope: string, message: string, meta?: Meta): void {
  const entry = { level, scope, message, ...(meta ?? {}) };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function logInfo(scope: string, message: string, meta?: Meta): void {
  emit("info", scope, message, meta);
}

export function logWarn(scope: string, message: string, meta?: Meta): void {
  emit("warn", scope, message, meta);
}

export function logError(scope: string, error: unknown, meta?: Meta): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  emit("error", scope, message, { ...(meta ?? {}), stack });
}

/** A friendly, non-technical message shown to the learner when something fails. */
export const FRIENDLY_ERROR = "عذراً، حدث خطأ مؤقّت. لنحاول مرة أخرى بعد لحظات. 🙏";
