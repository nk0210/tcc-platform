"use client";
/**
 * TCC Center Chart — Dashboard trading panel.
 *
 * Handles:
 * - Symbol selection (all TCC_SYMBOLS via central config)
 * - TradingView chart display (all symbols)
 * - Paper trade execution (validation + open)
 * - Live price display (crypto only via Binance)
 * - Manual reference price for non-crypto paper trades
 * - Risk warnings before opening
 */
import { useState, useCallback } from "react";
import TradingViewChart from "@/components/TradingViewChart";
import { useLivePrice } from "@/hooks/useLivePrice";
import { usePriceStore } from "@/store/priceStore";
import { useTradeStore } from "@/store/tradeStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSymbolStore } from "@/store/symbolStore";
import { calculateRiskScore } from "@/store/riskStore";
import { validatePaperTrade } from "@/lib/trading/calculations";
import { TCC_SYMBOLS, TCCSymbol, SymbolCategory } from "@/lib/markets/symbols";

type AssetTab = { label: string; category: SymbolCategory };

const ASSET_TABS: AssetTab[] = [
  { label: "Crypto", category: "crypto" },
  { label: "Forex", category: "forex" },
  { label: "Commodities", category: "commodity" },
  { label: "Indices", category: "index" },
];

const CATEGORY_BADGE: Record<SymbolCategory, string> = {
  crypto: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  forex: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  commodity: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  index: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

export default function CenterChart() {
  const [lotSize, setLotSize] = useState("0.01");
  const [slInput, setSlInput] = useState("");
  const [tpInput, setTpInput] = useState("");
  const [manualPrice, setManualPrice] = useState(""); // for non-crypto
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownCategory, setDropdownCategory] = useState<SymbolCategory>("crypto");
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  const [pendingSide, setPendingSide] = useState<"BUY" | "SELL" | null>(null);

  const { activeSymbol, setActiveSymbol } = useSymbolStore();
  const { openPosition, freeMargin, leverage, positions } = useTradeStore();
  const { addNotification } = useNotificationStore();
  const { currentPrice, change, changePct } = usePriceStore();

  useLivePrice(activeSymbol);

  const isCrypto = activeSymbol.livePriceSupported;

  // Effective entry price: live for crypto, manual for non-crypto
  const effectivePrice = isCrypto
    ? currentPrice
    : (parseFloat(manualPrice) > 0 ? parseFloat(manualPrice) : 0);

  const priceColor = change >= 0 ? "text-green-400" : "text-red-400";
  const priceMark = change >= 0 ? "+" : "";

  const filteredSymbols = TCC_SYMBOLS.filter(s => s.category === dropdownCategory);

  // ── Trade validation & execution ─────────────────────────────────────

  const executeTrade = useCallback((side: "BUY" | "SELL") => {
    const lots = parseFloat(lotSize);
    const sl = parseFloat(slInput) || null;
    const tp = parseFloat(tpInput) || null;

    const validation = validatePaperTrade({
      symbolId: activeSymbol.id,
      lotSize: lots,
      entryPrice: effectivePrice,
      side,
      sl,
      tp,
      freeMargin,
      leverage,
    });

    if (!validation.valid) {
      addNotification({
        type: "risk_warning",
        priority: "high",
        title: "⛔ Paper Trade Rejected",
        message: validation.error || "Invalid trade parameters.",
      });
      return;
    }

    openPosition({
      symbol: activeSymbol.id,
      displayName: activeSymbol.displayName,
      category: activeSymbol.category,
      side,
      lotSize: lots,
      entryPrice: effectivePrice,
      sl,
      tp,
    });

    setSlInput(""); setTpInput("");
    setShowRiskWarning(false);
    setPendingSide(null);

    if (!isCrypto) setManualPrice(""); // Clear manual price after trade
  }, [lotSize, slInput, tpInput, effectivePrice, activeSymbol, freeMargin, leverage, openPosition, addNotification, isCrypto]);

  const handleTradeClick = useCallback((side: "BUY" | "SELL") => {
    const risk = calculateRiskScore();
    if (risk.level === "HIGH" || risk.level === "EXTREME" || positions.length >= 5) {
      setPendingSide(side);
      setShowRiskWarning(true);
      return;
    }
    executeTrade(side);
  }, [calculateRiskScore, positions.length, executeTrade]);

  const handleNumericInput = (val: string, setter: (v: string) => void) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) setter(val);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative min-h-0">

      {/* Risk Warning Overlay */}
      {showRiskWarning && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111217] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-red-400 font-bold text-base mb-1">⚠ Risk Warning</p>
            <p className="text-white/50 text-xs mb-3">
              Current risk level is elevated. Opening another position increases exposure.
            </p>
            <p className="text-white/70 text-sm mb-4">{calculateRiskScore().recommendation}</p>
            <div className="flex gap-3">
              <button
                onClick={() => { if (pendingSide) executeTrade(pendingSide); }}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 py-2 rounded-xl text-sm font-semibold transition">
                Open Anyway
              </button>
              <button
                onClick={() => { setShowRiskWarning(false); setPendingSide(null); }}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 py-2 rounded-xl text-sm font-semibold transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropdown Backdrop */}
      {showDropdown && (
        <div className="fixed inset-0 z-30" onClick={() => setShowDropdown(false)} />
      )}

      {/* ── Top Bar ──────────────────────────────────────────────────── */}
      <div className="glass flex items-center gap-3 px-4 py-2 border-b border-white/5 flex-wrap relative z-40 shrink-0">

        {/* Symbol Selector */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 transition">
            <span className="text-lg leading-none">{activeSymbol.emoji}</span>
            <span className="text-white font-semibold text-sm">{activeSymbol.displayName}</span>
            <span className="text-white/30 text-xs">{showDropdown ? "▲" : "▼"}</span>
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#111217] border border-white/10 rounded-xl p-3 w-80 shadow-2xl">
              {/* Category tabs */}
              <div className="flex gap-1 mb-3">
                {ASSET_TABS.map(tab => (
                  <button key={tab.category} onClick={() => setDropdownCategory(tab.category)}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold transition ${dropdownCategory === tab.category ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60 hover:bg-white/5"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Symbol list */}
              <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                {filteredSymbols.map(s => (
                  <button key={s.id}
                    onClick={() => {
                      setActiveSymbol(s);
                      setShowDropdown(false);
                      setManualPrice("");
                      setSlInput(""); setTpInput("");
                    }}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left transition ${activeSymbol.id === s.id ? "bg-green-500/10 text-green-400" : "text-white/60 hover:bg-white/5"}`}>
                    <span className="text-base leading-none">{s.emoji}</span>
                    <span className="font-semibold">{s.displayName}</span>
                    <span className="text-white/30 ml-auto">{s.description}</span>
                    {!s.livePriceSupported && <span className="text-white/20 text-xs">📊</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Category badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${CATEGORY_BADGE[activeSymbol.category]}`}>
          {activeSymbol.category}
        </span>

        {/* Price display */}
        {isCrypto ? (
          currentPrice > 0 ? (
            <>
              <span className={`text-lg font-bold ${priceColor}`}>
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </span>
              <span className={`text-xs ${priceColor}`}>
                {priceMark}{change.toFixed(4)} ({priceMark}{changePct.toFixed(2)}%)
              </span>
            </>
          ) : (
            <span className="text-white/30 text-sm animate-pulse">Loading live price...</span>
          )
        ) : (
          <span className="text-white/30 text-xs italic">{activeSymbol.statusLabel || "Live price not connected"}</span>
        )}

        {/* Paper mode badge */}
        <span className="ml-auto text-xs text-green-400/60 bg-green-500/5 border border-green-500/10 px-2 py-0.5 rounded-full">
          📊 Paper Mode
        </span>
      </div>

      {/* ── TradingView Chart ────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0"
        onClick={() => setShowDropdown(false)}>
        <TradingViewChart
          symbol={activeSymbol.tradingViewSymbol}
          interval="60"
          height="100%"
          theme="dark"
        />
      </div>

      {/* ── Trade Execution Panel ────────────────────────────────────── */}
      <div className="glass border-t border-white/5 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">

          {/* BUY / SELL buttons */}
          <button
            onClick={() => handleTradeClick("BUY")}
            disabled={effectivePrice <= 0}
            className="bg-green-500/20 hover:bg-green-500/30 disabled:opacity-40 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-bold transition">
            BUY
          </button>
          <button
            onClick={() => handleTradeClick("SELL")}
            disabled={effectivePrice <= 0}
            className="bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 text-red-400 border border-red-500/30 px-6 py-2 rounded-lg text-sm font-bold transition">
            SELL
          </button>

          <div className="w-px h-8 bg-white/10" />

          {/* Lot size */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-xs">Lots</span>
            <input
              value={lotSize}
              onChange={e => handleNumericInput(e.target.value, setLotSize)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm w-20 text-center focus:outline-none focus:border-white/25"
            />
          </div>

          {/* SL */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-xs">SL</span>
            <input
              value={slInput}
              onChange={e => handleNumericInput(e.target.value, setSlInput)}
              placeholder="Optional"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm w-24 text-center focus:outline-none focus:border-white/25"
            />
          </div>

          {/* TP */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-xs">TP</span>
            <input
              value={tpInput}
              onChange={e => handleNumericInput(e.target.value, setTpInput)}
              placeholder="Optional"
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm w-24 text-center focus:outline-none focus:border-white/25"
            />
          </div>

          {/* Manual price for non-crypto */}
          {!isCrypto && (
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400/70 text-xs">Ref. Price</span>
              <input
                value={manualPrice}
                onChange={e => handleNumericInput(e.target.value, setManualPrice)}
                placeholder="Enter price"
                className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-400 text-sm w-28 text-center focus:outline-none focus:border-amber-500/40"
              />
              <span className="text-white/20 text-xs italic">manual</span>
            </div>
          )}

          {/* Account info */}
          <div className="ml-auto flex items-center gap-4 text-xs text-white/40">
            <span>Free margin: <span className="text-white/70">${useTradeStore.getState().freeMargin.toFixed(2)}</span></span>
            <span>Open: <span className="text-white font-semibold">{useTradeStore.getState().positions.length}</span></span>
          </div>

        </div>

        {/* Non-crypto advisory */}
        {!isCrypto && (
          <p className="text-amber-400/50 text-xs mt-1.5">
            ⚠ Non-crypto: enter a reference price manually. Paper P&L uses internal calculation model — not broker-accurate.
          </p>
        )}
      </div>

    </div>
  );
}