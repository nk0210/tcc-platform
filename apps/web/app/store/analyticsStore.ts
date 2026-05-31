import { create } from "zustand";
import { useJournalStore } from "@/store/journalStore";

export interface EquityPoint {
  time: string;
  equity: number;
}

export interface SessionBreakdown {
  session: string;
  trades: number;
  wins: number;
  winRate: number;
  pnl: number;
}

export interface StrategyBreakdown {
  strategy: string;
  trades: number;
  wins: number;
  winRate: number;
  pnl: number;
}

export interface EmotionBreakdown {
  emotion: string;
  trades: number;
  wins: number;
  winRate: number;
  pnl: number;
}

export interface AnalyticsData {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  profitFactor: number;
  avgRR: number;
  totalPnl: number;
  maxDrawdown: number;
  currentStreak: number;
  streakType: "win" | "loss";
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  equityCurve: EquityPoint[];
  sessionBreakdown: SessionBreakdown[];
  strategyBreakdown: StrategyBreakdown[];
  emotionBreakdown: EmotionBreakdown[];
}

export function calculateAnalytics(): AnalyticsData {
  const entries = useJournalStore.getState().entries.filter(
    (e) => e.pnl !== undefined
  );

  const empty: AnalyticsData = {
    totalTrades: 0,
    winRate: 0,
    lossRate: 0,
    profitFactor: 0,
    avgRR: 0,
    totalPnl: 0,
    maxDrawdown: 0,
    currentStreak: 0,
    streakType: "win",
    avgWin: 0,
    avgLoss: 0,
    bestTrade: 0,
    worstTrade: 0,
    equityCurve: [{ time: "Start", equity: 10000 }],
    sessionBreakdown: [],
    strategyBreakdown: [],
    emotionBreakdown: [],
  };

  if (entries.length === 0) return empty;

  // Sort by timestamp ascending
  const sorted = [...entries].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const totalTrades = sorted.length;
  const wins = sorted.filter(e => (e.pnl || 0) > 0);
  const losses = sorted.filter(e => (e.pnl || 0) <= 0);
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const lossRate = 100 - winRate;

  const grossProfit = wins.reduce((sum, e) => sum + (e.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, e) => sum + (e.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : wins.length > 0 ? 999 : 0;

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const totalPnl = sorted.reduce((sum, e) => sum + (e.pnl || 0), 0);

  const validRR = sorted.filter(e => e.rrRatio && e.rrRatio > 0);
  const avgRR = validRR.length > 0
    ? validRR.reduce((sum, e) => sum + (e.rrRatio || 0), 0) / validRR.length
    : 0;

  const bestTrade = Math.max(...sorted.map(e => e.pnl || 0));
  const worstTrade = Math.min(...sorted.map(e => e.pnl || 0));

  // Equity curve
  let equity = 10000;
  const equityCurve: EquityPoint[] = [{ time: "Start", equity }];
  let peak = equity;
  let maxDrawdown = 0;
  sorted.forEach(e => {
    equity += e.pnl || 0;
    const dd = ((peak - equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (equity > peak) peak = equity;
    const date = new Date(e.timestamp || Date.now());
    equityCurve.push({
      time: date.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" }),
      equity: parseFloat(equity.toFixed(2)),
    });
  });

  // Streak
  let currentStreak = 0;
  let streakType: "win" | "loss" = "win";
  for (let i = sorted.length - 1; i >= 0; i--) {
    const pnl = sorted[i].pnl || 0;
    if (i === sorted.length - 1) {
      streakType = pnl > 0 ? "win" : "loss";
      currentStreak = 1;
    } else {
      const isWin = pnl > 0;
      if ((isWin && streakType === "win") || (!isWin && streakType === "loss")) {
        currentStreak++;
      } else break;
    }
  }

  // Session breakdown
  const sessionMap: Record<string, { trades: number; wins: number; pnl: number }> = {};
  sorted.forEach(e => {
    if (!sessionMap[e.session]) sessionMap[e.session] = { trades: 0, wins: 0, pnl: 0 };
    sessionMap[e.session].trades++;
    if ((e.pnl || 0) > 0) sessionMap[e.session].wins++;
    sessionMap[e.session].pnl += e.pnl || 0;
  });
  const sessionBreakdown: SessionBreakdown[] = Object.entries(sessionMap).map(([session, d]) => ({
    session,
    trades: d.trades,
    wins: d.wins,
    winRate: (d.wins / d.trades) * 100,
    pnl: parseFloat(d.pnl.toFixed(2)),
  }));

  // Strategy breakdown
  const strategyMap: Record<string, { trades: number; wins: number; pnl: number }> = {};
  sorted.forEach(e => {
    const k = e.strategy || "other";
    if (!strategyMap[k]) strategyMap[k] = { trades: 0, wins: 0, pnl: 0 };
    strategyMap[k].trades++;
    if ((e.pnl || 0) > 0) strategyMap[k].wins++;
    strategyMap[k].pnl += e.pnl || 0;
  });
  const strategyBreakdown: StrategyBreakdown[] = Object.entries(strategyMap).map(([strategy, d]) => ({
    strategy,
    trades: d.trades,
    wins: d.wins,
    winRate: (d.wins / d.trades) * 100,
    pnl: parseFloat(d.pnl.toFixed(2)),
  }));

  // Emotion breakdown
  const emotionMap: Record<string, { trades: number; wins: number; pnl: number }> = {};
  sorted.forEach(e => {
    const k = e.emotion || "neutral";
    if (!emotionMap[k]) emotionMap[k] = { trades: 0, wins: 0, pnl: 0 };
    emotionMap[k].trades++;
    if ((e.pnl || 0) > 0) emotionMap[k].wins++;
    emotionMap[k].pnl += e.pnl || 0;
  });
  const emotionBreakdown: EmotionBreakdown[] = Object.entries(emotionMap).map(([emotion, d]) => ({
    emotion,
    trades: d.trades,
    wins: d.wins,
    winRate: (d.wins / d.trades) * 100,
    pnl: parseFloat(d.pnl.toFixed(2)),
  }));

  return {
    totalTrades,
    winRate: parseFloat(winRate.toFixed(1)),
    lossRate: parseFloat(lossRate.toFixed(1)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    avgRR: parseFloat(avgRR.toFixed(2)),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    currentStreak,
    streakType,
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    bestTrade: parseFloat(bestTrade.toFixed(2)),
    worstTrade: parseFloat(worstTrade.toFixed(2)),
    equityCurve,
    sessionBreakdown,
    strategyBreakdown,
    emotionBreakdown,
  };
}

interface AnalyticsStore {
  data: AnalyticsData | null;
  refresh: () => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  data: null,
  refresh: () => {
    set({ data: calculateAnalytics() });
  },
}));