import { create } from "zustand";
import { useTradeStore } from "./tradeStore";
import { useJournalStore } from "./journalStore";

export interface RiskFactor {
  label: string;
  score: number;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface RiskScore {
  total: number;
  level: "LOW" | "MODERATE" | "HIGH" | "EXTREME";
  factors: RiskFactor[];
  recommendation: string;
}

export function calculateRiskScore(): RiskScore {
  const { positions, balance, equity, totalNetPnl, leverage } = useTradeStore.getState();
  const { entries } = useJournalStore.getState();
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // 1. Number of open positions
  if (positions.length >= 3) {
    factors.push({ label: "Too many positions", score: 20, reason: `${positions.length} positions open simultaneously`, severity: "high" });
    totalScore += 20;
  } else if (positions.length === 2) {
    factors.push({ label: "Multiple positions", score: 10, reason: "2 positions open", severity: "medium" });
    totalScore += 10;
  }

  // 2. Daily loss
  const dailyLossPct = totalNetPnl < 0 ? Math.abs(totalNetPnl / balance) * 100 : 0;
  if (dailyLossPct > 5) {
    factors.push({ label: "High daily loss", score: 25, reason: `Down ${dailyLossPct.toFixed(1)}% today`, severity: "high" });
    totalScore += 25;
  } else if (dailyLossPct > 2) {
    factors.push({ label: "Moderate daily loss", score: 12, reason: `Down ${dailyLossPct.toFixed(1)}% today`, severity: "medium" });
    totalScore += 12;
  }

  // 3. Leverage
  if (leverage >= 50) {
    factors.push({ label: "Extreme leverage", score: 20, reason: `Using 1:${leverage} leverage`, severity: "high" });
    totalScore += 20;
  } else if (leverage >= 20) {
    factors.push({ label: "High leverage", score: 10, reason: `Using 1:${leverage} leverage`, severity: "medium" });
    totalScore += 10;
  }

  // 4. Equity drawdown
  const drawdownPct = balance > 0 ? ((balance - equity) / balance) * 100 : 0;
  if (drawdownPct > 10) {
    factors.push({ label: "Large drawdown", score: 20, reason: `${drawdownPct.toFixed(1)}% drawdown on account`, severity: "high" });
    totalScore += 20;
  } else if (drawdownPct > 5) {
    factors.push({ label: "Moderate drawdown", score: 10, reason: `${drawdownPct.toFixed(1)}% drawdown`, severity: "medium" });
    totalScore += 10;
  }

  // 5. Revenge trading detection
  const recentEntries = entries.slice(0, 5);
  const recentLosses = recentEntries.filter(e => e.pnl !== undefined && e.pnl < 0).length;
  if (recentLosses >= 3) {
    factors.push({ label: "Revenge trading risk", score: 15, reason: `${recentLosses} losses in last 5 trades`, severity: "high" });
    totalScore += 15;
  } else if (recentLosses === 2) {
    factors.push({ label: "Loss streak", score: 8, reason: "2 consecutive losses detected", severity: "medium" });
    totalScore += 8;
  }

  // 6. Emotion check
  const latestEntry = entries[0];
  if (latestEntry) {
    if (latestEntry.emotion === "frustrated" || latestEntry.emotion === "greedy") {
      factors.push({ label: "Dangerous emotion", score: 15, reason: `Last trade emotion: ${latestEntry.emotion}`, severity: "high" });
      totalScore += 15;
    } else if (latestEntry.emotion === "fearful") {
      factors.push({ label: "Fear detected", score: 8, reason: "Trading while fearful", severity: "medium" });
      totalScore += 8;
    }
  }

  // 7. Followed plan check
  const recentRuleBreaks = recentEntries.filter(e => e.followedPlan === false).length;
  if (recentRuleBreaks >= 2) {
    factors.push({ label: "Rule violations", score: 10, reason: `${recentRuleBreaks} rule breaks in recent trades`, severity: "medium" });
    totalScore += 10;
  }

  // Cap at 100
  totalScore = Math.min(totalScore, 100);

  // Determine level
  let level: RiskScore["level"] = "LOW";
  let recommendation = "Conditions look good. Trade with your plan.";
  if (totalScore >= 75) {
    level = "EXTREME";
    recommendation = "Stop trading immediately. Review your positions and emotions.";
  } else if (totalScore >= 50) {
    level = "HIGH";
    recommendation = "High risk detected. Reduce position sizes and review your plan.";
  } else if (totalScore >= 25) {
    level = "MODERATE";
    recommendation = "Moderate risk. Proceed carefully and stick to your rules.";
  }

  return { total: totalScore, level, factors, recommendation };
}

interface RiskStore {
  riskScore: RiskScore;
  refresh: () => void;
}

export const useRiskStore = create<RiskStore>((set) => ({
  riskScore: {
    total: 0,
    level: "LOW",
    factors: [],
    recommendation: "Place a trade to calculate risk score.",
  },
  refresh: () => set({ riskScore: calculateRiskScore() }),
}));