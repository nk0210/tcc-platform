"use client";
import { useEffect, useState } from "react";
import TradingViewChart from "@/components/TradingViewChart";
import { useLivePrice } from "@/hooks/useLivePrice";
import { usePriceStore } from "@/store/priceStore";
import { useTradeStore } from "@/store/tradeStore";
import { useJournalStore, detectSession } from "@/store/journalStore";
import { calculateRiskScore } from "@/store/riskStore";
import { useSymbolStore, SYMBOLS, Symbol } from "@/store/symbolStore";

const ASSET_CLASSES = ["Crypto", "Forex", "Commodities", "Indices"] as const;
type AssetClassTab = typeof ASSET_CLASSES[number];

const assetClassMap: Record<AssetClassTab, string> = {
  Crypto: "crypto",
  Forex: "forex",
  Commodities: "commodity",
  Indices: "index",
};

const assetBadgeStyle: Record<string, string> = {
  crypto: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  forex: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  commodity: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  index: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

export default function CenterChart() {
  const [lots, setLots] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<"BUY" | "SELL" | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<AssetClassTab>("Crypto");

  const { activeSymbol, setActiveSymbol } = useSymbolStore();

  // Live price for crypto only (useLivePrice handles non-crypto gracefully)
  useLivePrice(activeSymbol);

  const { currentPrice, change, changePct } = usePriceStore();
  const { openPosition, positions } = useTradeStore();
  const { addEntry: addJournalEntry } = useJournalStore();

  const isCrypto = activeSymbol.assetClass === "crypto";
  const priceColor = change >= 0 ? "text-green-400" : "text-red-400";
  const sign = change >= 0 ? "+" : "";

  const filteredSymbols = SYMBOLS.filter(
    s => s.assetClass === assetClassMap[activeTab]
  );

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
    // For non-crypto, use a placeholder price of 1 (demo limitation)
    const entryPrice = currentPrice > 0 ? currentPrice : 1;
    const tradeId = Date.now().toString();

    openPosition({
      symbol: activeSymbol.id,
      direction,
      lots: parseFloat(lots) || 0.01,
      entryPrice,
      sl: parseFloat(sl) || 0,
      tp: parseFloat(tp) || 0,
    });

    addJournalEntry({
      tradeId,
      symbol: activeSymbol.id,
      direction,
      entryPrice,
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* Risk Warning */}
      {showRiskWarning && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="glass border border-red-500/30 rounded-xl p-6 max-w-sm w-full mx-4">
            <div className="text-red-400 font-bold text-lg mb-2">⚠ Risk Warning</div>
            <div className="text-white/60 text-sm mb-4">
              {calculateRiskScore().recommendation}
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

      {/* Symbol Dropdown Backdrop */}
      {showDropdown && (
        <div className="fixed inset-0 z-30" onClick={() => setShowDropdown(false)} />
      )}

      {/* Top Bar */}
      <div className="glass flex items-center gap-3 px-4 py-2 border-b border-white/5 flex-wrap relative z-40">

        {/* Symbol Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 transition">
            <span className="text-lg">{activeSymbol.emoji}</span>
            <span className="text-white font-semibold text-sm">{activeSymbol.label}</span>
            <span className="text-white/30 text-xs">{showDropdown ? "▲" : "▼"}</span>
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 glass border border-white/10 rounded-xl p-3 w-80 shadow-2xl">
              {/* Asset class tabs */}
              <div className="flex gap-1 mb-3">
                {ASSET_CLASSES.map(ac => (
                  <button key={ac} onClick={() => setActiveTab(ac)}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold transition ${activeTab === ac ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60 hover:bg-white/5"}`}>
                    {ac}
                  </button>
                ))}
              </div>
              {/* Symbol list */}
              <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                {filteredSymbols.map(s => (
                  <button key={s.id}
                    onClick={() => { setActiveSymbol(s); setShowDropdown(false); }}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left transition ${activeSymbol.id === s.id ? "bg-green-500/10 text-green-400" : "text-white/60 hover:bg-white/5"}`}>
                    <span className="text-base">{s.emoji}</span>
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-white/30 ml-auto text-xs">{s.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Asset class badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${assetBadgeStyle[activeSymbol.assetClass]}`}>
          {activeSymbol.assetClass.toUpperCase()}
        </span>

        {/* Live price (crypto only) */}
        {isCrypto && currentPrice > 0 ? (
          <>
            <span className={`text-lg font-bold ${priceColor}`}>
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-xs ${priceColor}`}>
              {sign}{change.toFixed(2)} ({sign}{changePct.toFixed(2)}%)
            </span>
          </>
        ) : isCrypto ? (
          <span className="text-white/30 text-sm animate-pulse">Loading...</span>
        ) : (
          <span className="text-white/30 text-xs italic">Live price shown in chart</span>
        )}

        {/* Non-crypto note */}
        {!isCrypto && (
          <span className="ml-auto text-xs text-amber-400/60 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-full">
            ⚠ Paper demo — simulated entry price
          </span>
        )}
      </div>

      {/* TradingView Chart — takes all remaining space */}
      <div
        className="flex-1"
        style={{ minHeight: 0 }}
        onClick={() => setShowDropdown(false)}>
        <TradingViewChart
          symbol={activeSymbol.tradingViewSymbol}
          interval="60"
          height="100%"
          theme="dark"
        />
      </div>

      {/* BUY/SELL Panel */}
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
          <input value={lots}
            onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setLots(e.target.value); }}
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">SL</span>
          <input value={sl}
            onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setSl(e.target.value); }}
            placeholder="Optional"
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-24 text-center" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">TP</span>
          <input value={tp}
            onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setTp(e.target.value); }}
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