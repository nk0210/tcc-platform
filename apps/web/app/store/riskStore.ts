import { useTradeStore } from "@/store/tradeStore";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface RiskScore {
  total: number;
  level: RiskLevel;
  factors: { name: string; score: number; description: string }[];
  recommendation: string;
}

export function calculateRiskScore(): RiskScore {
  const { positions, balance, equity, marginLevel } = useTradeStore.getState();
  const factors: { name: string; score: number; description: string }[] = [];

  // Factor 1: Number of open positions
  if (positions.length >= 5) factors.push({ name: "Overtrading", score: 20, description: "5+ open positions simultaneously" });
  else if (positions.length >= 3) factors.push({ name: "Multiple positions", score: 10, description: "3+ open positions" });

  // Factor 2: Total floating loss
  const floatingPnl = positions.reduce((sum, p) => sum + p.netPnl, 0);
  const floatingPct = (Math.abs(Math.min(floatingPnl, 0)) / balance) * 100;
  if (floatingPct >= 5) factors.push({ name: "Large floating loss", score: 25, description: `${floatingPct.toFixed(1)}% floating loss` });
  else if (floatingPct >= 2) factors.push({ name: "Floating loss", score: 10, description: `${floatingPct.toFixed(1)}% floating loss` });

  // Factor 3: Margin level
  if (marginLevel > 0 && marginLevel < 150) factors.push({ name: "Critical margin", score: 30, description: `Margin level at ${marginLevel}%` });
  else if (marginLevel > 0 && marginLevel < 200) factors.push({ name: "Low margin level", score: 15, description: `Margin level at ${marginLevel}%` });

  // Factor 4: No stop loss
  const noSL = positions.filter(p => !p.sl || p.sl === 0).length;
  if (noSL > 0) factors.push({ name: "Missing stop loss", score: noSL * 10, description: `${noSL} position(s) without SL` });

  // Factor 5: Equity drawdown
  const drawdown = ((balance - equity) / balance) * 100;
  if (drawdown >= 10) factors.push({ name: "High drawdown", score: 20, description: `${drawdown.toFixed(1)}% equity drawdown` });
  else if (drawdown >= 5) factors.push({ name: "Drawdown warning", score: 10, description: `${drawdown.toFixed(1)}% equity drawdown` });

  const total = Math.min(factors.reduce((sum, f) => sum + f.score, 0), 100);

  let level: RiskLevel = "LOW";
  let recommendation = "Risk is well controlled. Keep following your plan.";

  if (total >= 75) {
    level = "EXTREME";
    recommendation = "EXTREME RISK: Stop trading immediately. Close positions and review your risk management.";
  } else if (total >= 50) {
    level = "HIGH";
    recommendation = "HIGH RISK: Reduce exposure. Consider closing losing positions and tightening SL.";
  } else if (total >= 25) {
    level = "MEDIUM";
    recommendation = "MEDIUM RISK: Monitor closely. Avoid opening new positions until risk reduces.";
  }

  return { total, level, factors, recommendation };
}