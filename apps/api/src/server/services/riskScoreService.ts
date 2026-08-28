/**
 * Risk Score Service
 * Analyzes a user's trading history (Trade + JournalEntry tables — no new
 * models) and produces a composite risk profile. All business logic lives
 * here; it only reads through analyticsService/tradeRepository/journalRepository
 * and profileRepository/communityFollowRepository (for the handle-gated variant).
 */
import { analyticsService }          from "./analyticsService";
import { tradeRepository }           from "../repositories/tradeRepository";
import { journalRepository }         from "../repositories/journalRepository";
import { profileRepository }         from "../repositories/profileRepository";
import { communityFollowRepository } from "../repositories/communityFollowRepository";

const NEGATIVE_EMOTIONS = new Set(["fearful", "greedy", "angry", "anxious"]);
const MIN_TRADES_FOR_SCORE = 10;

export interface RiskScoreResult {
  overall:  number;
  grade:    "A" | "B" | "C" | "D" | "F";
  components: {
    drawdownRisk:     number;
    consistencyRisk:  number;
    positionSizeRisk: number;
    emotionalRisk:    number;
    overTradingRisk:  number;
  };
  insights:        string[];
  recommendations: string[];
  tradesAnalyzed:  number;
  periodDays:      number;
  calculatedAt:    string;
}

// ── Errors (handle-gated lookup) ────────────────────────────────────────────

