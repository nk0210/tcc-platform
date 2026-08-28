/**
 * Copilot Context Service
 * Builds the concise trader-context text block injected into every Copilot
 * system prompt. No new data — reassembles existing trade/analytics/risk/
 * journal data into a compact summary suitable for an LLM prompt.
 */
import { tradeService }      from "./tradeService";
import { analyticsService }  from "./analyticsService";
import { riskScoreService }  from "./riskScoreService";
import { tradeRepository }   from "../repositories/tradeRepository";
import { journalRepository } from "../repositories/journalRepository";

function fmtMoney(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function timeAgo(date: Date | null): string {
  if (!date) return "unknown time";
  const diffMs = Date.now() - date.getTime();
  const hours  = Math.floor(diffMs / 3_600_000);
  if (hours < 1)  return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export async function buildUserContext(userId: string): Promise<string> {
  const [account, overview, riskScore, recentClosed, openPositions, recentJournal] = await Promise.all([
    tradeService.getAccountState(userId),
    analyticsService.getOverview(userId),
    riskScoreService.calculateRiskScore(userId),
    tradeRepository.findClosedByUserId(userId, { page: 1, pageSize: 5 }),
    tradeService.getOpenPositions(userId),
    journalRepository.findByUserId(userId, { page: 1, pageSize: 3 }),
  ]);

  const lines: string[] = [];

  lines.push("TRADER CONTEXT (TCC Paper Trading Platform):");
  lines.push(`Balance: $${account.balance.toFixed(2)} | Equity: $${account.equity.toFixed(2)}`);
  lines.push(
    `Performance: ${overview.totalTrades} trades | ${overview.winRate}% win rate | ` +
    `PF ${overview.profitFactor} | Net P&L ${fmtMoney(overview.totalNetPnl)} | avg RR ${overview.avgRR}`
  );

  const riskLine = riskScore.tradesAnalyzed < 10
    ? "Risk Score: not enough trades yet to calculate"
    : `Risk Score: ${riskScore.overall}/100 (Grade ${riskScore.grade})${riskScore.insights[0] ? ` — ${riskScore.insights[0]}` : ""}`;
  lines.push(riskLine);
  lines.push(`Open positions: ${openPositions.length}`);

  if (recentClosed.items.length > 0) {
    lines.push("");
    lines.push("Recent trades (last 5):");
    for (const t of recentClosed.items) {
      lines.push(`- ${t.symbol} ${t.side} ${fmtMoney(t.netPnl ?? 0)} ${t.result ?? "?"} (${timeAgo(t.closedAt)})`);
    }
  }

  if (recentJournal.items.length > 0) {
    lines.push("");
    lines.push("Recent journal notes:");
    for (const j of recentJournal.items) {
      const followed = j.followedPlan === true ? "Yes" : j.followedPlan === false ? "No" : "Unknown";
      lines.push(`- Followed plan: ${followed} | Emotion: ${j.emotion} | Lesson: ${j.lessonLearned || "—"}`);
    }
  }

  return lines.join("\n");
}
