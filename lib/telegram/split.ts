// Pure message splitting for Telegram's 4096-char limit (FR-004). Splits on the last newline or
// space within the limit; hard-splits an over-long token. Concatenating the parts reproduces the
// original exactly — content is never dropped.

export const TELEGRAM_LIMIT = 4096;

export function splitMessage(text: string, limit = TELEGRAM_LIMIT): string[] {
  if (limit <= 0) throw new Error("limit must be positive");
  if (text.length <= limit) return text.length === 0 ? [""] : [text];

  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    // Prefer a newline, then a space, within [0, limit-1]; include the boundary char in this part.
    let cut = remaining.lastIndexOf("\n", limit - 1);
    if (cut <= 0) cut = remaining.lastIndexOf(" ", limit - 1);
    cut = cut <= 0 ? limit : cut + 1; // hard split if no break found
    parts.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining.length > 0) parts.push(remaining);
  return parts;
}
