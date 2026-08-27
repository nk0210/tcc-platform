/**
 * TCC Analytics Performance Helpers
 *
 * Pure functions — no Zustand reads here.
 * All data passed in as parameters.
 * PAPER TRADING ONLY — not broker-verified analytics.
 * Folder: apps/web/app/lib/analytics/performance.ts
 */

export const PAPER_INITIAL_BALANCE = 10000;

// ── Safe Date Utilities ───────────────────────────────────────────────────

export function safeDate(val: string | number | Date | undefined | null): Date | null {
  if (val === undefined || val === null || val === "") return null;
  try {
    const d = new Date(val as any);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatDate(val: string | number | Date | undefined | null): string {
  const d = safeDate(val);
  if (!d) return "—";
  try {
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatDateShort(val: string | number | Date | undefined | null): string {
  const d = safeDate(val);
  if (!d) return "—";
  try {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export function formatDuration(ms: number | undefined | null): string {
  if (!ms || ms <= 0 || isNaN(ms)) return "—";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
  return `${Math.floor(ms / 86400000)}d ${Math.round((ms % 86400000) / 3600000)}h`;
}

// ── Model Types (imported via types only — no store side effects) ──────────

export interface ClosedTradeInput {
  id: string;
  symbol: string;
  displayName: string;
  category: string;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  exitPrice: number;
  grossPnl: number;
  netPnl: number;
  marginUsed?: number;
  notionalValue?: number;
  openedAt: string;
  closedAt: string;
  durationMs: number;
  closeReason: "MANUAL" | "STOP_LOSS" | "TAKE_PROFIT";
  sl?: number | null;
  tp?: number | null;
}

export interface PositionInput {
  id: string;
  symbol: string;
  displayName: string;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  sl: number | null;
  tp: number | null;
  floatingPnl: number;
  marginUsed: number;
  notionalValue: number;
}

export interface JournalEntryInput {
  id: string;
  symbol: string;
  displayName: string;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  exitPrice?: number | null;
  grossPnl?: number | null;
  netPnl?: number | null;
  result?: "WIN" | "LOSS" | "BREAKEVEN" | null;
  openedAt?: string | null;
  closedAt?: string | null;
  durationMs?: number | null;
  closeReason?: string | null;
  sl?: number | null;
  tp?: number | null;
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
  aiAnalysis: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskScoreInput {
  total: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  recommendation: string;
}

export interface TCCSymbolInput {
  id: string;
  displayName: string;
  category: string;
  emoji: string;
}

// ── Performance Overview ───────────────────────────────────────────────────

export interface PerformanceOverview {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  lossRate: number;
  netPnl: number;
  grossPnl: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  avgDurationMs: number;
  totalWonAmount: number;
  totalLostAmount: number;
  openPositions: number;
  floatingPnl: number;
  equity: number;
  balance: number;
  roiPercent: number;
  slHits: number;
  tpHits: number;
  manualCloses: number;
}

export function calculatePerformanceOverview(
  closedTrades: ClosedTradeInput[],
  balance: number,
  equity: number,
  floatingPnl: number,
  positions: PositionInput[]
): PerformanceOverview {
  const empty: PerformanceOverview = {
    totalTrades: 0, wins: 0, losses: 0, breakevens: 0,
    winRate: 0, lossRate: 0, netPnl: 0, grossPnl: 0,
    profitFactor: 0, avgWin: 0, avgLoss: 0, bestTrade: 0, worstTrade: 0,
    avgDurationMs: 0, totalWonAmount: 0, totalLostAmount: 0,
    openPositions: positions.length, floatingPnl, equity, balance, roiPercent: 0,
    slHits: 0, tpHits: 0, manualCloses: 0,
  };

  if (closedTrades.length === 0) return empty;

  const wins = closedTrades.filter(t => t.netPnl > 0.01);
  const losses = closedTrades.filter(t => t.netPnl < -0.01);
  const breakevens = closedTrades.filter(t => Math.abs(t.netPnl) <= 0.01);

  const netPnl = closedTrades.reduce((s, t) => s + t.netPnl, 0);
  const grossPnl = closedTrades.reduce((s, t) => s + t.grossPnl, 0);
  const totalWon = wins.reduce((s, t) => s + t.netPnl, 0);
  const totalLost = Math.abs(losses.reduce((s, t) => s + t.netPnl, 0));

  const pnlValues = closedTrades.map(t => t.netPnl);
  const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
  const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

  const avgDuration = closedTrades.reduce((s, t) => s + (t.durationMs || 0), 0) / closedTrades.length;
  const roiPercent = ((equity - PAPER_INITIAL_BALANCE) / PAPER_INITIAL_BALANCE) * 100;

  return {
    totalTrades: closedTrades.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRate: parseFloat(((wins.length / closedTrades.length) * 100).toFixed(1)),
    lossRate: parseFloat(((losses.length / closedTrades.length) * 100).toFixed(1)),
    netPnl: parseFloat(netPnl.toFixed(2)),
    grossPnl: parseFloat(grossPnl.toFixed(2)),
    profitFactor: totalLost > 0 ? parseFloat((totalWon / totalLost).toFixed(2)) : wins.length > 0 ? 999 : 0,
    avgWin: wins.length > 0 ? parseFloat((totalWon / wins.length).toFixed(2)) : 0,
    avgLoss: losses.length > 0 ? parseFloat((totalLost / losses.length).toFixed(2)) : 0,
    bestTrade: parseFloat(bestTrade.toFixed(2)),
    worstTrade: parseFloat(worstTrade.toFixed(2)),
    avgDurationMs: Math.round(avgDuration),
    totalWonAmount: parseFloat(totalWon.toFixed(2)),
    totalLostAmount: parseFloat(totalLost.toFixed(2)),
    openPositions: positions.length,
    floatingPnl: parseFloat(floatingPnl.toFixed(2)),
    equity: parseFloat(equity.toFixed(2)),
    balance: parseFloat(balance.toFixed(2)),
    roiPercent: parseFloat(roiPercent.toFixed(2)),
    slHits: closedTrades.filter(t => t.closeReason === "STOP_LOSS").length,
    tpHits: closedTrades.filter(t => t.closeReason === "TAKE_PROFIT").length,
    manualCloses: closedTrades.filter(t => t.closeReason === "MANUAL").length,
  };
}

// ── Equity Curve ───────────────────────────────────────────────────────────

export interface EquityPoint {
  time: string;
  equity: number;
  pnl: number;
  tradeIndex: number;
}

export function calculateEquityCurve(closedTrades: ClosedTradeInput[]): EquityPoint[] {
  const sorted = [...closedTrades].sort((a, b) => {
    const aT = safeDate(a.closedAt)?.getTime() ?? 0;
    const bT = safeDate(b.closedAt)?.getTime() ?? 0;
    return aT - bT;
  });

  const curve: EquityPoint[] = [
    { time: "Start", equity: PAPER_INITIAL_BALANCE, pnl: 0, tradeIndex: 0 }
  ];

  let running = PAPER_INITIAL_BALANCE;
  sorted.forEach((trade, i) => {
    running = parseFloat((running + trade.netPnl).toFixed(2));
    const d = safeDate(trade.closedAt);
    curve.push({
      time: d ? formatDateShort(d) : `T${i + 1}`,
      equity: running,
      pnl: parseFloat(trade.netPnl.toFixed(2)),
      tradeIndex: i + 1,
    });
  });

  return curve;
}

// ── Monthly P&L ────────────────────────────────────────────────────────────

export interface MonthlyPnl {
  month: string;
  pnl: number;
  trades: number;
  wins: number;
}

export function calculateMonthlyPnl(closedTrades: ClosedTradeInput[]): MonthlyPnl[] {
  const map: Record<string, MonthlyPnl & { _key: string }> = {};

  closedTrades.forEach(trade => {
    const d = safeDate(trade.closedAt);
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    if (!map[key]) map[key] = { _key: key, month: label, pnl: 0, trades: 0, wins: 0 };
    map[key].pnl += trade.netPnl;
    map[key].trades++;
    if (trade.netPnl > 0.01) map[key].wins++;
  });

  return Object.values(map)
    .sort((a, b) => a._key.localeCompare(b._key))
    .map(({ _key, ...v }) => ({ ...v, pnl: parseFloat(v.pnl.toFixed(2)) }));
}

// ── Calendar P&L ───────────────────────────────────────────────────────────

export interface DayPnl {
  date: string;
  pnl: number;
  trades: number;
}

export function calculateCalendarPnl(closedTrades: ClosedTradeInput[]): Record<string, DayPnl> {
  const map: Record<string, DayPnl> = {};
  closedTrades.forEach(trade => {
    const d = safeDate(trade.closedAt);
    if (!d) return;
    const key = d.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { date: key, pnl: 0, trades: 0 };
    map[key].pnl += trade.netPnl;
    map[key].trades++;
  });
  Object.keys(map).forEach(k => { map[k].pnl = parseFloat(map[k].pnl.toFixed(2)); });
  return map;
}

// ── Risk Analytics ─────────────────────────────────────────────────────────

export interface RiskAnalytics {
  riskLevel: string;
  riskScore: number;
  drawdownPercent: number;
  drawdownAmount: number;
  peakEquity: number;
  slHitCount: number;
  tpHitCount: number;
  manualCloseCount: number;
  positionsWithoutSL: number;
  maxConsecutiveLosses: number;
  maxDrawdownTrade: number;
}

export function calculateRiskAnalytics(
  riskScore: RiskScoreInput,
  closedTrades: ClosedTradeInput[],
  positions: PositionInput[]
): RiskAnalytics {
  const curve = calculateEquityCurve(closedTrades);
  let peak = PAPER_INITIAL_BALANCE;
  let maxDrawdownAmt = 0;
  curve.forEach(p => {
    if (p.equity > peak) peak = p.equity;
    const dd = peak - p.equity;
    if (dd > maxDrawdownAmt) maxDrawdownAmt = dd;
  });
  const drawdownPercent = peak > 0 ? (maxDrawdownAmt / peak) * 100 : 0;

  const sorted = [...closedTrades].sort((a, b) =>
    (safeDate(a.closedAt)?.getTime() ?? 0) - (safeDate(b.closedAt)?.getTime() ?? 0)
  );
  let maxConLosses = 0, currLosses = 0;
  sorted.forEach(t => {
    if (t.netPnl < -0.01) { currLosses++; maxConLosses = Math.max(maxConLosses, currLosses); }
    else currLosses = 0;
  });

  const positionsWithoutSL = positions.filter(p => !p.sl || p.sl <= 0).length;
  const pnlValues = closedTrades.map(t => t.netPnl);
  const maxDrawdownTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

  return {
    riskLevel: riskScore.level,
    riskScore: riskScore.total,
    drawdownPercent: parseFloat(drawdownPercent.toFixed(2)),
    drawdownAmount: parseFloat(maxDrawdownAmt.toFixed(2)),
    peakEquity: parseFloat(peak.toFixed(2)),
    slHitCount: closedTrades.filter(t => t.closeReason === "STOP_LOSS").length,
    tpHitCount: closedTrades.filter(t => t.closeReason === "TAKE_PROFIT").length,
    manualCloseCount: closedTrades.filter(t => t.closeReason === "MANUAL").length,
    positionsWithoutSL,
    maxConsecutiveLosses: maxConLosses,
    maxDrawdownTrade: parseFloat(maxDrawdownTrade.toFixed(2)),
  };
}

// ── Symbol Analytics ───────────────────────────────────────────────────────

export interface SymbolAnalytic {
  symbolId: string;
  displayName: string;
  category: string;
  emoji: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
  bestTrade: number;
  worstTrade: number;
}

export function calculateSymbolAnalytics(
  closedTrades: ClosedTradeInput[],
  symbolMap: Record<string, TCCSymbolInput>
): SymbolAnalytic[] {
  const map: Record<string, { trades: number; wins: number; losses: number; netPnl: number; best: number; worst: number; displayName: string; category: string; emoji: string }> = {};

  closedTrades.forEach(trade => {
    if (!map[trade.symbol]) {
      const def = symbolMap[trade.symbol];
      map[trade.symbol] = {
        trades: 0, wins: 0, losses: 0, netPnl: 0,
        best: -Infinity, worst: Infinity,
        displayName: trade.displayName || def?.displayName || trade.symbol,
        category: def?.category || "crypto",
        emoji: def?.emoji || "●",
      };
    }
    const s = map[trade.symbol];
    s.trades++;
    s.netPnl += trade.netPnl;
    if (trade.netPnl > 0.01) s.wins++;
    else if (trade.netPnl < -0.01) s.losses++;
    s.best = Math.max(s.best, trade.netPnl);
    s.worst = Math.min(s.worst, trade.netPnl);
  });

  return Object.entries(map).map(([symbolId, s]) => ({
    symbolId,
    displayName: s.displayName,
    category: s.category,
    emoji: s.emoji,
    trades: s.trades,
    wins: s.wins,
    losses: s.losses,
    winRate: parseFloat(((s.wins / s.trades) * 100).toFixed(1)),
    netPnl: parseFloat(s.netPnl.toFixed(2)),
    avgPnl: parseFloat((s.netPnl / s.trades).toFixed(2)),
    bestTrade: s.best === -Infinity ? 0 : parseFloat(s.best.toFixed(2)),
    worstTrade: s.worst === Infinity ? 0 : parseFloat(s.worst.toFixed(2)),
  })).sort((a, b) => b.netPnl - a.netPnl);
}

// ── Session Analytics ──────────────────────────────────────────────────────

export interface SessionAnalytic {
  session: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
}

export function calculateSessionAnalytics(
  journalEntries: JournalEntryInput[]
): SessionAnalytic[] {
  const map: Record<string, { trades: number; wins: number; losses: number; netPnl: number }> = {};

  journalEntries.forEach(entry => {
    if (entry.netPnl == null) return;
    const session = entry.session || "unknown";
    if (!map[session]) map[session] = { trades: 0, wins: 0, losses: 0, netPnl: 0 };
    map[session].trades++;
    map[session].netPnl += entry.netPnl;
    if ((entry.netPnl ?? 0) > 0.01) map[session].wins++;
    else if ((entry.netPnl ?? 0) < -0.01) map[session].losses++;
  });

  return Object.entries(map).map(([session, d]) => ({
    session,
    trades: d.trades,
    wins: d.wins,
    losses: d.losses,
    winRate: d.trades > 0 ? parseFloat(((d.wins / d.trades) * 100).toFixed(1)) : 0,
    netPnl: parseFloat(d.netPnl.toFixed(2)),
    avgPnl: d.trades > 0 ? parseFloat((d.netPnl / d.trades).toFixed(2)) : 0,
  })).sort((a, b) => b.trades - a.trades);
}

// ── Strategy Analytics ─────────────────────────────────────────────────────

export interface StrategyAnalytic {
  strategy: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
}

export function calculateStrategyAnalytics(
  journalEntries: JournalEntryInput[]
): StrategyAnalytic[] {
  const map: Record<string, { trades: number; wins: number; losses: number; netPnl: number }> = {};

  journalEntries.forEach(entry => {
    if (entry.netPnl == null) return;
    const key = (entry.strategy && entry.strategy !== "other" && entry.strategy !== "unknown")
      ? entry.strategy
      : "untagged";
    if (!map[key]) map[key] = { trades: 0, wins: 0, losses: 0, netPnl: 0 };
    map[key].trades++;
    map[key].netPnl += entry.netPnl;
    if ((entry.netPnl ?? 0) > 0.01) map[key].wins++;
    else if ((entry.netPnl ?? 0) < -0.01) map[key].losses++;
  });

  return Object.entries(map).map(([strat, d]) => ({
    strategy: strat === "untagged" ? "Untagged" : strat.replace(/_/g, " ").toUpperCase(),
    trades: d.trades,
    wins: d.wins,
    losses: d.losses,
    winRate: d.trades > 0 ? parseFloat(((d.wins / d.trades) * 100).toFixed(1)) : 0,
    netPnl: parseFloat(d.netPnl.toFixed(2)),
    avgPnl: d.trades > 0 ? parseFloat((d.netPnl / d.trades).toFixed(2)) : 0,
  })).sort((a, b) => b.trades - a.trades);
}

// ── Behavior Analytics ─────────────────────────────────────────────────────

export interface EmotionBreakdown {
  emotion: string;
  trades: number;
  wins: number;
  netPnl: number;
  winRate: number;
}

export interface BehaviorAnalytics {
  emotionBreakdown: EmotionBreakdown[];
  followedPlanPercent: number;
  didNotFollowPlanCount: number;
  withPlanDataCount: number;
  impulsiveEntries: number;
  earlyEntries: number;
  lateEntries: number;
  missingNotes: number;
  missingLessons: number;
  avgConfidence: number;
  avgStress: number;
  totalClosedEntries: number;
}

export function calculateBehaviorAnalytics(
  journalEntries: JournalEntryInput[]
): BehaviorAnalytics {
  const closed = journalEntries.filter(e => e.netPnl != null);
  const empty: BehaviorAnalytics = {
    emotionBreakdown: [], followedPlanPercent: 0, didNotFollowPlanCount: 0,
    withPlanDataCount: 0, impulsiveEntries: 0, earlyEntries: 0, lateEntries: 0,
    missingNotes: 0, missingLessons: 0, avgConfidence: 0, avgStress: 0,
    totalClosedEntries: 0,
  };
  if (closed.length === 0) return empty;

  const emotionMap: Record<string, { trades: number; wins: number; netPnl: number }> = {};
  closed.forEach(e => {
    const emotion = e.emotion || "neutral";
    if (!emotionMap[emotion]) emotionMap[emotion] = { trades: 0, wins: 0, netPnl: 0 };
    emotionMap[emotion].trades++;
    emotionMap[emotion].netPnl += e.netPnl ?? 0;
    if ((e.netPnl ?? 0) > 0.01) emotionMap[emotion].wins++;
  });

  const emotionBreakdown: EmotionBreakdown[] = Object.entries(emotionMap).map(([emotion, d]) => ({
    emotion,
    trades: d.trades,
    wins: d.wins,
    netPnl: parseFloat(d.netPnl.toFixed(2)),
    winRate: d.trades > 0 ? parseFloat(((d.wins / d.trades) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.trades - a.trades);

  const withPlanData = closed.filter(e => e.followedPlan !== null && e.followedPlan !== undefined);
  const followedCount = withPlanData.filter(e => e.followedPlan === true).length;
  const followedPlanPercent = withPlanData.length > 0
    ? parseFloat(((followedCount / withPlanData.length) * 100).toFixed(1)) : 0;

  const withConf = closed.filter(e => e.confidenceLevel > 0);
  const withStress = closed.filter(e => e.stressLevel > 0);

  return {
    emotionBreakdown,
    followedPlanPercent,
    didNotFollowPlanCount: withPlanData.length - followedCount,
    withPlanDataCount: withPlanData.length,
    impulsiveEntries: closed.filter(e => e.entryQuality === "impulsive").length,
    earlyEntries: closed.filter(e => e.entryQuality === "early").length,
    lateEntries: closed.filter(e => e.entryQuality === "late").length,
    missingNotes: closed.filter(e => !e.notes || e.notes.trim().length < 5).length,
    missingLessons: closed.filter(e => !e.lessonLearned || e.lessonLearned.trim().length < 5).length,
    avgConfidence: withConf.length > 0
      ? parseFloat((withConf.reduce((s, e) => s + e.confidenceLevel, 0) / withConf.length).toFixed(1)) : 0,
    avgStress: withStress.length > 0
      ? parseFloat((withStress.reduce((s, e) => s + e.stressLevel, 0) / withStress.length).toFixed(1)) : 0,
    totalClosedEntries: closed.length,
  };
}

// ── Discipline Score ───────────────────────────────────────────────────────

export interface DisciplineComponent {
  name: string;
  score: number;
  maxScore: number;
  description: string;
}

export interface DisciplineScore {
  total: number;
  grade: "A" | "B" | "C" | "D" | "F" | "N/A";
  components: DisciplineComponent[];
  hasEnoughData: boolean;
}

const MIN_TRADES_FOR_DISCIPLINE = 5;

export function calculateDisciplineScore(
  journalEntries: JournalEntryInput[],
  closedTrades: ClosedTradeInput[]
): DisciplineScore {
  const noData: DisciplineScore = { total: 0, grade: "N/A", components: [], hasEnoughData: false };
  if (closedTrades.length < MIN_TRADES_FOR_DISCIPLINE) return noData;

  const closed = journalEntries.filter(e => e.netPnl != null);
  const components: DisciplineComponent[] = [];

  // 1. Journal coverage (20 pts)
  const coverage = closed.length / Math.max(closedTrades.length, 1);
  const journalScore = Math.round(coverage * 20);
  components.push({
    name: "Journal Coverage",
    score: journalScore, maxScore: 20,
    description: `${closed.length}/${closedTrades.length} trades have journal entries`,
  });

  // 2. Plan adherence (20 pts)
  const withPlan = closed.filter(e => e.followedPlan !== null && e.followedPlan !== undefined);
  const planFollowed = withPlan.filter(e => e.followedPlan === true).length;
  const planScore = withPlan.length > 0 ? Math.round((planFollowed / withPlan.length) * 20) : 10;
  components.push({
    name: "Plan Adherence",
    score: planScore, maxScore: 20,
    description: withPlan.length > 0
      ? `${Math.round((planFollowed / withPlan.length) * 100)}% of trades followed your plan`
      : "No plan adherence data — mark each trade",
  });

  // 3. Entry quality (15 pts)
  const badEntries = closed.filter(e => e.entryQuality === "impulsive" || e.entryQuality === "late").length;
  const entryScore = Math.max(0, 15 - Math.round((badEntries / Math.max(closed.length, 1)) * 15));
  components.push({
    name: "Entry Quality",
    score: entryScore, maxScore: 15,
    description: badEntries > 0 ? `${badEntries} impulsive or late entries detected` : "No problematic entries",
  });

  // 4. No overtrading (15 pts)
  const tradingDays: Record<string, number> = {};
  closedTrades.forEach(t => {
    const d = safeDate(t.closedAt);
    if (!d) return;
    const k = d.toISOString().slice(0, 10);
    tradingDays[k] = (tradingDays[k] || 0) + 1;
  });
  const overtradingDays = Object.values(tradingDays).filter(v => v > 5).length;
  const overtradingScore = Math.max(0, 15 - overtradingDays * 5);
  components.push({
    name: "No Overtrading",
    score: overtradingScore, maxScore: 15,
    description: overtradingDays > 0 ? `${overtradingDays} day(s) with 5+ trades` : "No overtrading detected",
  });

  // 5. Stop loss usage (15 pts)
  const tradesWithSL = closedTrades.filter(t => (t as any).sl != null && (t as any).sl > 0).length;
  const slScore = closedTrades.length > 0
    ? Math.round((tradesWithSL / closedTrades.length) * 15) : 8;
  components.push({
    name: "Stop Loss Usage",
    score: slScore, maxScore: 15,
    description: tradesWithSL > 0
      ? `${tradesWithSL}/${closedTrades.length} trades had SL set`
      : "Always set a stop loss to protect capital",
  });

  // 6. Notes quality (15 pts)
  const notedTrades = closed.filter(e => e.notes && e.notes.trim().length >= 10).length;
  const notesScore = closed.length > 0 ? Math.round((notedTrades / closed.length) * 15) : 0;
  components.push({
    name: "Trade Notes",
    score: notesScore, maxScore: 15,
    description: `${notedTrades}/${closed.length} entries have detailed notes`,
  });

  const total = Math.min(100, components.reduce((s, c) => s + c.score, 0));
  const grade: DisciplineScore["grade"] =
    total >= 85 ? "A" : total >= 70 ? "B" : total >= 55 ? "C" : total >= 40 ? "D" : "F";

  return { total, grade, components, hasEnoughData: true };
}

// ── Funded Challenge Readiness ─────────────────────────────────────────────

export type ReadinessLevel = "insufficient_data" | "building" | "moderate" | "strong";

export interface FundedReadinessComponent {
  name: string;
  status: "pass" | "warn" | "fail" | "unknown";
  detail: string;
}

export interface FundedReadiness {
  level: ReadinessLevel;
  label: string;
  description: string;
  components: FundedReadinessComponent[];
  disclaimer: string;
}

export function calculateFundedReadiness(
  perf: PerformanceOverview,
  discipline: DisciplineScore,
  risk: RiskAnalytics
): FundedReadiness {
  const disclaimer =
    "Rule-based readiness estimate from paper trading data only. Not financial advice. " +
    "Real funded challenge performance depends on broker rules, real market conditions, " +
    "execution quality, and psychology under real capital risk.";

  if (perf.totalTrades < 10) {
    return {
      level: "insufficient_data",
      label: "Insufficient Data",
      description: `Complete at least 10 paper trades to see funded challenge readiness. ${perf.totalTrades}/10 trades done.`,
      components: [],
      disclaimer,
    };
  }

  const components: FundedReadinessComponent[] = [
    {
      name: "Win Rate",
      status: perf.winRate >= 50 ? "pass" : perf.winRate >= 40 ? "warn" : "fail",
      detail: `${perf.winRate}% (target: >50%)`,
    },
    {
      name: "Profit Factor",
      status: perf.profitFactor === 0 ? "unknown"
        : perf.profitFactor >= 1.2 ? "pass"
        : perf.profitFactor >= 1.0 ? "warn" : "fail",
      detail: `${perf.profitFactor === 999 ? "∞" : perf.profitFactor} (target: >1.2)`,
    },
    {
      name: "Max Drawdown Control",
      status: risk.drawdownPercent <= 8 ? "pass" : risk.drawdownPercent <= 12 ? "warn" : "fail",
      detail: `${risk.drawdownPercent.toFixed(1)}% (target: <8% for most challenges)`,
    },
    {
      name: "Net Positive P&L",
      status: perf.netPnl > 0 ? "pass" : "fail",
      detail: `${perf.netPnl >= 0 ? "+" : ""}$${perf.netPnl} paper P&L`,
    },
    {
      name: "Discipline Score",
      status: !discipline.hasEnoughData ? "unknown"
        : discipline.total >= 60 ? "pass"
        : discipline.total >= 45 ? "warn" : "fail",
      detail: discipline.hasEnoughData ? `${discipline.total}/100 (target: ≥60)` : "Needs more data",
    },
    {
      name: "Risk Management",
      status: risk.riskLevel === "LOW" ? "pass" : risk.riskLevel === "MEDIUM" ? "warn" : "fail",
      detail: `Current risk level: ${risk.riskLevel}`,
    },
  ];

  const passes = components.filter(c => c.status === "pass").length;
  const fails = components.filter(c => c.status === "fail").length;
  const known = components.filter(c => c.status !== "unknown").length;

  const level: ReadinessLevel =
    fails >= 3 ? "building"
    : passes >= known - 1 && fails === 0 ? "strong"
    : passes >= Math.floor(known / 2) ? "moderate"
    : "building";

  const labels: Record<ReadinessLevel, string> = {
    insufficient_data: "Insufficient Data",
    building: "Building Foundation",
    moderate: "Moderate Readiness",
    strong: "Strong Readiness",
  };

  const descs: Record<ReadinessLevel, string> = {
    insufficient_data: "Need more data.",
    building: "Keep practicing. Focus on consistency, risk control, and journaling.",
    moderate: "Good progress. Work on failing areas before attempting a funded challenge.",
    strong: "Solid paper performance. Review funded challenge rules carefully before applying.",
  };

  return { level, label: labels[level], description: descs[level], components, disclaimer };
}

// ── Rule-Based Review ──────────────────────────────────────────────────────

export interface ReviewInsight {
  type: "positive" | "warning" | "neutral";
  text: string;
}

export function generateRuleBasedReview(
  perf: PerformanceOverview,
  symbolAnalytics: SymbolAnalytic[],
  sessionAnalytics: SessionAnalytic[],
  behavior: BehaviorAnalytics
): ReviewInsight[] {
  const insights: ReviewInsight[] = [];

  if (perf.totalTrades < 3) {
    insights.push({
      type: "neutral",
      text: "Close more paper trades to generate a meaningful local performance review.",
    });
    return insights;
  }

  if (perf.netPnl > 0) {
    insights.push({ type: "positive", text: `Your paper trading is net positive at +$${perf.netPnl.toFixed(2)}.` });
  } else if (perf.netPnl < 0) {
    insights.push({ type: "warning", text: `Paper P&L is -$${Math.abs(perf.netPnl).toFixed(2)}. Focus on limiting losses and improving setups.` });
  }

  if (perf.winRate >= 60) {
    insights.push({ type: "positive", text: `Strong win rate of ${perf.winRate}%. Maintain your selectivity.` });
  } else if (perf.winRate < 40 && perf.totalTrades >= 5) {
    insights.push({ type: "warning", text: `Win rate of ${perf.winRate}% is below 40%. Review your entry criteria.` });
  }

  if (perf.avgLoss > perf.avgWin && perf.avgWin > 0 && perf.avgLoss > 0) {
    insights.push({ type: "warning", text: `Average loss ($${perf.avgLoss.toFixed(2)}) exceeds average win ($${perf.avgWin.toFixed(2)}). Improve your risk-reward.` });
  } else if (perf.avgWin > perf.avgLoss && perf.avgWin > 0 && perf.avgLoss > 0) {
    insights.push({ type: "positive", text: `Good risk-reward: avg win $${perf.avgWin.toFixed(2)} vs avg loss $${perf.avgLoss.toFixed(2)}.` });
  }

  if (symbolAnalytics.length > 0) {
    const best = symbolAnalytics[0];
    insights.push({
      type: best.netPnl >= 0 ? "positive" : "warning",
      text: `Best performing: ${best.displayName} — ${best.trades} trade${best.trades > 1 ? "s" : ""}, P&L: ${best.netPnl >= 0 ? "+" : ""}$${best.netPnl.toFixed(2)} (${best.winRate}% win rate).`,
    });
    if (symbolAnalytics.length > 1) {
      const worst = symbolAnalytics[symbolAnalytics.length - 1];
      if (worst.netPnl < 0) {
        insights.push({ type: "warning", text: `Weakest symbol: ${worst.displayName} at $${worst.netPnl.toFixed(2)}. Consider reviewing your approach here.` });
      }
    }
  }

  if (sessionAnalytics.length > 0) {
    const best = [...sessionAnalytics].sort((a, b) => b.netPnl - a.netPnl)[0];
    if (best.netPnl > 0) {
      insights.push({ type: "positive", text: `${best.session.charAt(0).toUpperCase() + best.session.slice(1)} session is your best — ${best.winRate}% win rate, +$${best.netPnl.toFixed(2)}.` });
    }
  }

  if (behavior.didNotFollowPlanCount > 2) {
    insights.push({ type: "warning", text: `You deviated from your plan ${behavior.didNotFollowPlanCount} time${behavior.didNotFollowPlanCount > 1 ? "s" : ""}. Discipline gap to close.` });
  } else if (behavior.followedPlanPercent >= 80 && behavior.withPlanDataCount > 0) {
    insights.push({ type: "positive", text: `Excellent discipline: followed your plan ${behavior.followedPlanPercent}% of the time.` });
  }

  if (perf.slHits > perf.tpHits && perf.totalTrades >= 5) {
    insights.push({ type: "warning", text: `${perf.slHits} SL hits vs ${perf.tpHits} TP hits. Entries may be mistimed or SLs are too tight.` });
  } else if (perf.tpHits > perf.slHits && perf.tpHits > 0) {
    insights.push({ type: "positive", text: `${perf.tpHits} TP hits vs ${perf.slHits} SL hits — targets are being reached regularly.` });
  }

  if (perf.profitFactor >= 2) {
    insights.push({ type: "positive", text: `Excellent profit factor of ${perf.profitFactor} — winners strongly outweigh losers.` });
  } else if (perf.profitFactor > 0 && perf.profitFactor < 1) {
    insights.push({ type: "warning", text: `Profit factor below 1.0 means total losses exceed total wins. Reduce average loss size.` });
  }

  if (behavior.missingNotes > Math.floor(behavior.totalClosedEntries / 2) && behavior.totalClosedEntries > 0) {
    insights.push({ type: "warning", text: `${behavior.missingNotes}/${behavior.totalClosedEntries} journal entries are missing notes. Reflection is key to improvement.` });
  }

  return insights;
}