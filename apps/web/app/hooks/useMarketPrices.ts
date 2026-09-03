"use client";
/**
 * TCC Market Prices Hook
 * Uses central symbol config for Binance streams.
 * Crypto: Binance WebSocket (primary) → REST fallback.
 * Non-crypto: no price data here — use TradingView chart only.
 */
import { useEffect, useState } from "react";
import { useWatchlistStore, type LiveTickerUpdate } from "@/store/watchlistStore";
import { BINANCE_STREAM_SYMBOLS } from "@/lib/markets/symbols";

export interface MarketTicker {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
}

const STREAMS = BINANCE_STREAM_SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join("/");
const WS_URL = `wss://stream.binance.com:9443/stream?streams=${STREAMS}`;
const REST_URL = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${BINANCE_STREAM_SYMBOLS.map(s => `"${s}"`).join(",")}]`;

// ── Module-level singletons — shared across all hook instances ───────────
let globalTickers: Record<string, MarketTicker> = {};
let wsInstance: WebSocket | null = null;
let restInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 5000;
let isInitialized = false;
let isWsOpen = false;
const subscribers = new Set<(t: Record<string, MarketTicker>) => void>();

// Binance's combined @ticker stream can push updates for every subscribed
// symbol roughly once a second each — with ~12 symbols that's up to ~12
// messages/sec, and calling notify() on every single one re-renders every
// consumer (watchlist, markets) that many times a second for no visible
// benefit at that refresh rate. Coalesce bursts into one flush per window
// instead — ticker math above (globalTickers, updateWatchlistPrices) still
// runs immediately per message, only the React-facing notify is throttled.
const NOTIFY_INTERVAL_MS = 500;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
let notifyPending = false;

function notify() {
  if (notifyTimer) { notifyPending = true; return; }
  flushWatchlistPrices();
  subscribers.forEach(fn => fn({ ...globalTickers }));
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    if (notifyPending) { notifyPending = false; notify(); }
  }, NOTIFY_INTERVAL_MS);
}

function parseTicker(d: any): MarketTicker {
  return {
    symbol: d.s || d.symbol || "",
    price: parseFloat(d.c || d.lastPrice || "0"),
    change: parseFloat(d.p || d.priceChange || "0"),
    changePct: parseFloat(d.P || d.priceChangePercent || "0"),
    high: parseFloat(d.h || d.highPrice || "0"),
    low: parseFloat(d.l || d.lowPrice || "0"),
    volume: parseFloat(d.v || d.volume || "0"),
    quoteVolume: parseFloat(d.q || d.quoteVolume || "0"),
  };
}

// Queue the raw ticker per symbol instead of writing straight to the store —
// a WS message can arrive for every symbol roughly once a second, and each
// updatePrice() call replaces the whole `items` array, re-rendering every
// watchlist consumer on every single message. flushWatchlistPrices() below
// applies the whole queue in one store write, on the same throttle cadence
// as notify().
const pendingWatchlistUpdates = new Map<string, LiveTickerUpdate>();

function updateWatchlistPrices(ticker: MarketTicker) {
  pendingWatchlistUpdates.set(ticker.symbol, {
    currentPrice: ticker.price,
    change24h: ticker.change,
    changePct24h: ticker.changePct,
    high24h: ticker.high,
    low24h: ticker.low,
    volume24h: ticker.volume,
  });
}

function flushWatchlistPrices() {
  if (pendingWatchlistUpdates.size === 0) return;
  const updates = pendingWatchlistUpdates;
  pendingWatchlistUpdates.clear();
  useWatchlistStore.setState((s) => ({
    items: s.items.map((i) => {
      const u = updates.get(i.symbolId);
      return u ? { ...i, ...u } : i;
    }),
  }));
}

function fetchRest() {
  fetch(REST_URL)
    .then(r => r.json())
    .then((data: any[]) => {
      if (!Array.isArray(data)) return;
      data.forEach(d => {
        const t = parseTicker(d);
        if (!t.symbol) return;
        globalTickers[t.symbol] = t;
        updateWatchlistPrices(t);
      });
      notify();
    })
    .catch(() => {});
}

function startRest() {
  if (restInterval) return;
  fetchRest();
  restInterval = setInterval(fetchRest, 15000);
}

function stopRest() {
  if (restInterval) { clearInterval(restInterval); restInterval = null; }
}

function connectWS() {
  if (wsInstance && (wsInstance.readyState === WebSocket.CONNECTING || wsInstance.readyState === WebSocket.OPEN)) return;

  const ws = new WebSocket(WS_URL);
  wsInstance = ws;

  ws.onopen = () => {
    isWsOpen = true;
    reconnectDelay = 5000;
    stopRest(); // WS working — REST not needed
    notify();
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.data) {
        const t = parseTicker(msg.data);
        if (!t.symbol) return;
        globalTickers[t.symbol] = t;
        updateWatchlistPrices(t);
        notify();
      }
    } catch {}
  };

  ws.onerror = () => {};

  ws.onclose = () => {
    isWsOpen = false;
    wsInstance = null;
    startRest(); // Fallback REST on WS close
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
      connectWS();
    }, reconnectDelay);
    notify();
  };
}

function initialize() {
  if (isInitialized) return;
  isInitialized = true;
  startRest(); // Immediate first load via REST
  connectWS(); // Then WS (will stop REST once open)
}

export function useMarketPrices() {
  const [tickers, setTickers] = useState<Record<string, MarketTicker>>(globalTickers);
  const [loading, setLoading] = useState(Object.keys(globalTickers).length === 0);
  const [wsConnected, setWsConnected] = useState(isWsOpen);

  useEffect(() => {
    const sub = (t: Record<string, MarketTicker>) => {
      setTickers({ ...t });
      if (Object.keys(t).length > 0) setLoading(false);
      setWsConnected(isWsOpen);
    };
    subscribers.add(sub);
    initialize();

    if (Object.keys(globalTickers).length > 0) {
      setTickers({ ...globalTickers });
      setLoading(false);
    }

    return () => { subscribers.delete(sub); };
  }, []);

  return {
    tickers,
    loading,
    wsConnected,
    /** Only crypto symbols with Binance data */
    cryptoSymbols: BINANCE_STREAM_SYMBOLS,
  };
}