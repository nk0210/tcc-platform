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
 *
 * Fixed:
 * - Hydration mismatch caused by rendering persisted client store values during SSR.
 * - Removed useTradeStore.getState() from JSX render.
 * - Added mounted guard so server and first client render match safely.
 * - Fixed NotificationType mismatch: "risk_warning" replaced with "system".
 */

import { useState, useEffect, useCallback, memo } from "react";
import TradingViewChart from "@/components/TradingViewChart";
import { useLivePrice } from "@/hooks/useLivePrice";
import { usePriceStore } from "@/store/priceStore";
import { useTradeStore } from "@/store/tradeStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSymbolStore } from "@/store/symbolStore";
import { calculateRiskScore } from "@/store/riskStore";
import { validatePaperTrade, calcMargin, calcNotional } from "@/lib/trading/calculations";
import { TCC_SYMBOLS, type SymbolCategory } from "@/lib/markets/symbols";

type AssetTab = {
  label: string;
  category: SymbolCategory;
};

const ASSET_TABS: AssetTab[] = [
  { label: "Crypto", category: "crypto" },
  { label: "Forex", category: "forex" },
  { label: "Commodities", category: "commodity" },
  { label: "Indices", category: "index" },
];

const CATEGORY_BADGE: Record<SymbolCategory, string> = {
  crypto: "text-warning bg-warning-soft border-warning/30",
  forex: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  commodity: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  index: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

function CenterChart() {
  const [mounted, setMounted] = useState(false);

  const [lotSize, setLotSize] = useState("0.01");
  const [slInput, setSlInput] = useState("");
  const [tpInput, setTpInput] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownCategory, setDropdownCategory] =
    useState<SymbolCategory>("crypto");
  const [showRiskWarning, setShowRiskWarning] = useState(false);
  const [pendingSide, setPendingSide] = useState<"BUY" | "SELL" | null>(null);

  const { activeSymbol, setActiveSymbol } = useSymbolStore();
  // Individual selectors — plain useTradeStore() subscribes to the whole
  // store, so this component (heavy: chart + form) would re-render on every
  // WS price tick's closedTrades/isLoading/isSyncing churn too, not just
  // these 4 fields it actually reads.
  const openPosition = useTradeStore((s) => s.openPosition);
  const freeMargin   = useTradeStore((s) => s.freeMargin);
  const leverage     = useTradeStore((s) => s.leverage);
  const positions    = useTradeStore((s) => s.positions);
  const { addNotification } = useNotificationStore();
  const { currentPrice, change, changePct } = usePriceStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLivePrice(activeSymbol);

  const isCrypto = activeSymbol.livePriceSupported;

  const effectivePrice = isCrypto
    ? currentPrice
    : parseFloat(manualPrice) > 0
      ? parseFloat(manualPrice)
      : 0;

  const priceColor = change >= 0 ? "text-success" : "text-danger";
  const priceMark = change >= 0 ? "+" : "";

  const filteredSymbols = TCC_SYMBOLS.filter(
    (s) => s.category === dropdownCategory
  );

  const executeTrade = useCallback(
    (side: "BUY" | "SELL") => {
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
          type: "system",
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
        marginUsed: calcMargin(activeSymbol.id, lots, effectivePrice, leverage),
        notionalValue: calcNotional(activeSymbol.id, lots, effectivePrice),
        leverage,
      });

      setSlInput("");
      setTpInput("");
      setShowRiskWarning(false);
      setPendingSide(null);

      if (!isCrypto) {
        setManualPrice("");
      }
    },
    [
      lotSize,
      slInput,
      tpInput,
      effectivePrice,
      activeSymbol,
      freeMargin,
      leverage,
      openPosition,
      addNotification,
      isCrypto,
    ]
  );

  const handleTradeClick = useCallback(
    (side: "BUY" | "SELL") => {
      const risk = calculateRiskScore();

      if (
        risk.level === "HIGH" ||
        risk.level === "EXTREME" ||
        positions.length >= 5
      ) {
        setPendingSide(side);
        setShowRiskWarning(true);
        return;
      }

      executeTrade(side);
    },
    [positions.length, executeTrade]
  );

  const handleNumericInput = (val: string, setter: (v: string) => void) => {
    if (val === "" || /^\d*\.?\d*$/.test(val)) {
      setter(val);
    }
  };

  if (!mounted) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden relative min-h-0">
        <div className="glass flex items-center gap-3 px-4 py-2 border-b border-border flex-wrap relative z-40 shrink-0">
          <div className="flex items-center gap-2 bg-elevated border border-border rounded-lg px-3 py-1.5">
            <span className="text-fg-dim text-sm animate-pulse">
              Loading trading panel...
            </span>
          </div>

          <span className="ml-auto text-xs text-success/60 bg-success-soft border border-success/30 px-2 py-0.5 rounded-full">
            📊 Paper Mode
          </span>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center bg-[#050509]">
          <p className="text-fg-dim text-sm animate-pulse">
            Loading chart...
          </p>
        </div>

        <div className="glass border-t border-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              disabled
              className="bg-success-soft opacity-40 text-success border border-success/30 px-6 py-2 rounded-lg text-sm font-bold"
            >
              BUY
            </button>

            <button
              disabled
              className="bg-danger-soft opacity-40 text-danger border border-danger/30 px-6 py-2 rounded-lg text-sm font-bold"
            >
              SELL
            </button>

            <div className="ml-auto flex items-center gap-4 text-xs text-fg-dim">
              <span>
                Free margin: <span className="text-fg-muted">$10000.00</span>
              </span>
              <span>
                Open: <span className="text-fg font-semibold">0</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative min-h-0">
      {showRiskWarning && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111217] border border-danger/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-danger font-bold text-base mb-1">
              ⚠ Risk Warning
            </p>

            <p className="text-fg-muted text-xs mb-3">
              Current risk level is elevated. Opening another position
              increases exposure.
            </p>

            <p className="text-fg-muted text-sm mb-4">
              {calculateRiskScore().recommendation}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (pendingSide) {
                    executeTrade(pendingSide);
                  }
                }}
                className="flex-1 bg-danger-soft hover:bg-danger/22 text-danger border border-danger/30 py-2 rounded-xl text-sm font-semibold transition"
              >
                Open Anyway
              </button>

              <button
                onClick={() => {
                  setShowRiskWarning(false);
                  setPendingSide(null);
                }}
                className="flex-1 bg-elevated hover:bg-elevated text-fg-muted border border-border py-2 rounded-xl text-sm font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDropdown && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowDropdown(false)}
        />
      )}

      <div className="glass flex items-center gap-3 px-4 py-2 border-b border-border flex-wrap relative z-40 shrink-0">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 bg-elevated hover:bg-elevated border border-border rounded-lg px-3 py-1.5 transition"
          >
            <span className="text-lg leading-none">{activeSymbol.emoji}</span>
            <span className="text-fg font-semibold text-sm">
              {activeSymbol.displayName}
            </span>
            <span className="text-fg-dim text-xs">
              {showDropdown ? "▲" : "▼"}
            </span>
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#111217] border border-border rounded-xl p-3 w-80 shadow-2xl">
              <div className="flex gap-1 mb-3">
                {ASSET_TABS.map((tab) => (
                  <button
                    key={tab.category}
                    onClick={() => setDropdownCategory(tab.category)}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold transition ${
                      dropdownCategory === tab.category
                        ? "bg-success-soft text-success"
                        : "text-fg-dim hover:text-fg-muted hover:bg-elevated"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="max-h-52 overflow-y-auto flex flex-col gap-0.5">
                {filteredSymbols.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveSymbol(s);
                      setShowDropdown(false);
                      setManualPrice("");
                      setSlInput("");
                      setTpInput("");
                    }}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-left transition ${
                      activeSymbol.id === s.id
                        ? "bg-success-soft text-success"
                        : "text-fg-muted hover:bg-elevated"
                    }`}
                  >
                    <span className="text-base leading-none">{s.emoji}</span>
                    <span className="font-semibold">{s.displayName}</span>
                    <span className="text-fg-dim ml-auto">
                      {s.description}
                    </span>
                    {!s.livePriceSupported && (
                      <span className="text-fg-dim text-xs">📊</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <span
          className={`text-xs px-2 py-0.5 rounded-full border capitalize ${CATEGORY_BADGE[activeSymbol.category]}`}
        >
          {activeSymbol.category}
        </span>

        {isCrypto ? (
          currentPrice > 0 ? (
            <>
              <span className={`text-lg font-bold ${priceColor}`}>
                $
                {currentPrice.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                })}
              </span>

              <span className={`text-xs ${priceColor}`}>
                {priceMark}
                {change.toFixed(4)} ({priceMark}
                {changePct.toFixed(2)}%)
              </span>
            </>
          ) : (
            <span className="text-fg-dim text-sm animate-pulse">
              Loading live price...
            </span>
          )
        ) : (
          <span className="text-fg-dim text-xs italic">
            {activeSymbol.statusLabel || "Live price not connected"}
          </span>
        )}

        <span className="ml-auto text-xs text-success/60 bg-success-soft border border-success/30 px-2 py-0.5 rounded-full">
          📊 Paper Mode
        </span>
      </div>

      <div className="flex-1 min-h-0" onClick={() => setShowDropdown(false)}>
        <TradingViewChart
          symbol={activeSymbol.tradingViewSymbol}
          interval="60"
          height="100%"
          theme="dark"
        />
      </div>

      <div className="glass border-t border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleTradeClick("BUY")}
            disabled={effectivePrice <= 0}
            className="bg-success-soft hover:bg-success/22 disabled:opacity-40 text-success border border-success/30 px-6 py-2 rounded-lg text-sm font-bold transition"
          >
            BUY
          </button>

          <button
            onClick={() => handleTradeClick("SELL")}
            disabled={effectivePrice <= 0}
            className="bg-danger-soft hover:bg-danger/22 disabled:opacity-40 text-danger border border-danger/30 px-6 py-2 rounded-lg text-sm font-bold transition"
          >
            SELL
          </button>

          <div className="w-px h-8 bg-elevated" />

          <div className="flex items-center gap-1.5">
            <span className="text-fg-dim text-xs">Lots</span>
            <input
              value={lotSize}
              onChange={(e) => handleNumericInput(e.target.value, setLotSize)}
              className="bg-elevated border border-border rounded-lg px-2 py-1 text-fg text-sm w-20 text-center focus:outline-none focus:border-border"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-fg-dim text-xs">SL</span>
            <input
              value={slInput}
              onChange={(e) => handleNumericInput(e.target.value, setSlInput)}
              placeholder="Optional"
              className="bg-elevated border border-border rounded-lg px-2 py-1 text-fg text-sm w-24 text-center focus:outline-none focus:border-border"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-fg-dim text-xs">TP</span>
            <input
              value={tpInput}
              onChange={(e) => handleNumericInput(e.target.value, setTpInput)}
              placeholder="Optional"
              className="bg-elevated border border-border rounded-lg px-2 py-1 text-fg text-sm w-24 text-center focus:outline-none focus:border-border"
            />
          </div>

          {!isCrypto && (
            <div className="flex items-center gap-1.5">
              <span className="text-warning/70 text-xs">Ref. Price</span>
              <input
                value={manualPrice}
                onChange={(e) =>
                  handleNumericInput(e.target.value, setManualPrice)
                }
                placeholder="Enter price"
                className="bg-warning-soft border border-warning/30 rounded-lg px-2 py-1 text-warning text-sm w-28 text-center focus:outline-none focus:border-warning/30"
              />
              <span className="text-fg-dim text-xs italic">manual</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-4 text-xs text-fg-dim">
            <span>
              Free margin:{" "}
              <span className="text-fg-muted">${freeMargin.toFixed(2)}</span>
            </span>

            <span>
              Open:{" "}
              <span className="text-fg font-semibold">
                {positions.length}
              </span>
            </span>
          </div>
        </div>

        {!isCrypto && (
          <p className="text-warning/50 text-xs mt-1.5">
            ⚠ Non-crypto: enter a reference price manually. Paper P&L uses
            internal calculation model — not broker-accurate.
          </p>
        )}
      </div>
    </div>
  );
}

// CenterChart takes no props — memo insulates it from parent re-renders,
// leaving only its own (now field-level) store subscriptions as triggers.
export default memo(CenterChart);