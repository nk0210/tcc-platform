import { create } from "zustand";
import { useJournalStore } from "./journalStore";
import { useTradeStore } from "./tradeStore";

export interface AnalyticsData {
  totalTrades: number;
  winRate: number;
  lossRate: number;
  profitFactor: number;
  avgRR: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
  currentStreak: number;
  streakType: "win" | "loss" | "none";
  equityCurve: { time: string; equity: number }[];
  sessionBreakdown: {
    session: string;
    trades: number;
    winRate: number;
    pnl: number;
  }[];
  strategyBreakdown: {
    strategy: string;
    trades: number;
    winRate: number;
    pnl: number;
  }[];
  emotionBreakdown: {
    emotion: string;
    trades: number;
    winRate: number;
    pnl: number;
  }[];
  dayBreakdown: {
    day: string;
    trades: number;
    pnl: number;
  }[];
}

export function calculateAnalytics(): AnalyticsData {
  const { entries } = useJournalStore.getState();
  const { balance } = useTradeStore.getState();

  const closedTrades = entries.filter(e => e.pnl !== undefined);
  const totalTrades = closedTrades.length;

  if (totalTrades === 0) {
    return {
      totalTrades: 0, winRate: 0, lossRate: 0, profitFactor: 0,
      avgRR: 0, totalPnl: 0, grossProfit: 0, grossLoss: 0,
      avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0,
      maxDrawdown: 0, currentStreak: 0, streakType: "none",
      equityCurve: [{ time: "Start", equity: balance }],
      sessionBreakdown: [], strategyBreakdown: [],
      emotionBreakdown: [], dayBreakdown: [],
    };
  }

  const wins = closedTrades.filter(e => (e.pnl || 0) > 0);
  const losses = closedTrades.filter(e => (e.pnl || 0) <= 0);
  const grossProfit = wins.reduce((s, e) => s + (e.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, e) => s + (e.pnl || 0), 0));
  const totalPnl = grossProfit - grossLoss;
  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const lossRate = 100 - winRate;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;
  const bestTrade = Math.max(...closedTrades.map(e => e.pnl || 0));
  const worstTrade = Math.min(...closedTrades.map(e => e.pnl || 0));

  // Equity curve
  let equity = balance - totalPnl;
  const equityCurve = [{ time: "Start", equity }];
  [...closedTrades].reverse().forEach((e, i) => {
    equity += (e.pnl || 0);
    equityCurve.push({
      time: new Date(e.timestamp).toLocaleDateString(),
      equity: parseFloat(equity.toFixed(2)),
    });
  });

  // Max drawdown
  let peak = equityCurve[0].equity;
  let maxDrawdown = 0;
  equityCurve.forEach(p => {
    if (p.equity > peak) peak = p.equity;
    const dd = ((peak - p.equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  // Streak
  let currentStreak = 0;
  let streakType: "win" | "loss" | "none" = "none";
  for (const e of closedTrades) {
    if ((e.pnl || 0) > 0) {
      if (streakType === "win") currentStreak++;
      else { streakType = "win"; currentStreak = 1; }
    } else {
      if (streakType === "loss") currentStreak++;
      else { streakType = "loss"; currentStreak = 1; }
    }
  }

  // Session breakdown
  const sessions = ["london", "newyork", "asian", "sydney"];
  const sessionBreakdown = sessions.map(session => {
    const trades = closedTrades.filter(e => e.session === session);
    const w = trades.filter(e => (e.pnl || 0) > 0);
    return {
      session,
      trades: trades.length,
      winRate: trades.length > 0 ? (w.length / trades.length) * 100 : 0,
      pnl: trades.reduce((s, e) => s + (e.pnl || 0), 0),
    };
  }).filter(s => s.trades > 0);

  // Strategy breakdown
  const strategyMap = new Map<string, { trades: number; wins: number; pnl: number }>();
  closedTrades.forEach(e => {
    const s = e.strategy || "other";
    const existing = strategyMap.get(s) || { trades: 0, wins: 0, pnl: 0 };
    strategyMap.set(s, {
      trades: existing.trades + 1,
      wins: existing.wins + ((e.pnl || 0) > 0 ? 1 : 0),
      pnl: existing.pnl + (e.pnl || 0),
    });
  });
  const strategyBreakdown = Array.from(strategyMap.entries()).map(([strategy, data]) => ({
    strategy,
    trades: data.trades,
    winRate: (data.wins / data.trades) * 100,
    pnl: data.pnl,
  }));

  // Emotion breakdown
  const emotionMap = new Map<string, { trades: number; wins: number; pnl: number }>();
  closedTrades.forEach(e => {
    const em = e.emotion || "neutral";
    const existing = emotionMap.get(em) || { trades: 0, wins: 0, pnl: 0 };
    emotionMap.set(em, {
      trades: existing.trades + 1,
      wins: existing.wins + ((e.pnl || 0) > 0 ? 1 : 0),
      pnl: existing.pnl + (e.pnl || 0),
    });
  });
  const emotionBreakdown = Array.from(emotionMap.entries()).map(([emotion, data]) => ({
    emotion,
    trades: data.trades,
    winRate: (data.wins / data.trades) * 100,
    pnl: data.pnl,
  }));

  // Day breakdown
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayMap = new Map<string, { trades: number; pnl: number }>();
  closedTrades.forEach(e => {
    const day = days[new Date(e.timestamp).getDay()];
    const existing = dayMap.get(day) || { trades: 0, pnl: 0 };
    dayMap.set(day, { trades: existing.trades + 1, pnl: existing.pnl + (e.pnl || 0) });
  });
  const dayBreakdown = Array.from(dayMap.entries()).map(([day, data]) => ({ day, ...data }));

  return {
    totalTrades, winRate, lossRate, profitFactor, avgRR,
    totalPnl, grossProfit, grossLoss, avgWin, avgLoss,
    bestTrade, worstTrade, maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    currentStreak, streakType, equityCurve,
    sessionBreakdown, strategyBreakdown, emotionBreakdown, dayBreakdown,
  };
}

interface AnalyticsStore {
  data: AnalyticsData | null;
  refresh: () => void;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  data: null,
  refresh: () => set({ data: calculateAnalytics() }),
}));