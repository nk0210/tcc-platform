"use client";
import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";
import { useLivePrice } from "@/hooks/useLivePrice";
import { usePriceStore } from "@/store/priceStore";

export default function CenterChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  useLivePrice("BTCUSDT");

  const { currentPrice, change, changePct, candles } = usePriceStore();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.5)",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: "rgba(255, 255, 255, 0.03)" },
      },
      crosshair: {
        vertLine: { color: "rgba(0, 255, 136, 0.3)" },
        horzLine: { color: "rgba(0, 255, 136, 0.3)" },
      },
      rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.05)" },
      timeScale: { borderColor: "rgba(255, 255, 255, 0.05)", timeVisible: true },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00ff88",
      downColor: "#ff4466",
      borderUpColor: "#00ff88",
      borderDownColor: "#ff4466",
      wickUpColor: "#00ff88",
      wickDownColor: "#ff4466",
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      const unique = Array.from(
        new Map(candles.map((c) => [c.time, c])).values()
      ).sort((a, b) => a.time - b.time);
      seriesRef.current.setData(unique);
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  const priceColor = change >= 0 ? "text-green-400" : "text-red-400";
  const sign = change >= 0 ? "+" : "";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      <div className="glass flex items-center gap-4 px-4 py-2 border-b border-white/5">
        <span className="text-white font-semibold">BTC/USDT</span>
        <span className={`text-lg font-bold ${priceColor}`}>
          ${currentPrice > 0 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Loading..."}
        </span>
        <span className={`text-xs ${priceColor}`}>
          {currentPrice > 0 ? `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)` : ""}
        </span>
        <div className="flex gap-2 ml-4">
          {["1M","5M","15M","1H","4H","1D","1W"].map((tf) => (
            <button key={tf} className={`text-xs px-2 py-1 rounded transition ${tf === "1H" ? "text-green-400 bg-green-400/10" : "text-white/40 hover:text-green-400 hover:bg-green-400/10"}`}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div ref={chartContainerRef} className="flex-1" />

      <div className="glass flex items-center gap-4 px-4 py-3 border-t border-white/5">
        <button className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
          BUY
        </button>
        <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
          SELL
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-white/40 text-xs">Lot Size</span>
          <input className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" defaultValue="0.01" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">SL</span>
          <input className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" defaultValue="0.00" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">TP</span>
          <input className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" defaultValue="0.00" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-white/40 text-xs">Risk</span>
          <span className="text-amber-400 text-sm font-semibold">1.2%</span>
        </div>
      </div>

    </div>
  );
}