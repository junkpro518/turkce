import { describe, expect, it } from "vitest";
import { splitMessage } from "../../lib/telegram/split";

describe("splitMessage", () => {
  it("returns the text unchanged when within the limit", () => {
    expect(splitMessage("hello", 4096)).toEqual(["hello"]);
  });

  it("never drops content: parts concatenate back to the original", () => {
    const long = "a".repeat(5000);
    const parts = splitMessage(long, 4096);
    expect(parts.join("")).toBe(long);
    expect(parts.every((p) => p.length <= 4096)).toBe(true);
    expect(parts.length).toBe(2);
  });

  it("prefers a newline boundary within the limit", () => {
    const text = "x".repeat(4000) + "\n" + "y".repeat(300);
    const parts = splitMessage(text, 4096);
    expect(parts.join("")).toBe(text);
    expect(parts[0]!.length).toBeLessThanOrEqual(4096);
    expect(parts[0]!.endsWith("\n")).toBe(true);
  });

  it("hard-splits a single over-long token with no break", () => {
    const text = "z".repeat(9000);
    const parts = splitMessage(text, 4096);
    expect(parts.join("")).toBe(text);
    expect(parts.every((p) => p.length <= 4096)).toBe(true);
    expect(parts.length).toBe(3);
  });
});
