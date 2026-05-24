"use client";
import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";
import { useLivePrice } from "@/hooks/useLivePrice";
import { usePriceStore } from "@/store/priceStore";
import { useTradeStore } from "@/store/tradeStore";
import { useSymbolStore, SYMBOLS } from "@/store/symbolStore";
import { useJournalStore, detectSession } from "@/store/journalStore";
import { useRiskStore, calculateRiskScore } from "@/store/riskStore";

export default function CenterChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  const [lots, setLots] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<"BUY" | "SELL" | null>(null);

  const { activeSymbol, setActiveSymbol } = useSymbolStore();
  useLivePrice(activeSymbol);

  const { currentPrice, change, changePct, candles } = usePriceStore();
  const { openPosition, updatePrices, positions } = useTradeStore();
  const { addEntry: addJournalEntry } = useJournalStore();

  useEffect(() => {
    if (currentPrice > 0) updatePrices(activeSymbol.id, currentPrice);
  }, [currentPrice, activeSymbol.id]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "rgba(255, 255, 255, 0.5)" },
      grid: { vertLines: { color: "rgba(255, 255, 255, 0.03)" }, horzLines: { color: "rgba(255, 255, 255, 0.03)" } },
      crosshair: { vertLine: { color: "rgba(0, 255, 136, 0.3)" }, horzLine: { color: "rgba(0, 255, 136, 0.3)" } },
      rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.05)" },
      timeScale: { borderColor: "rgba(255, 255, 255, 0.05)", timeVisible: true },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00ff88", downColor: "#ff4466",
      borderUpColor: "#00ff88", borderDownColor: "#ff4466",
      wickUpColor: "#00ff88", wickDownColor: "#ff4466",
    });
    chartRef.current = chart;
    seriesRef.current = candleSeries;
    const resizeObserver = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    });
    resizeObserver.observe(chartContainerRef.current);
    return () => { resizeObserver.disconnect(); chart.remove(); };
  }, []);

  useEffect(() => {
    if (seriesRef.current && candles.length > 0) {
      const unique = Array.from(new Map(candles.map((c) => [c.time, c])).values()).sort((a, b) => a.time - b.time);
      seriesRef.current.setData(unique);
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  const handleTrade = (direction: "BUY" | "SELL") => {
    const score = calculateRiskScore();
    if (score.level === "EXTREME" || score.level === "HIGH" || positions.length >= 3) {
      setPendingDirection(direction);
      setShowRiskWarning(true);
      return;
    }
    placeTrade(direction);
};

  const placeTrade = (direction: "BUY" | "SELL") => {
    if (!currentPrice) return;
    const { refresh } = useRiskStore.getState();
    refresh();
    const tradeId = Date.now().toString();
    openPosition({
      symbol: activeSymbol.id,
      direction,
      lots: parseFloat(lots) || 0.01,
      entryPrice: currentPrice,
      sl: parseFloat(sl) || 0,
      tp: parseFloat(tp) || 0,
    });
    addJournalEntry({
      tradeId,
      symbol: activeSymbol.id,
      direction,
      entryPrice: currentPrice,
      lots: parseFloat(lots) || 0.01,
      sl: parseFloat(sl) || 0,
      tp: parseFloat(tp) || 0,
      session: detectSession(),
      timeframe: "1H",
      emotion: "neutral",
      confidenceLevel: 5,
      stressLevel: 3,
      entryQuality: "good",
      followedPlan: null,
      strategy: "other",
      marketStructure: "bullish",
      notes: "",
      whatWentRight: "",
      whatWentWrong: "",
      lessonLearned: "",
      tags: [],
    });
    setSl("");
    setTp("");
    setShowRiskWarning(false);
    setPendingDirection(null);
  };

  const priceColor = change >= 0 ? "text-green-400" : "text-red-400";
  const sign = change >= 0 ? "+" : "";

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {showRiskWarning && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="glass border border-red-500/30 rounded-xl p-6 max-w-sm w-full mx-4">
            <div className="text-red-400 font-bold text-lg mb-2">⚠ Risk Warning</div>
            <div className="text-white/60 text-sm mb-4">
              You already have {positions.length} open positions. Adding more increases your risk exposure significantly.
            </div>
            <div className="flex gap-3">
              <button onClick={() => { if (pendingDirection) placeTrade(pendingDirection); }}
                className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-lg text-sm font-semibold">
                Place Anyway
              </button>
              <button onClick={() => { setShowRiskWarning(false); setPendingDirection(null); }}
                className="flex-1 bg-white/5 text-white/60 py-2 rounded-lg text-sm font-semibold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass flex items-center gap-4 px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-1 mr-2">
          {SYMBOLS.map((s: any) => (
            <button key={s.id} onClick={() => setActiveSymbol(s)}
              className={`text-xs px-2 py-1 rounded transition font-semibold ${
                activeSymbol.id === s.id
                  ? "bg-green-400/20 text-green-400 border border-green-400/30"
                  : "text-white/30 hover:text-white/60 hover:bg-white/5"
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-white/10" />

        <span className={`text-lg font-bold ${priceColor}`}>
          ${currentPrice > 0 ? currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Loading..."}
        </span>
        <span className={`text-xs ${priceColor}`}>
          {currentPrice > 0 ? `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)` : ""}
        </span>

        <div className="flex gap-1 ml-2">
          {["1M","5M","15M","1H","4H","1D","1W"].map((tf) => (
            <button key={tf} className={`text-xs px-2 py-1 rounded transition ${tf === "1H" ? "text-green-400 bg-green-400/10" : "text-white/40 hover:text-green-400 hover:bg-green-400/10"}`}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div ref={chartContainerRef} className="flex-1" />

      <div className="glass flex items-center gap-4 px-4 py-3 border-t border-white/5">
        <button onClick={() => handleTrade("BUY")}
          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
          BUY
        </button>
        <button onClick={() => handleTrade("SELL")}
          className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
          SELL
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-white/40 text-xs">Lot Size</span>
          <input value={lots} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setLots(e.target.value); }}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">SL</span>
          <input value={sl} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setSl(e.target.value); }}
            placeholder="Optional"
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-24 text-center" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">TP</span>
          <input value={tp} onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setTp(e.target.value); }}
            placeholder="Optional"
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-24 text-center" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-white/40 text-xs">Open</span>
          <span className="text-white text-sm font-semibold">{positions.length}</span>
        </div>
      </div>

    </div>
  );
}