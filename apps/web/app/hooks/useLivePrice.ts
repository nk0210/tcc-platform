"use client";
import { useEffect } from "react";
import { usePriceStore } from "@/store/priceStore";

export function useLivePrice(symbol: string = "XAUUSDT") {
  const { setPrice, setCandles } = usePriceStore();

  useEffect(() => {
    async function fetchCandles() {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=200`
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
      `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_1h`
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

    return () => ws.close();
  }, [symbol]);
}