export class TargetUserNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("USER_NOT_FOUND"); }
}
export class PortfolioNotPublicError extends Error {
  statusCode = 403;
  constructor() { super("PORTFOLIO_NOT_PUBLIC"); }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(Math.max(n, min), max);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function gradeFor(overall: number): RiskScoreResult["grade"] {
  if (overall < 20) return "A";
  if (overall < 40) return "B";
  if (overall < 60) return "C";
  if (overall < 80) return "D";
  return "F";
}

function periodDaysFor(trades: { closedAt: Date | null }[]): number {
  const timestamps = trades.map((t) => t.closedAt?.getTime()).filter((t): t is number => t != null);
  if (timestamps.length === 0) return 0;
  const spanMs = Math.max(...timestamps) - Math.min(...timestamps);
  return Math.max(1, Math.round(spanMs / 86400000));
}

// ── Score calculation ────────────────────────────────────────────────────

async function calculateRiskScore(userId: string): Promise<RiskScoreResult> {
  const closedTrades = await tradeRepository.findAllClosedByUserId(userId);

  if (closedTrades.length < MIN_TRADES_FOR_SCORE) {
    return {
      overall: 0,
      grade:   "A",
      components: {
        drawdownRisk:     0,
        consistencyRisk:  0,
        positionSizeRisk: 0,
        emotionalRisk:    0,
        overTradingRisk:  0,
      },
      insights:        ["Not enough trades to calculate risk score — trade at least 10 times"],
      recommendations: ["Complete at least 10 paper trades to unlock your full risk profile"],
      tradesAnalyzed:  closedTrades.length,
      periodDays:      periodDaysFor(closedTrades),
      calculatedAt:    new Date().toISOString(),
    };
  }

  const [overview, dailyStats, journalEntries] = await Promise.all([
    analyticsService.getOverview(userId),
    analyticsService.getDailyStats(userId),
    journalRepository.findAllByUserId(userId),
  ]);

  const insights: string[] = [];

  // ── Drawdown risk ─────────────────────────────────────────────────────
  const drawdownRisk = clamp(overview.maxDrawdownPercent * 2.5);
  if (drawdownRisk > 60) {
    insights.push("Your maximum drawdown exceeds 24% — consider reducing position sizes");
  }

  // ── Consistency risk (std dev of daily P&L) ─────────────────────────────
  const dailyStdDev = stdDev(dailyStats.map((d) => d.pnl));
  let consistencyRisk: number;
  if (dailyStdDev < 50)        consistencyRisk = 0;
  else if (dailyStdDev > 500)  consistencyRisk = 100;
  else                         consistencyRisk = ((dailyStdDev - 50) / (500 - 50)) * 100;
  consistencyRisk = clamp(consistencyRisk);
  if (consistencyRisk > 60) {
    insights.push("High variance in daily P&L suggests inconsistent trading behavior");
  }

  // ── Position size risk ────────────────────────────────────────────────
  const lotSizes    = closedTrades.map((t) => t.lotSize);
  const avgLotSize  = lotSizes.reduce((s, v) => s + v, 0) / lotSizes.length;
  const maxLotSize  = Math.max(...lotSizes);
  let positionSizeRisk: number;
  if (maxLotSize > avgLotSize * 3)      positionSizeRisk = 80;
  else if (maxLotSize > avgLotSize * 2) positionSizeRisk = 50;
  else                                  positionSizeRisk = 20;
  if (positionSizeRisk > 60) {
    insights.push("Some positions are significantly larger than your average — inconsistent sizing detected");
  }

  // ── Emotional risk ─────────────────────────────────────────────────────
  let emotionalRisk = 0;
  if (journalEntries.length > 0) {
    const unplannedCount       = journalEntries.filter((e) => e.followedPlan === false).length;
    const negativeEmotionCount = journalEntries.filter((e) => NEGATIVE_EMOTIONS.has((e.emotion ?? "").toLowerCase())).length;
    emotionalRisk = clamp(
      (unplannedCount / journalEntries.length) * 60 +
      (negativeEmotionCount / journalEntries.length) * 40
    );
  }
  if (emotionalRisk > 60) {
    insights.push("You frequently deviate from your plan — emotional trading detected");
  }

  // ── Over-trading risk ────────────────────────────────────────────────────
  const activeDays  = dailyStats.length;
  const totalTrades = dailyStats.reduce((s, d) => s + d.trades, 0);
  const avgTradesPerActiveDay = activeDays > 0 ? totalTrades / activeDays : 0;
  let overTradingRisk: number;
  if (avgTradesPerActiveDay > 10)      overTradingRisk = 80;
  else if (avgTradesPerActiveDay > 5)  overTradingRisk = 50;
  else                                 overTradingRisk = 20;
  if (overTradingRisk > 60) {
    insights.push("High daily trade frequency detected — consider quality over quantity");
  }

  const overall = clamp(
    drawdownRisk    * 0.30 +
    consistencyRisk * 0.20 +
    positionSizeRisk * 0.20 +
    emotionalRisk   * 0.15 +
    overTradingRisk * 0.15
  );
  const grade = gradeFor(overall);

  const recommendations: string[] = [
    "Use the TCC Pre-Trade Checklist before every entry",
    "Review your journal weekly to identify behavioral patterns",
  ];
  if (drawdownRisk > 60)     recommendations.push("Reduce position sizes until your drawdown stabilizes below 20%");
  if (consistencyRisk > 60)  recommendations.push("Set a daily loss limit and stop trading once it's hit");
  if (positionSizeRisk > 60) recommendations.push("Standardize your position sizing using a fixed % risk model");
  if (emotionalRisk > 60)    recommendations.push("Pause trading after a loss until you've completed a cooldown routine");
  if (overTradingRisk > 60)  recommendations.push("Cap your maximum trades per day and stick to it");

  if (insights.length === 0) {
    insights.push("Your trading shows a healthy risk profile across all measured dimensions");
  }

  return {
    overall: round(overall),
    grade,
    components: {
      drawdownRisk:     round(drawdownRisk),
      consistencyRisk:  round(consistencyRisk),
      positionSizeRisk: round(positionSizeRisk),
      emotionalRisk:    round(emotionalRisk),
      overTradingRisk:  round(overTradingRisk),
    },
    insights:        insights.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
    tradesAnalyzed:  closedTrades.length,
    periodDays:      periodDaysFor(closedTrades),
    calculatedAt:    new Date().toISOString(),
  };
}

// ── Handle-gated variant (mirrors profileService's portfolioVisibility gate) ─

async function calculateRiskScoreForHandle(handle: string, viewerId?: string): Promise<RiskScoreResult> {
  const user = await profileRepository.findByHandle(handle);
  if (!user || !user.isActive) throw new TargetUserNotFoundError();

  const isSelf = viewerId === user.id;
  if (!isSelf && user.portfolioVisibility !== "PUBLIC") {
    const isFollowing =
      user.portfolioVisibility === "FOLLOWERS_ONLY" && viewerId
        ? await communityFollowRepository.isFollowing(viewerId, user.id)
        : false;
    if (!isFollowing) throw new PortfolioNotPublicError();
  }

  return calculateRiskScore(user.id);
}

export const riskScoreService = {
  calculateRiskScore,
  calculateRiskScoreForHandle,
};
