/**
 * TCC Risk Score Calculator
 *
 * Calculates risk score from REAL open position state.
 * No fake scores. If no positions, risk is 0 / LOW.
 */
import { useTradeStore, PaperPosition } from "@/store/tradeStore";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";

export interface RiskFactor {
  name: string;
  score: number;
  description: string;
  severity: "info" | "warning" | "danger";
}

export interface RiskScore {
  total: number;      // 0-100
  level: RiskLevel;
  factors: RiskFactor[];
  recommendation: string;
  openPositions: number;
  marginLevel: number;
}

export function calculateRiskScore(): RiskScore {
  const { positions, balance, equity, marginLevel, floatingPnl } = useTradeStore.getState();
  const factors: RiskFactor[] = [];

  // ── Factor 1: Number of open positions ──────────────────────────────
  if (positions.length >= 6) {
    factors.push({ name: "Overtrading", score: 25, description: `${positions.length} positions open simultaneously`, severity: "danger" });
  } else if (positions.length >= 4) {
    factors.push({ name: "Multiple positions", score: 15, description: `${positions.length} positions open at once`, severity: "warning" });
  } else if (positions.length >= 2) {
    factors.push({ name: "Concurrent positions", score: 5, description: `${positions.length} positions open`, severity: "info" });
  }

  // ── Factor 2: Floating loss ──────────────────────────────────────────
  if (floatingPnl < 0 && balance > 0) {
    const lossPercent = (Math.abs(floatingPnl) / balance) * 100;
    if (lossPercent >= 10) {
      factors.push({ name: "Large floating loss", score: 30, description: `${lossPercent.toFixed(1)}% floating loss on balance`, severity: "danger" });
    } else if (lossPercent >= 5) {
      factors.push({ name: "Floating loss warning", score: 15, description: `${lossPercent.toFixed(1)}% floating loss`, severity: "warning" });
    } else if (lossPercent >= 2) {
      factors.push({ name: "Floating loss", score: 5, description: `${lossPercent.toFixed(1)}% floating loss`, severity: "info" });
    }
  }

  // ── Factor 3: Margin level ───────────────────────────────────────────
  if (marginLevel > 0 && marginLevel < 150) {
    factors.push({ name: "Critical margin level", score: 35, description: `Margin level at ${marginLevel.toFixed(0)}% — margin call risk`, severity: "danger" });
  } else if (marginLevel > 0 && marginLevel < 200) {
    factors.push({ name: "Low margin level", score: 15, description: `Margin level at ${marginLevel.toFixed(0)}%`, severity: "warning" });
  } else if (marginLevel > 0 && marginLevel < 300) {
    factors.push({ name: "Moderate margin usage", score: 5, description: `Margin level at ${marginLevel.toFixed(0)}%`, severity: "info" });
  }

  // ── Factor 4: Missing stop losses ────────────────────────────────────
  const noSLPositions = positions.filter((p: PaperPosition) => !p.sl);
  if (noSLPositions.length > 0) {
    const score = Math.min(noSLPositions.length * 10, 25);
    factors.push({
      name: "No stop loss",
      score,
      description: `${noSLPositions.length} position${noSLPositions.length > 1 ? "s" : ""} without stop loss`,
      severity: noSLPositions.length >= 2 ? "danger" : "warning",
    });
  }

  // ── Factor 5: Equity drawdown from initial balance ───────────────────
  const initialBalance = 10000; // Paper starting balance
  if (equity < initialBalance) {
    const ddPct = ((initialBalance - equity) / initialBalance) * 100;
    if (ddPct >= 20) {
      factors.push({ name: "High drawdown", score: 20, description: `${ddPct.toFixed(1)}% drawdown from starting balance`, severity: "danger" });
    } else if (ddPct >= 10) {
      factors.push({ name: "Drawdown warning", score: 10, description: `${ddPct.toFixed(1)}% drawdown from starting balance`, severity: "warning" });
    }
  }

  // ── Factor 6: Large single position ─────────────────────────────────
  const maxPositionNotional = Math.max(...positions.map((p: PaperPosition) => p.notionalValue), 0);
  if (maxPositionNotional > equity * 0.5 && equity > 0) {
    factors.push({ name: "Oversized position", score: 15, description: "Single position > 50% of equity", severity: "danger" });
  }

  const total = Math.min(
    factors.reduce((sum, f) => sum + f.score, 0),
    100
  );

  let level: RiskLevel = "LOW";
  let recommendation = "Risk is well controlled. Keep following your plan.";

  if (total >= 75) {
    level = "EXTREME";
    recommendation = "EXTREME RISK: Stop trading immediately. Close positions and review your risk management.";
  } else if (total >= 50) {
    level = "HIGH";
    recommendation = "HIGH RISK: Reduce exposure. Close losing positions and review stop losses.";
  } else if (total >= 25) {
    level = "MEDIUM";
    recommendation = "MEDIUM RISK: Monitor closely. Consider tightening stop losses.";
  }

  return { total, level, factors, recommendation, openPositions: positions.length, marginLevel };
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "LOW": return "text-green-400";
    case "MEDIUM": return "text-amber-400";
    case "HIGH": return "text-orange-400";
    case "EXTREME": return "text-red-400";
  }
}

export function getRiskBg(level: RiskLevel): string {
  switch (level) {
    case "LOW": return "bg-green-500/10 border-green-500/20";
    case "MEDIUM": return "bg-amber-500/10 border-amber-500/20";
    case "HIGH": return "bg-orange-500/10 border-orange-500/20";
    case "EXTREME": return "bg-red-500/10 border-red-500/30";
  }
}