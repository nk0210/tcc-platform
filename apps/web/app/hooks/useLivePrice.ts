"use client";
import { useEffect, useRef } from "react";
import { usePriceStore } from "@/store/priceStore";
import { useTradeStore } from "@/store/tradeStore";
import { TCCSymbol } from "@/lib/markets/symbols";

export function useLivePrice(symbol: TCCSymbol) {
  const { setPrice } = usePriceStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Non-crypto or no Binance symbol → no live price
    if (!symbol.binanceSymbol || !symbol.livePriceSupported) {
      setPrice(0, 0, 0);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Fetch initial price immediately via REST
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol.binanceSymbol}`)
      .then(r => r.json())
      .then(data => {
        const price = parseFloat(data.lastPrice);
        const change = parseFloat(data.priceChange);
        const changePct = parseFloat(data.priceChangePercent);
        setPrice(price, change, changePct);
        if (price > 0) useTradeStore.getState().updatePrices(symbol.id, price);
      })
      .catch(() => {});

    // WebSocket for real-time updates
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbol.binanceSymbol.toLowerCase()}@ticker`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const price = parseFloat(msg.c);
        const change = parseFloat(msg.p);
        const changePct = parseFloat(msg.P);
        setPrice(price, change, changePct);
        if (price > 0) useTradeStore.getState().updatePrices(symbol.id, price);
      } catch {}
    };

    ws.onerror = () => {};

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [symbol.id]);
}