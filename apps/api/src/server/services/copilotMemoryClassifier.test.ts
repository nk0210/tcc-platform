import { describe, it, expect } from "vitest";
import {
  sanitizeMemoryContent,
  normalizeMemoryContent,
  looksLikeSecret,
  classifyMemoryType,
  relevantMemoryTypesForMessage,
  detectExplicitMemoryCommand,
  findForgetCandidates,
  findConflictGroup,
  CONFLICT_AXES,
  MEMORY_CONTENT_MAX_LENGTH,
} from "./copilotMemoryClassifier";

describe("copilotMemoryClassifier — sanitize/normalize", () => {
  it("collapses whitespace and trims", () => {
    expect(sanitizeMemoryContent("  I   prefer\n\nconcise   answers  ")).toBe("I prefer concise answers");
  });

  it("truncates safely at the max length with an ellipsis", () => {
    const long = "a".repeat(MEMORY_CONTENT_MAX_LENGTH + 50);
    const result = sanitizeMemoryContent(long);
    expect(result.length).toBe(MEMORY_CONTENT_MAX_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });

  it("normalizes to lowercase on top of sanitization, for comparison only", () => {
    expect(normalizeMemoryContent("I Prefer XAUUSD")).toBe("i prefer xauusd");
  });
});

describe("copilotMemoryClassifier — secret-like content rejection", () => {
  it.each([
    "my api key is abc12345",
    "remember my password is hunter2ishunter2",
    "here's my private key: xyz",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PYRDsO",
    "AKIAABCDEFGHIJKLMNOP",
    "4111111111111111",
    "this-looks-like-a-long-random-token-abc123xyz789",
  ])("rejects: %s", (content) => {
    expect(looksLikeSecret(content)).toBe(true);
  });

  it.each([
    "I prefer trading XAUUSD in the London session",
    "I want to focus on risk management this month",
    "I prefer concise answers",
  ])("allows ordinary preference text: %s", (content) => {
    expect(looksLikeSecret(content)).toBe(false);
  });
});

describe("copilotMemoryClassifier — type classification", () => {
  it("classifies Copilot response-style requests as COPILOT_PREFERENCE", () => {
    expect(classifyMemoryType("I prefer concise answers")).toBe("COPILOT_PREFERENCE");
    expect(classifyMemoryType("please keep your explanations brief")).toBe("COPILOT_PREFERENCE");
  });

  it("classifies trading/instrument language as TRADING_PREFERENCE", () => {
    expect(classifyMemoryType("I prefer trading XAUUSD")).toBe("TRADING_PREFERENCE");
    expect(classifyMemoryType("I mostly trade the London session")).toBe("TRADING_PREFERENCE");
  });

  it("classifies goal language as GOAL", () => {
    expect(classifyMemoryType("my goal is to become a more disciplined trader")).toBe("GOAL");
  });

  it("classifies a bare preference verb with no other signal as PREFERENCE", () => {
    expect(classifyMemoryType("I like waking up early")).toBe("PREFERENCE");
  });

  it("falls back to EXPLICIT_FACT for a plain statement", () => {
    expect(classifyMemoryType("I am based in India")).toBe("EXPLICIT_FACT");
  });
});

describe("copilotMemoryClassifier — relevant types for a message", () => {
  it("always includes COPILOT_PREFERENCE, PREFERENCE, and EXPLICIT_FACT", () => {
    const types = relevantMemoryTypesForMessage("What's the weather like?");
    expect(types).toEqual(expect.arrayContaining(["COPILOT_PREFERENCE", "PREFERENCE", "EXPLICIT_FACT"]));
  });

  it("adds TRADING_PREFERENCE only when the message mentions trading-flavored terms", () => {
    expect(relevantMemoryTypesForMessage("how should I configure Copilot?")).not.toContain("TRADING_PREFERENCE");
    expect(relevantMemoryTypesForMessage("how's my risk on XAUUSD trades?")).toContain("TRADING_PREFERENCE");
  });

  it("(Phase 8) a TRADING module hint adds TRADING_PREFERENCE even with no keyword in the message", () => {
    expect(relevantMemoryTypesForMessage("how am I doing?")).not.toContain("TRADING_PREFERENCE");
    expect(relevantMemoryTypesForMessage("how am I doing?", "TRADING")).toContain("TRADING_PREFERENCE");
  });

  it("(Phase 8) an unrecognized or absent module never changes the result", () => {
    const base = relevantMemoryTypesForMessage("how am I doing?");
    expect(relevantMemoryTypesForMessage("how am I doing?", null)).toEqual(base);
    expect(relevantMemoryTypesForMessage("how am I doing?", "ACADEMY")).toEqual(base);
  });
});

describe("copilotMemoryClassifier — explicit command detection", () => {
  it("detects a clean remember command and extracts its content", () => {
    expect(detectExplicitMemoryCommand("Remember that I prefer XAUUSD")).toEqual({
      kind: "remember", content: "I prefer XAUUSD",
    });
  });

  it("detects a clean forget command and extracts its subject", () => {
    expect(detectExplicitMemoryCommand("Forget that I prefer XAUUSD")).toEqual({
      kind: "forget", subject: "I prefer XAUUSD",
    });
  });

  it("recognizes a few common phrasings", () => {
    expect(detectExplicitMemoryCommand("please remember I want to focus on risk management")).toMatchObject({ kind: "remember" });
    expect(detectExplicitMemoryCommand("could you remember that I like concise answers")).toMatchObject({ kind: "remember" });
    expect(detectExplicitMemoryCommand("stop remembering that I prefer XAUUSD")).toMatchObject({ kind: "forget" });
  });

  it("returns null for an ordinary question, even one containing the word 'remember'", () => {
    expect(detectExplicitMemoryCommand("Do you remember what my win rate was last month?")).toBeNull();
  });

  it("returns null for a compound request (contains a question mark)", () => {
    expect(detectExplicitMemoryCommand("Remember that I prefer XAUUSD, and how's my P&L?")).toBeNull();
  });

  it("returns null for an unrelated message", () => {
    expect(detectExplicitMemoryCommand("Analyze my trading performance this month")).toBeNull();
  });
});

describe("copilotMemoryClassifier — forget target resolution", () => {
  const memories = [
    { normalizedContent: "i prefer xauusd" },
    { normalizedContent: "i prefer concise answers" },
  ];

  it("resolves an unambiguous single match", () => {
    const candidates = findForgetCandidates("that I prefer XAUUSD", memories);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].normalizedContent).toBe("i prefer xauusd");
  });

  it("returns no candidates for a subject that doesn't overlap with anything saved", () => {
    expect(findForgetCandidates("my favorite pizza topping", memories)).toHaveLength(0);
  });
});

describe("copilotMemoryClassifier — conflict axes", () => {
  it("recognizes the COPILOT_PREFERENCE response-length axis as opposing groups", () => {
    const axis = CONFLICT_AXES.find((a) => a.type === "COPILOT_PREFERENCE")!;
    const conciseGroup  = findConflictGroup(axis, "i prefer concise answers");
    const detailedGroup = findConflictGroup(axis, "i now prefer detailed explanations");
    expect(conciseGroup).not.toBeNull();
    expect(detailedGroup).not.toBeNull();
    expect(conciseGroup).not.toBe(detailedGroup);
  });

  it("does not treat two unrelated statements as being on any axis", () => {
    const axis = CONFLICT_AXES.find((a) => a.type === "COPILOT_PREFERENCE")!;
    expect(findConflictGroup(axis, "i like emojis in responses")).toBeNull();
  });
});
