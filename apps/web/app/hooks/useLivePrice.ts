"use client";
import { useEffect, useRef } from "react";
import { usePriceStore } from "@/store/priceStore";
import { useTradeStore } from "@/store/tradeStore";
import { Symbol } from "@/store/symbolStore";

export function useLivePrice(symbol: Symbol) {
  const { setPrice } = usePriceStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Reset price and stop WS for non-crypto symbols
    if (!symbol.binanceSymbol) {
      setPrice(0, 0, 0);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Close existing connection
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
        if (price > 0) {
          useTradeStore.getState().updatePrices(symbol.id, price);
        }
      })
      .catch(() => {});

    // WebSocket for real-time ticker updates
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbol.binanceSymbol.toLowerCase()}@ticker`
    );
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const price = parseFloat(msg.c);   // last price
        const change = parseFloat(msg.p);   // price change
        const changePct = parseFloat(msg.P); // price change %
        setPrice(price, change, changePct);
        if (price > 0) {
          useTradeStore.getState().updatePrices(symbol.id, price);
        }
      } catch {}
    };

    ws.onerror = () => {
      // Silently fail — REST already loaded initial price
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [symbol.id]);
}