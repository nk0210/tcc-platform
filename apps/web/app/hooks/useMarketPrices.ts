"use client";
/**
 * TCC Market Prices Hook
 * Uses central symbol config for Binance streams.
 * Crypto: Binance WebSocket (primary) → REST fallback.
 * Non-crypto: no price data here — use TradingView chart only.
 */
import { useEffect, useState } from "react";
import { useWatchlistStore } from "@/store/watchlistStore";
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

function notify() {
  subscribers.forEach(fn => fn({ ...globalTickers }));
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

function updateWatchlistPrices(ticker: MarketTicker) {
  const { items, updatePrice } = useWatchlistStore.getState();
  const watched = items.find(i => i.symbolId === ticker.symbol);
  if (watched) {
    updatePrice(ticker.symbol, {
      currentPrice: ticker.price,
      change24h: ticker.change,
      changePct24h: ticker.changePct,
      high24h: ticker.high,
      low24h: ticker.low,
      volume24h: ticker.volume,
    });
  }
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