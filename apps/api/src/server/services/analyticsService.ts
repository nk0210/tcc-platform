import { analyticsRepository, type AnalyticsFilters } from "../repositories/analyticsRepository";

const INITIAL_BALANCE = 10_000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const sd = (n: number, d: number) => (d === 0 ? 0 : n / d);

interface T {
  symbol:      string;
  displayName: string;
  category:    string | null;
  emoji:       string | null;
  netPnl:      number | null;
  grossPnl:    number | null;
  commission:  number | null;
  result:      string | null;
  closedAt:    Date | null;
  durationMs:  number | null;
  closeReason: string | null;
  session:     string | null;
}

function overview(ts: T[]) {
  if (!ts.length) return empty();
  const wins  = ts.filter((t) => t.result === "WIN");
  const loss  = ts.filter((t) => t.result === "LOSS");
  const tn    = ts.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const tg    = ts.reduce((s, t) => s + (t.grossPnl ?? 0), 0);
  const tc    = ts.reduce((s, t) => s + (t.commission ?? 0), 0);
  const sw    = wins.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const sl    = loss.reduce((s, t) => s + Math.abs(t.netPnl ?? 0), 0);
  const pf    = sl === 0 ? (sw > 0 ? 999 : 0) : r2(sd(sw, sl));
  let peak = INITIAL_BALANCE, run = INITIAL_BALANCE, mdd = 0;
  for (const t of ts) {
    run += t.netPnl ?? 0;
    if (run > peak) peak = run;
    const dd = sd(peak - run, peak) * 100;
    if (dd > mdd) mdd = dd;
  }
  return {
    totalTrades: ts.length, wins: wins.length, losses: loss.length,
    breakevens: ts.filter((t) => t.result === "BREAKEVEN").length,
    winRate: r2(sd(wins.length, ts.length) * 100),
    profitFactor: pf, avgWin: r2(sd(sw, wins.length || 1)),
    avgLoss: r2(sd(sl, loss.length || 1)),
    avgNetPnl: r2(sd(tn, ts.length)),
    avgRR: 0,
    avgDurationMs: r2(sd(ts.reduce((s, t) => s + (t.durationMs ?? 0), 0), ts.filter((t) => t.durationMs).length || 1)),
    totalNetPnl: r2(tn), totalGrossPnl: r2(tg), totalCommission: r2(tc),
    roiPercent: r2(sd(tn, INITIAL_BALANCE) * 100),
    maxDrawdownPercent: r2(mdd),
    bestTrade: r2(Math.max(...ts.map((t) => t.netPnl ?? 0), 0)),
    worstTrade: r2(Math.min(...ts.map((t) => t.netPnl ?? 0), 0)),
    slHits: ts.filter((t) => t.closeReason === "STOP_LOSS").length,
    tpHits: ts.filter((t) => t.closeReason === "TAKE_PROFIT").length,
    manualCloses: ts.filter((t) => t.closeReason === "MANUAL").length,
  };
}

function empty() {
  return {
    totalTrades: 0, wins: 0, losses: 0, breakevens: 0,
    winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0, avgNetPnl: 0,
    avgRR: 0, avgDurationMs: 0, totalNetPnl: 0, totalGrossPnl: 0,
    totalCommission: 0, roiPercent: 0, maxDrawdownPercent: 0,
    bestTrade: 0, worstTrade: 0, slHits: 0, tpHits: 0, manualCloses: 0,
  };
}

