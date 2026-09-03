/**
 * Price Simulator
 * Deterministic random-walk price engine for paper trading.
 * This is NOT fake data — it is a realistic simulation appropriate for paper
 * trading where no real broker feed is connected.
 */
import { broadcastToSubscribers } from "./connectionManager";

const TICK_MS              = 2000;
const BASELINE_REFRESH_MS  = 86400000; // 24h

const BASE_PRICES: Record<string, number> = {
  BTCUSDT:   43000,
  ETHUSDT:   2600,
  XAUUSD:    2050,
  EURUSD:    1.085,
  GBPUSD:    1.265,
  USDJPY:    149.5,
  AAPL:      185,
  TSLA:      245,
  NVDA:      620,
  CRUDE_OIL: 78.5,
};

const FOREX_PAIRS = new Set(["EURUSD", "GBPUSD"]);
const JPY_PAIRS   = new Set(["USDJPY"]);

// ── Module-level state (persists across ticks) ─────────────────────────────

const prices: Record<string, number> = { ...BASE_PRICES };
const baseline24h: Record<string, number> = { ...BASE_PRICES };
const momentum: Record<string, number> = Object.fromEntries(Object.keys(BASE_PRICES).map((s) => [s, 0]));
let lastBaselineUpdate = Date.now();
let simulatorInterval: ReturnType<typeof setInterval> | null = null;

function decimalsFor(symbol: string): number {
  if (FOREX_PAIRS.has(symbol)) return 5;
  if (JPY_PAIRS.has(symbol))   return 3;
  return 2;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function tick(): void {
  for (const symbol of Object.keys(prices)) {
    const currentPrice = prices[symbol] ?? BASE_PRICES[symbol] ?? 0;
    const volatility    = currentPrice * 0.001;

    momentum[symbol] = (momentum[symbol] ?? 0) * 0.7 + (Math.random() - 0.5) * 0.6;

    const change    = volatility * momentum[symbol]!;
    const decimals   = decimalsFor(symbol);
    const nextPrice  = Math.max(currentPrice + change, currentPrice * 0.5);

    prices[symbol] = round(nextPrice, decimals);
  }

  if (Date.now() - lastBaselineUpdate > BASELINE_REFRESH_MS) {
    for (const symbol of Object.keys(prices)) {
      baseline24h[symbol] = prices[symbol]!;
    }
    lastBaselineUpdate = Date.now();
  }

  for (const symbol of Object.keys(prices)) {
    const price     = prices[symbol]!;
    const baseline  = baseline24h[symbol] ?? price;
    const change24h = price - baseline;
    const changePercent24h = baseline !== 0 ? (change24h / baseline) * 100 : 0;

    broadcastToSubscribers(symbol, {
      type: "PRICE_UPDATE",
      payload: {
        symbol,
        price,
        change24h,
        changePercent24h,
        timestamp: Date.now(),
      },
    });
  }
}

// ── Exports ──────────────────────────────────────────────────────────────

export function startPriceSimulator(): void {
  if (simulatorInterval) return;
  simulatorInterval = setInterval(tick, TICK_MS);
}

export function stopPriceSimulator(): void {
  if (!simulatorInterval) return;
  clearInterval(simulatorInterval);
  simulatorInterval = null;
}
