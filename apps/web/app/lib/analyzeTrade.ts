export async function analyzeTrade(trade: {
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice?: number;
  lots: number;
  pnl?: number;
  emotion: string;
  confidenceLevel: number;
  stressLevel: number;
  entryQuality: string;
  followedPlan: boolean | null;
  strategy: string;
  marketStructure: string;
  session: string;
  timeframe: string;
  notes: string;
  whatWentRight: string;
  whatWentWrong: string;
  lessonLearned: string;
  tags: string[];
}) {
  const prompt = `You are an expert trading coach analyzing a trader's journal entry. Be concise, direct, and actionable.

Trade Details:
- Symbol: ${trade.symbol} | Direction: ${trade.direction}
- Entry: $${trade.entryPrice} ${trade.exitPrice ? `| Exit: $${trade.exitPrice}` : "(still open)"}
- Lots: ${trade.lots} | Session: ${trade.session} | Timeframe: ${trade.timeframe}
${trade.pnl !== undefined ? `- P&L: $${trade.pnl}` : ""}

Strategy & Setup:
- Strategy: ${trade.strategy}
- Market Structure: ${trade.marketStructure}
- Entry Quality: ${trade.entryQuality}
- Followed Plan: ${trade.followedPlan === null ? "Not specified" : trade.followedPlan ? "Yes" : "No"}

Psychology:
- Emotion: ${trade.emotion}
- Confidence: ${trade.confidenceLevel}/10
- Stress: ${trade.stressLevel}/10

Trader's Notes:
- General: ${trade.notes || "None"}
- What went right: ${trade.whatWentRight || "None"}
- What went wrong: ${trade.whatWentWrong || "None"}
- Lesson: ${trade.lessonLearned || "None"}
- Auto Tags: ${trade.tags.join(", ") || "None"}

Provide exactly:
1. Key Observation (1 sentence)
2. Specific Improvement (1 sentence)
3. Discipline Score: X/10 (with one reason)`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: "You are an expert trading coach. Be concise, direct, and actionable. Always follow the exact format requested."
          },
          {
            role: "user",
            content: prompt
          }
        ],
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    return "AI analysis unavailable. Please try again.";
  }
}

export function autoTag(trade: {
  emotion: string;
  lots: number;
  pnl?: number;
  notes: string;
  strategy?: string;
  entryQuality?: string;
  followedPlan?: boolean | null;
  session?: string;
}): string[] {
  const tags: string[] = [];

  if (trade.emotion === "fearful") tags.push("fear-based");
  if (trade.emotion === "greedy") tags.push("greed-based");
  if (trade.emotion === "frustrated") tags.push("revenge-trade");
  if (trade.emotion === "hesitant") tags.push("hesitation");
  if (trade.lots >= 0.5) tags.push("high-volume");
  if (trade.pnl !== undefined && trade.pnl > 0) tags.push("winner");
  if (trade.pnl !== undefined && trade.pnl < 0) tags.push("loser");
  if (trade.strategy) tags.push(trade.strategy);
  if (trade.entryQuality === "early") tags.push("early-entry");
  if (trade.entryQuality === "late") tags.push("late-entry");
  if (trade.entryQuality === "impulsive") tags.push("impulsive");
  if (trade.followedPlan === false) tags.push("rule-break");
  if (trade.session === "london") tags.push("london-session");
  if (trade.session === "newyork") tags.push("ny-session");
  if (trade.session === "asian") tags.push("asian-session");
  if (trade.notes.toLowerCase().includes("news")) tags.push("news-trade");
  if (trade.notes.toLowerCase().includes("breakout")) tags.push("breakout");
  if (trade.notes.toLowerCase().includes("reversal")) tags.push("reversal");
  if (trade.notes.toLowerCase().includes("scalp")) tags.push("scalp");

  return tags;
}