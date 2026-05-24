"use client";
import { useEffect, useRef } from "react";
import { usePriceStore } from "@/store/priceStore";
import { Symbol } from "@/store/symbolStore";

export function useLivePrice(symbol: Symbol) {
  const { setPrice, setCandles } = usePriceStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!symbol.binanceSymbol) return;

    // Close existing WebSocket
    if (wsRef.current) wsRef.current.close();

    // Clear candles on symbol switch
    setCandles([]);
    setPrice(0, 0, 0);

    async function fetchCandles() {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol.binanceSymbol}&interval=1h&limit=200`
        );
        const data = await res.json();
        const candles = data.map((k: any) => ({
          time: k[0] / 1000,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        setCandles(candles);
        const last = candles[candles.length - 1];
        const first = candles[0];
        const change = last.close - first.open;
        const changePct = (change / first.open) * 100;
        setPrice(last.close, change, changePct);
      } catch (err) {
        console.error("Failed to fetch candles:", err);
      }
    }

    fetchCandles();

    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${symbol.binanceSymbol.toLowerCase()}@kline_1h`
    );

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const k = msg.k;
      const candle = {
        time: k.t / 1000,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
      };
      usePriceStore.getState().addCandle(candle);
      usePriceStore.getState().setPrice(
        parseFloat(k.c),
        parseFloat(k.c) - parseFloat(k.o),
        ((parseFloat(k.c) - parseFloat(k.o)) / parseFloat(k.o)) * 100
      );
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [symbol.id]);
}