function byPeriod(ts: T[], period: "day" | "week" | "month") {
  const g: Record<string, { date: string; pnl: number; trades: number; wins: number }> = {};
  for (const t of ts) {
    if (!t.closedAt) continue;
    const d   = new Date(t.closedAt);
    let key: string;
    if (period === "day")       key = d.toISOString().slice(0, 10);
    else if (period === "week") { const wd = d.getUTCDay() || 7; const m = new Date(d); m.setUTCDate(d.getUTCDate() - (wd - 1)); key = m.toISOString().slice(0, 10); }
    else                        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!g[key]) g[key] = { date: key, pnl: 0, trades: 0, wins: 0 };
    g[key].pnl    += t.netPnl ?? 0;
    g[key].trades += 1;
    if (t.result === "WIN") g[key].wins += 1;
  }
  return Object.values(g)
    .map((x) => ({ ...x, pnl: r2(x.pnl), winRate: r2(sd(x.wins, x.trades) * 100) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function bySymbol(ts: T[]) {
  const m: Record<string, { symbol: string; displayName: string; category: string; emoji: string | null; trades: number; wins: number; losses: number; netPnl: number; bestTrade: number; worstTrade: number }> = {};
  for (const t of ts) {
    if (!m[t.symbol]) m[t.symbol] = { symbol: t.symbol, displayName: t.displayName, category: t.category ?? "crypto", emoji: t.emoji, trades: 0, wins: 0, losses: 0, netPnl: 0, bestTrade: 0, worstTrade: 0 };
    const g = m[t.symbol]; const pnl = t.netPnl ?? 0;
    g.trades += 1; g.netPnl += pnl;
    if (t.result === "WIN")  g.wins += 1;
    if (t.result === "LOSS") g.losses += 1;
    if (pnl > g.bestTrade)  g.bestTrade = pnl;
    if (pnl < g.worstTrade) g.worstTrade = pnl;
  }
  return Object.values(m).map((x) => ({ ...x, netPnl: r2(x.netPnl), bestTrade: r2(x.bestTrade), worstTrade: r2(x.worstTrade), winRate: r2(sd(x.wins, x.trades) * 100) })).sort((a, b) => b.netPnl - a.netPnl);
}

function bySession(ts: T[]) {
  const m: Record<string, { session: string; trades: number; wins: number; netPnl: number }> = {};
  for (const t of ts) {
    const sess = t.session ?? "unknown";
    if (!m[sess]) m[sess] = { session: sess, trades: 0, wins: 0, netPnl: 0 };
    m[sess].trades += 1; m[sess].netPnl += t.netPnl ?? 0;
    if (t.result === "WIN") m[sess].wins += 1;
  }
  return Object.values(m).map((x) => ({ ...x, netPnl: r2(x.netPnl), winRate: r2(sd(x.wins, x.trades) * 100) })).sort((a, b) => b.netPnl - a.netPnl);
}

export const analyticsService = {
  async getOverview(userId: string, filters: AnalyticsFilters = {}) {
    return overview(await analyticsRepository.getClosedTrades(userId, filters) as T[]);
  },
  async getDailyStats(userId: string, from?: Date, to?: Date) {
    return byPeriod(await analyticsRepository.getClosedTrades(userId, { from, to }) as T[], "day");
  },
  async getWeeklyStats(userId: string, from?: Date, to?: Date) {
    return byPeriod(await analyticsRepository.getClosedTrades(userId, { from, to }) as T[], "week");
  },
  async getMonthlyStats(userId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    return byPeriod(await analyticsRepository.getClosedTrades(userId, { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) }) as T[], "month");
  },
  async getSymbolStats(userId: string, filters: AnalyticsFilters = {}) {
    return bySymbol(await analyticsRepository.getClosedTrades(userId, filters) as T[]);
  },
  async getSessionStats(userId: string, filters: AnalyticsFilters = {}) {
    return bySession(await analyticsRepository.getClosedTrades(userId, filters) as T[]);
  },
  async getFullAnalytics(userId: string, filters: AnalyticsFilters = {}) {
    const ts = await analyticsRepository.getClosedTrades(userId, filters) as T[];
    return {
      overview: overview(ts),
      daily:    byPeriod(ts, "day").slice(-30),
      monthly:  byPeriod(ts, "month"),
      bySymbol: bySymbol(ts),
      bySession: bySession(ts),
    };
  },
};