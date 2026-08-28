/**
 * TCC Paper Trading Calculations
 *
 * INTERNAL PAPER CALCULATION MODEL — not broker-accurate.
 * For paper/demo trading only. Clearly labeled as Paper Mode.
 *
 * Contract sizes are simplified for demo purposes.
 * Phase Alpha will replace these with broker-accurate values.
 */

export type TradeSide = "BUY" | "SELL";

// ── Contract sizes (internal paper model) ──────────────────────────────────
// Represents how many units 1 standard lot equals for each symbol.
export const PAPER_CONTRACT_SIZES: Record<string, number> = {
  // Crypto — 1 unit per lot (1 lot BTCUSDT = 1 BTC)
  BTCUSDT: 1, ETHUSDT: 1, SOLUSDT: 1, BNBUSDT: 1, XRPUSDT: 1,
  DOGEUSDT: 1, ADAUSDT: 1, AVAXUSDT: 1, DOTUSDT: 1,
  LINKUSDT: 1, MATICUSDT: 1, LTCUSDT: 1,
  // Forex — micro lot (1,000 units) for paper demo
  EURUSD: 1000, GBPUSD: 1000, USDJPY: 1000, USDCHF: 1000,
  USDCAD: 1000, AUDUSD: 1000, NZDUSD: 1000, EURGBP: 1000,
  EURJPY: 1000, GBPJPY: 1000, AUDJPY: 1000, CADJPY: 1000,
  // Commodities
  XAUUSD: 1,    // 1 oz per lot (paper)
  XAGUSD: 1,    // 1 oz per lot (paper)
  USOIL: 10,    // 10 barrels per lot (paper)
  UKOIL: 10,
  NATGAS: 10,
  // Indices — 1 index point per lot (paper)
  US30: 1, SPX500: 1, NAS100: 1, DXY: 1, VIX: 1,
  GER40: 1, UK100: 1, NIFTY50: 1, BANKNIFTY: 1,
};

export function getContractSize(symbolId: string): number {
  return PAPER_CONTRACT_SIZES[symbolId] ?? 1;
}

/** Calculate notional (position) value = price × lots × contractSize */
export function calcNotional(symbolId: string, lotSize: number, price: number): number {
  return price * lotSize * getContractSize(symbolId);
}

/** Calculate margin required = notional / leverage */
export function calcMargin(
  symbolId: string, lotSize: number, price: number, leverage: number
): number {
  return calcNotional(symbolId, lotSize, price) / Math.max(leverage, 1);
}

/**
 * Calculate gross P&L.
 * BUY: profit when price rises. SELL: profit when price falls.
 * Gross = priceChange × lots × contractSize
 */
export function calcGrossPnl(
  symbolId: string, side: TradeSide,
  lotSize: number, entryPrice: number, currentPrice: number
): number {
  const qty = lotSize * getContractSize(symbolId);
  return side === "BUY"
    ? (currentPrice - entryPrice) * qty
    : (entryPrice - currentPrice) * qty;
}

/**
 * Simulated commission: 0.01% of the gross P&L magnitude.
 * Must match `COMMISSION_RATE` in apps/api/src/server/services/tradeService.ts
 * exactly — this function drives the *live* floating P&L shown while a
 * position is open, and the backend's identical formula is what actually
 * gets settled when the position closes. If these diverge, the number a
 * trader watches in real time won't match what they're paid out.
 */
const COMMISSION_RATE = 0.0001;

/** Calculate net P&L = gross - simulated commission */
export function calcNetPnl(
  symbolId: string, side: TradeSide,
  lotSize: number, entryPrice: number, currentPrice: number
): number {
  const gross = calcGrossPnl(symbolId, side, lotSize, entryPrice, currentPrice);
  const commission = Math.abs(gross) * COMMISSION_RATE;
  return gross - commission;
}

/** Recalculate account metrics from all open positions */
export function recalcAccount(
  positions: Array<{ marginUsed: number; floatingPnl: number }>,
  balance: number
): {
  equity: number;
  freeMargin: number;
  marginUsed: number;
  marginLevel: number;
  floatingPnl: number;
} {
  const marginUsed = positions.reduce((s, p) => s + p.marginUsed, 0);
  const floatingPnl = positions.reduce((s, p) => s + p.floatingPnl, 0);
  const equity = balance + floatingPnl;
  const freeMargin = equity - marginUsed;
  const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : 0;
  return {
    equity: parseFloat(equity.toFixed(2)),
    freeMargin: parseFloat(freeMargin.toFixed(2)),
    marginUsed: parseFloat(marginUsed.toFixed(2)),
    marginLevel: parseFloat(marginLevel.toFixed(1)),
    floatingPnl: parseFloat(floatingPnl.toFixed(2)),
  };
}

/** Check if stop loss is triggered */
export function isStopLossTriggered(
  side: TradeSide, currentPrice: number, sl: number | null
): boolean {
  if (!sl || sl <= 0) return false;
  return side === "BUY" ? currentPrice <= sl : currentPrice >= sl;
}

/** Check if take profit is triggered */
export function isTakeProfitTriggered(
  side: TradeSide, currentPrice: number, tp: number | null
): boolean {
  if (!tp || tp <= 0) return false;
  return side === "BUY" ? currentPrice >= tp : currentPrice <= tp;
}

export interface TradeValidationResult {
  valid: boolean;
  error?: string;
}

/** Validate paper trade before opening — no broker calls, all local */
export function validatePaperTrade(params: {
  symbolId: string;
  lotSize: number;
  entryPrice: number;
  side: TradeSide;
  sl: number | null;
  tp: number | null;
  freeMargin: number;
  leverage: number;
}): TradeValidationResult {
  const { symbolId, lotSize, entryPrice, side, sl, tp, freeMargin, leverage } = params;

  if (!symbolId) return { valid: false, error: "No symbol selected." };

  if (!lotSize || lotSize <= 0 || isNaN(lotSize))
    return { valid: false, error: "Lot size must be greater than 0." };

  if (lotSize > 100)
    return { valid: false, error: "Lot size cannot exceed 100 in paper mode." };

  if (!entryPrice || entryPrice <= 0 || isNaN(entryPrice))
    return {
      valid: false,
      error: "Paper trade unavailable: live/current price not available for this symbol.",
    };

  const marginNeeded = calcMargin(symbolId, lotSize, entryPrice, leverage);
  if (marginNeeded > freeMargin)
    return {
      valid: false,
      error: `Insufficient free margin. Need $${marginNeeded.toFixed(2)}, available $${freeMargin.toFixed(2)}.`,
    };

  if (sl && sl > 0) {
    if (side === "BUY" && sl >= entryPrice)
      return { valid: false, error: "Stop loss must be below entry price for BUY." };
    if (side === "SELL" && sl <= entryPrice)
      return { valid: false, error: "Stop loss must be above entry price for SELL." };
  }

  if (tp && tp > 0) {
    if (side === "BUY" && tp <= entryPrice)
      return { valid: false, error: "Take profit must be above entry price for BUY." };
    if (side === "SELL" && tp >= entryPrice)
      return { valid: false, error: "Take profit must be below entry price for SELL." };
  }

  return { valid: true };
}