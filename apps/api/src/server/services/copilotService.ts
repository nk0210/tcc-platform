/**
 * Copilot Service
 * TCC Copilot — an AI trading assistant backed by Groq for fast LLM
 * inference. All prompt construction and Groq calls live here.
 */
import Groq from "groq-sdk";
import { buildUserContext }  from "./copilotContextService";
import { journalRepository } from "../repositories/journalRepository";

// llama-3.1-8b-instant was retired from Groq's catalog; gpt-oss-20b is its
// current fastest small-model equivalent. It's a reasoning model, so
// reasoning_effort is pinned to "low" below to keep latency/response length
// predictable for a chat assistant instead of burning the token budget on
// internal reasoning before it ever emits `content`.
const MODEL = "openai/gpt-oss-20b";

export interface CopilotMessage {
  role:    "user" | "assistant";
  content: string;
}

export interface CopilotResponse {
  message:    string;
  tokensUsed: number;
  model:      string;
}

function getGroqClient(): Groq {
  const apiKey = process.env["GROQ_API_KEY"] ?? "";
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");
  return new Groq({ apiKey });
}

function buildSystemPrompt(userContext: string): string {
  return `You are TCC Copilot, an AI trading assistant built into The Cane & Co.
paper trading platform. You help traders improve their skills,
analyze their performance, and make better decisions.

IMPORTANT RULES:
- This is a PAPER TRADING platform. Never discuss real money or real broker execution.
- You have access to this trader's real paper trading data (shown below).
- Be concise and specific. Reference the trader's actual numbers.
- Never give financial advice or recommend real trades.
- Focus on education, discipline, and skill development.
- If asked about risk, always reference TCC's 1% risk rule.
- Keep responses under 300 words unless doing detailed analysis.

${userContext}`;
}

async function callGroq(systemPrompt: string, messages: CopilotMessage[]): Promise<CopilotResponse> {
  const groq = getGroqClient();

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const response = await groq.chat.completions.create({
    model:            MODEL,
    messages:         chatMessages as Groq.Chat.Completions.ChatCompletionMessageParam[],
    max_tokens:       500,
    temperature:      0.7,
    reasoning_effort: "low",
  });

  return {
    message:    response.choices[0]?.message?.content ?? "",
    tokensUsed: response.usage?.total_tokens ?? 0,
    model:      MODEL,
  };
}

// ── Chat ─────────────────────────────────────────────────────────────────

export async function chat(
  userId:               string,
  messages:             CopilotMessage[],
  conversationHistory:  CopilotMessage[]
): Promise<CopilotResponse> {
  const userContext  = await buildUserContext(userId);
  const systemPrompt = buildSystemPrompt(userContext);

  return callGroq(systemPrompt, [...conversationHistory.slice(-10), ...messages]);
}

// ── Journal analysis ─────────────────────────────────────────────────────

export async function analyzeJournal(userId: string): Promise<CopilotResponse> {
  const userContext  = await buildUserContext(userId);
  const systemPrompt = buildSystemPrompt(userContext);

  const allEntries = await journalRepository.findAllByUserId(userId);
  const recent      = allEntries.slice(-20);

  const entriesSummary = recent
    .map((e) =>
      `- ${e.symbol} ${e.side} | strategy: ${e.strategy} | result: ${e.result ?? "?"} | ` +
      `netPnl: ${e.netPnl ?? 0} | emotion: ${e.emotion} | followedPlan: ${e.followedPlan ?? "unknown"} | ` +
      `confidence: ${e.confidenceLevel} | stress: ${e.stressLevel}`
    )
    .join("\n");

  const prompt =
    `Analyze these ${recent.length} recent journal entries for this trader:\n\n${entriesSummary || "(no entries yet)"}\n\n` +
    `Based on this data:\n` +
    `1. Identify emotional patterns\n` +
    `2. Identify which strategies performed best\n` +
    `3. Identify the biggest behavioral mistake\n` +
    `4. Give 3 specific improvement recommendations`;

  return callGroq(systemPrompt, [{ role: "user", content: prompt }]);
}

// ── Analytics interpretation ─────────────────────────────────────────────

export async function interpretAnalytics(userId: string): Promise<CopilotResponse> {
  const userContext  = await buildUserContext(userId);
  const systemPrompt = buildSystemPrompt(userContext);

  const prompt =
    `Interpret this trader's performance numbers (shown in the context above) in plain English:\n` +
    `1. What the win rate means for this trader\n` +
    `2. Whether the profit factor is sustainable\n` +
    `3. What the risk score implies\n` +
    `4. The single most important thing to improve`;

  return callGroq(systemPrompt, [{ role: "user", content: prompt }]);
}

export const copilotService = { chat, analyzeJournal, interpretAnalytics };
