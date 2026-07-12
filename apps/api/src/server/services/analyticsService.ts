/**
 * TCC Analytics Service — computes statistics from raw trade data.
 *
 * All heavy computation is done in TypeScript (not SQL) for flexibility.
 * This is appropriate at Phase Alpha scale. If performance becomes an
 * issue at scale, move computations to analyticsRepository raw queries.
 */
import { analyticsRepository, type AnalyticsFilters } from "../repositories/analyticsRepository";
import { PAPER_INITIAL_BALANCE } from "./tradeService";

interface ClosedTrade {
  id: string;
  symbol: string;
  displayName: string;
  category: string;
  emoji: string | null;
  side: "BUY" | "SELL";
  lotSize: number;
  netPnl: number | null;
  grossPnl: number | null;
  commission: number | null;
  result: "WIN" | "LOSS" | "BREAKEVEN" | null;
  openedAt: Date | null;
  closedAt: Date | null;
  durationMs: number | null;
  closeReason: string | null;
  session: string | null;
  strategy: string | null;
  sl: number | null;
  tp: number | null;
  entryPrice: number;
  exitPrice: number | null;
}

// ── Statistics helpers ────────────────────────────────────────────────────

function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeOverview(trades: ClosedTrade[]) {
  if (trades.length === 0) return emptyOverview();

  const wins       = trades.filter(t => t.result === "WIN");
  const losses     = trades.filter(t => t.result === "LOSS");
  const breakevens = trades.filter(t => t.result === "BREAKEVEN");

  const totalNetPnl    = trades.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const totalGrossPnl  = trades.reduce((s, t) => s + (t.grossPnl ?? 0), 0);
  const totalCommission = trades.reduce((s, t) => s + (t.commission ?? 0), 0);
  const sumWins        = wins.reduce((s, t)   => s + (t.netPnl ?? 0), 0);
  const sumLosses      = losses.reduce((s, t) => s + Math.abs(t.netPnl ?? 0), 0);

  const winRate     = round2(safeDiv(wins.length, trades.length) * 100);
  const profitFactor = sumLosses === 0 ? (sumWins > 0 ? 999 : 0) : round2(safeDiv(sumWins, sumLosses));
  const avgWin      = round2(safeDiv(sumWins, wins.length || 1));
  const avgLoss     = round2(safeDiv(sumLosses, losses.length || 1));
  const avgNetPnl   = round2(safeDiv(totalNetPnl, trades.length));

  // Risk/reward from trades with both SL and TP set
  const tradesPnlPairs = trades
    .filter(t => t.netPnl !== null && t.netPnl !== 0)
    .map(t => t.netPnl!);
  const positivePnls = tradesPnlPairs.filter(p => p > 0);
  const negativePnls = tradesPnlPairs.filter(p => p < 0).map(Math.abs);
  const avgRR = round2(safeDiv(
    safeDiv(positivePnls.reduce((a, b) => a + b, 0), positivePnls.length || 1),
    safeDiv(negativePnls.reduce((a, b) => a + b, 0), negativePnls.length || 1)
  ));

  // Duration
  const durTrades  = trades.filter(t => t.durationMs != null);
  const avgDuration = round2(safeDiv(
    durTrades.reduce((s, t) => s + (t.durationMs ?? 0), 0),
    durTrades.length || 1
  ));

  // Max drawdown (running from initial balance)
  let peak = PAPER_INITIAL_BALANCE;
  let runningBalance = PAPER_INITIAL_BALANCE;
  let maxDrawdown = 0;
  for (const t of trades) {
    runningBalance += t.netPnl ?? 0;
    if (runningBalance > peak) peak = runningBalance;
    const dd = safeDiv(peak - runningBalance, peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return {
    totalTrades:  trades.length,
    wins:         wins.length,
    losses:       losses.length,
    breakevens:   breakevens.length,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    avgNetPnl,
    avgRR,
    avgDurationMs: avgDuration,
    totalNetPnl:   round2(totalNetPnl),
    totalGrossPnl: round2(totalGrossPnl),
    totalCommission: round2(totalCommission),
    roiPercent:    round2(safeDiv(totalNetPnl, PAPER_INITIAL_BALANCE) * 100),
    maxDrawdownPercent: round2(maxDrawdown),
    bestTrade:     round2(Math.max(...trades.map(t => t.netPnl ?? 0), 0)),
    worstTrade:    round2(Math.min(...trades.map(t => t.netPnl ?? 0), 0)),
    slHits:        trades.filter(t => t.closeReason === "STOP_LOSS").length,
    tpHits:        trades.filter(t => t.closeReason === "TAKE_PROFIT").length,
    manualCloses:  trades.filter(t => t.closeReason === "MANUAL").length,
  };
}

function emptyOverview() {
  return {
    totalTrades: 0, wins: 0, losses: 0, breakevens: 0,
    winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, avgNetPnl: 0,
    avgRR: 0, avgDurationMs: 0, totalNetPnl: 0, totalGrossPnl: 0,
    totalCommission: 0, roiPercent: 0, maxDrawdownPercent: 0,
    bestTrade: 0, worstTrade: 0, slHits: 0, tpHits: 0, manualCloses: 0,
  };
}

function groupByDate(trades: ClosedTrade[], period: "day" | "week" | "month") {
  const groups: Record<string, { date: string; pnl: number; trades: number; wins: number }> = {};

  for (const t of trades) {
    if (!t.closedAt) continue;
    const d   = new Date(t.closedAt);
    let key: string;
    if (period === "day") {
      key = d.toISOString().slice(0, 10);
    } else if (period === "week") {
      // ISO week: Monday-based
      const day  = d.getUTCDay() || 7;
      const mon  = new Date(d);
      mon.setUTCDate(d.getUTCDate() - (day - 1));
      key = mon.toISOString().slice(0, 10);
    } else {
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    if (!groups[key]) groups[key] = { date: key, pnl: 0, trades: 0, wins: 0 };
    groups[key].pnl    += t.netPnl ?? 0;
    groups[key].trades += 1;
    if (t.result === "WIN") groups[key].wins += 1;
  }

  return Object.values(groups)
    .map(g => ({ ...g, pnl: round2(g.pnl), winRate: round2(safeDiv(g.wins, g.trades) * 100) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function groupBySymbol(trades: ClosedTrade[]) {
  const map: Record<string, {
    symbol: string; displayName: string; category: string; emoji: string | null;
    trades: number; wins: number; losses: number; netPnl: number;
    bestTrade: number; worstTrade: number;
  }> = {};

  for (const t of trades) {
    if (!map[t.symbol]) {
      map[t.symbol] = {
        symbol: t.symbol, displayName: t.displayName, category: t.category,
        emoji: t.emoji, trades: 0, wins: 0, losses: 0, netPnl: 0,
        bestTrade: 0, worstTrade: 0,
      };
    }
    const g = map[t.symbol];
    g.trades  += 1;
    g.netPnl  += t.netPnl ?? 0;
    if (t.result === "WIN")  g.wins   += 1;
    if (t.result === "LOSS") g.losses += 1;
    const pnl = t.netPnl ?? 0;
    if (pnl > g.bestTrade)  g.bestTrade  = pnl;
    if (pnl < g.worstTrade) g.worstTrade = pnl;
  }

  return Object.values(map)
    .map(g => ({
      ...g,
      netPnl:    round2(g.netPnl),
      bestTrade: round2(g.bestTrade),
      worstTrade: round2(g.worstTrade),
      winRate:   round2(safeDiv(g.wins, g.trades) * 100),
    }))
    .sort((a, b) => b.netPnl - a.netPnl);
}

function groupBySession(trades: ClosedTrade[]) {
  const map: Record<string, { session: string; trades: number; wins: number; netPnl: number }> = {};

  for (const t of trades) {
    const session = t.session ?? "unknown";
    if (!map[session]) map[session] = { session, trades: 0, wins: 0, netPnl: 0 };
    map[session].trades += 1;
    map[session].netPnl += t.netPnl ?? 0;
    if (t.result === "WIN") map[session].wins += 1;
  }

  return Object.values(map)
    .map(g => ({ ...g, netPnl: round2(g.netPnl), winRate: round2(safeDiv(g.wins, g.trades) * 100) }))
    .sort((a, b) => b.netPnl - a.netPnl);
}

// ── Service ───────────────────────────────────────────────────────────────

export const analyticsService = {
  async getOverview(userId: string, filters: AnalyticsFilters = {}) {
    const trades = await analyticsRepository.getClosedTrades(userId, filters);
    return computeOverview(trades as ClosedTrade[]);
  },

  async getDailyStats(userId: string, from?: Date, to?: Date) {
    const trades = await analyticsRepository.getClosedTrades(userId, { from, to });
    return groupByDate(trades as ClosedTrade[], "day");
  },

  async getWeeklyStats(userId: string, from?: Date, to?: Date) {
    const trades = await analyticsRepository.getClosedTrades(userId, { from, to });
    return groupByDate(trades as ClosedTrade[], "week");
  },

  async getMonthlyStats(userId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    const from = new Date(y, 0, 1);
    const to   = new Date(y + 1, 0, 1);
    const trades = await analyticsRepository.getClosedTrades(userId, { from, to });
    return groupByDate(trades as ClosedTrade[], "month");
  },

  async getSymbolStats(userId: string, filters: AnalyticsFilters = {}) {
    const trades = await analyticsRepository.getClosedTrades(userId, filters);
    return groupBySymbol(trades as ClosedTrade[]);
  },

  async getSessionStats(userId: string, filters: AnalyticsFilters = {}) {
    const trades = await analyticsRepository.getClosedTrades(userId, filters);
    return groupBySession(trades as ClosedTrade[]);
  },

  async getFullAnalytics(userId: string, filters: AnalyticsFilters = {}) {
    const trades = await analyticsRepository.getClosedTrades(userId, filters);
    const cast   = trades as ClosedTrade[];
    return {
      overview:  computeOverview(cast),
      daily:     groupByDate(cast, "day").slice(-30),    // last 30 days
      monthly:   groupByDate(cast, "month"),
      bySymbol:  groupBySymbol(cast),
      bySession: groupBySession(cast),
    };
  },
};