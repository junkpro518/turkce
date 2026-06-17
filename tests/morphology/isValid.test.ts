import { describe, expect, it } from "vitest";
import { isValidText, isValidWord } from "../../lib/morphology";

// The analyzer loads a large dictionary on first use; allow generous time.
describe("morphology gate", () => {
  it("accepts valid Turkish words", { timeout: 60_000 }, () => {
    expect(isValidWord("kitap")).toBe(true);
    expect(isValidWord("okula")).toBe(true);
    expect(isValidWord("gidiyorum")).toBe(true);
    expect(isValidWord("okul")).toBe(true);
  });

  it("rejects garbage and empty input", () => {
    expect(isValidWord("xqzwk")).toBe(false);
    expect(isValidWord("")).toBe(false);
    expect(isValidWord("   ")).toBe(false);
  });

  it("validates whole phrases token-by-token", () => {
    expect(isValidText("Ben okula gidiyorum")).toBe(true);
    expect(isValidText("Ben xqzwk gidiyorum")).toBe(false);
  });

  it("ignores edge punctuation", () => {
    expect(isValidWord("kitap.")).toBe(true);
    expect(isValidWord("(okul)")).toBe(true);
  });
});
