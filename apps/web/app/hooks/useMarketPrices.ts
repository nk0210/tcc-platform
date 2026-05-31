"use client";
import { useEffect, useState } from "react";
import { useWatchlistStore } from "@/store/watchlistStore";

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

const CRYPTO_SYMBOLS = [
  "BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT",
  "DOGEUSDT","ADAUSDT","AVAXUSDT","DOTUSDT","LINKUSDT",
  "MATICUSDT","LTCUSDT","ATOMUSDT","UNIUSDT","AAVEUSDT",
];

const STREAMS = CRYPTO_SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join("/");
const WS_URL = `wss://stream.binance.com:9443/stream?streams=${STREAMS}`;
const REST_URL = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${CRYPTO_SYMBOLS.map(s => `"${s}"`).join(",")}]`;

// ─── Module-level singletons (shared across all hook instances) ───
let globalTickers: Record<string, MarketTicker> = {};
let subscribers = new Set<(t: Record<string, MarketTicker>) => void>();
let wsInstance: WebSocket | null = null;
let restInterval: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 5000;
let isInitialized = false;

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

function updateWatchlist(ticker: MarketTicker) {
  useWatchlistStore.getState().updatePrice(ticker.symbol, {
    currentPrice: ticker.price,
    change24h: ticker.change,
    changePct24h: ticker.changePct,
    high24h: ticker.high,
    low24h: ticker.low,
    volume24h: ticker.volume,
  });
}

function fetchRest() {
  fetch(REST_URL)
    .then(r => r.json())
    .then((data: any[]) => {
      data.forEach(d => {
        const t = parseTicker(d);
        globalTickers[t.symbol] = t;
        updateWatchlist(t);
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
    reconnectDelay = 5000; // reset backoff
    stopRest(); // WS is working — stop REST polling
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.data) {
        const t = parseTicker(msg.data);
        if (!t.symbol) return;
        globalTickers[t.symbol] = t;
        updateWatchlist(t);
        notify();
      }
    } catch {}
  };

  ws.onerror = () => {};

  ws.onclose = () => {
    wsInstance = null;
    startRest(); // Fallback to REST
    // Reconnect with exponential backoff (max 30s)
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
      connectWS();
    }, reconnectDelay);
  };
}

function initialize() {
  if (isInitialized) return;
  isInitialized = true;
  startRest(); // Start REST immediately for fast first load
  connectWS(); // Then connect WS (will stop REST when open)
}

export function useMarketPrices() {
  const [tickers, setTickers] = useState<Record<string, MarketTicker>>(globalTickers);
  const [loading, setLoading] = useState(Object.keys(globalTickers).length === 0);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    // Subscribe to price updates
    const subscriber = (t: Record<string, MarketTicker>) => {
      setTickers({ ...t });
      if (Object.keys(t).length > 0) setLoading(false);
      setWsConnected(wsInstance?.readyState === WebSocket.OPEN);
    };
    subscribers.add(subscriber);

    // Initialize if not already done
    initialize();

    // If we already have data, render immediately
    if (Object.keys(globalTickers).length > 0) {
      setTickers({ ...globalTickers });
      setLoading(false);
    }

    return () => {
      subscribers.delete(subscriber);
      // Note: We intentionally keep WS alive — this is a trading platform
    };
  }, []);

  return { tickers, loading, wsConnected, symbols: CRYPTO_SYMBOLS };
}