"use client";
import { useMemo } from "react";
import { useState } from "react";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useWatchlistStore } from "@/store/watchlistStore";
import { useSymbolStore } from "@/store/symbolStore";
import { TCC_SYMBOLS, TCCSymbol, SymbolCategory } from "@/lib/markets/symbols";
import { useRouter } from "next/navigation";

type TabFilter = "all" | SymbolCategory | "watchlist";

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}

function formatPrice(price: number): string {
  if (price <= 0) return "—";
  if (price > 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price > 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export default function MarketsPage() {
  const { tickers, loading, wsConnected } = useMarketPrices();
  const { items: watchlistItems, addSymbol, removeSymbol } = useWatchlistStore();
  const { setActiveSymbol } = useSymbolStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  const watchlistIds = new Set(watchlistItems.map(w => w.symbolId));

  // Filter symbols based on active tab
  const displaySymbols = useMemo(() => {
    let list: TCCSymbol[] = [];
    if (activeTab === "all") list = TCC_SYMBOLS;
    else if (activeTab === "watchlist") list = TCC_SYMBOLS.filter(s => watchlistIds.has(s.id));
    else list = TCC_SYMBOLS.filter(s => s.category === activeTab);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        s.displayName.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeTab, search, watchlistIds]);

  // Top gainers/losers — ONLY from crypto with real Binance data
  const cryptoWithData = useMemo(() => {
    return TCC_SYMBOLS
      .filter(s => s.livePriceSupported && s.binanceSymbol && tickers[s.binanceSymbol]?.price > 0)
      .map(s => ({ symbol: s, ticker: tickers[s.binanceSymbol!] }))
      .sort((a, b) => b.ticker.price - a.ticker.price);
  }, [tickers]);

  const topGainers = useMemo(() =>
    [...cryptoWithData].sort((a, b) => b.ticker.changePct - a.ticker.changePct).slice(0, 5),
    [cryptoWithData]
  );
  const topLosers = useMemo(() =>
    [...cryptoWithData].sort((a, b) => a.ticker.changePct - b.ticker.changePct).slice(0, 5),
    [cryptoWithData]
  );

  const handleTrade = (symbol: TCCSymbol) => {
    setActiveSymbol(symbol);
    router.push("/");
  };

  const toggleWatchlist = (symbolId: string) => {
    if (watchlistIds.has(symbolId)) removeSymbol(symbolId);
    else addSymbol(symbolId);
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "crypto", label: "Crypto" },
    { key: "forex", label: "Forex" },
    { key: "commodity", label: "Commodities" },
    { key: "index", label: "Indices" },
    { key: "watchlist", label: `⭐ Watchlist (${watchlistItems.length})` },
  ];

  return (
        <div className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-fg">📊 Markets</h1>
              <p className="text-fg-dim text-sm mt-1">
                {loading
                  ? "Loading crypto prices..."
                  : wsConnected
                    ? "Live crypto prices · WebSocket connected"
                    : "Crypto prices via REST · Refreshes every 15s"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${loading ? "bg-warning animate-pulse" : wsConnected ? "bg-success animate-pulse" : "bg-warning"}`} />
              <span className="text-xs text-fg-dim">{wsConnected ? "Live" : loading ? "Loading" : "REST"}</span>
            </div>
          </div>

          <div className="flex gap-6">

            {/* Main area */}
            <div className="flex-1 min-w-0">

              {/* Tabs */}
              <div className="flex gap-1 bg-elevated rounded-lg p-1 mb-4 flex-wrap">
                {tabs.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${activeTab === tab.key ? "bg-success-soft text-success" : "text-fg-dim hover:text-fg-muted"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search symbol or name..."
                  className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-fg text-sm placeholder-white/20 focus:outline-none focus:border-border-strong"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-dim hover:text-fg-muted text-sm">✕</button>
                )}
              </div>

              {/* Non-crypto disclaimer */}
              {(activeTab === "forex" || activeTab === "commodity" || activeTab === "index") && (
                <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 mb-4 flex items-center gap-3">
                  <span className="text-blue-400 text-lg shrink-0">📊</span>
                  <p className="text-fg-dim text-xs leading-relaxed">
                    Live price API is not connected for Forex, Commodities, and Indices.
                    Charts are available via TradingView. Click "Trade" to open the chart.
                    Live prices require a broker integration (Phase Alpha).
                  </p>
                </div>
              )}

              {/* Empty state for watchlist tab */}
              {activeTab === "watchlist" && watchlistItems.length === 0 && (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-4xl mb-3">⭐</p>
                    <p className="text-fg-dim text-sm">Your watchlist is empty</p>
                    <p className="text-fg-dim text-xs mt-1">Switch to "All" and click ☆ to add symbols</p>
                  </div>
                </div>
              )}

              {/* No search results */}
              {displaySymbols.length === 0 && search && (
                <div className="flex items-center justify-center h-32">
                  <p className="text-fg-dim text-sm">No TCC-supported symbol found for "{search}"</p>
                </div>
              )}

              {/* Symbol table */}
              {displaySymbols.length > 0 && (
                <div className="glass border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-elevated">
                        <th className="text-left px-4 py-3 text-fg-dim">Symbol</th>
                        <th className="text-right px-4 py-3 text-fg-dim">Price</th>
                        <th className="text-right px-4 py-3 text-fg-dim">24h Change</th>
                        <th className="text-right px-4 py-3 text-fg-dim">24h High</th>
                        <th className="text-right px-4 py-3 text-fg-dim">24h Low</th>
                        <th className="text-right px-4 py-3 text-fg-dim">Volume</th>
                        <th className="text-right px-4 py-3 text-fg-dim">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && activeTab === "crypto" && displaySymbols.slice(0, 10).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="h-4 bg-elevated rounded animate-pulse" />
                          </td>
                        </tr>
                      ))}
                      {(!loading || activeTab !== "crypto") && displaySymbols.map((symbol) => {
                        const ticker = symbol.binanceSymbol ? tickers[symbol.binanceSymbol] : null;
                        const isWatched = watchlistIds.has(symbol.id);
                        const hasLivePrice = symbol.livePriceSupported && ticker && ticker.price > 0;

                        return (
                          <tr key={symbol.id} className="border-b border-border hover:bg-elevated transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-elevated flex items-center justify-center text-base shrink-0">
                                  {symbol.emoji}
                                </div>
                                <div>
                                  <p className="text-fg font-semibold">{symbol.displayName}</p>
                                  <p className="text-fg-dim text-xs">{symbol.description}</p>
                                </div>
                              </div>
                            </td>

                            {/* Price */}
                            <td className="px-4 py-3 text-right">
                              {hasLivePrice ? (
                                <span className="text-fg font-semibold">{formatPrice(ticker!.price)}</span>
                              ) : (
                                <span className="text-fg-dim text-xs italic">{symbol.statusLabel || "—"}</span>
                              )}
                            </td>

                            {/* 24h Change */}
                            <td className="px-4 py-3 text-right">
                              {hasLivePrice ? (
                                <span className={`font-bold ${ticker!.changePct >= 0 ? "text-success" : "text-danger"}`}>
                                  {ticker!.changePct >= 0 ? "+" : ""}{ticker!.changePct.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-fg-dim text-xs">—</span>
                              )}
                            </td>

                            {/* 24h High */}
                            <td className="px-4 py-3 text-right">
                              {hasLivePrice ? (
                                <span className="text-fg-muted">{formatPrice(ticker!.high)}</span>
                              ) : (
                                <span className="text-fg-dim text-xs">—</span>
                              )}
                            </td>

                            {/* 24h Low */}
                            <td className="px-4 py-3 text-right">
                              {hasLivePrice ? (
                                <span className="text-fg-muted">{formatPrice(ticker!.low)}</span>
                              ) : (
                                <span className="text-fg-dim text-xs">—</span>
                              )}
                            </td>

                            {/* Volume */}
                            <td className="px-4 py-3 text-right">
                              {hasLivePrice ? (
                                <span className="text-fg-muted">{formatVolume(ticker!.quoteVolume)}</span>
                              ) : (
                                <span className="text-fg-dim text-xs">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => toggleWatchlist(symbol.id)}
                                  title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                                  className={`text-sm px-2 py-1 rounded border transition ${isWatched ? "text-warning bg-warning-soft border-warning/30" : "text-fg-dim bg-elevated border-border hover:border-border-strong"}`}>
                                  {isWatched ? "★" : "☆"}
                                </button>
                                <button
                                  onClick={() => handleTrade(symbol)}
                                  className="text-xs px-2 py-1 rounded border text-success bg-success-soft border-success/30 hover:bg-success/22 transition">
                                  {symbol.livePriceSupported ? "Trade" : "Chart"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Side Panels */}
            <div className="w-52 shrink-0 flex flex-col gap-4">

              {/* Top Gainers */}
              <div className="glass border border-success/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">🔥 Top Gainers</p>
                {topGainers.length === 0 ? (
                  <p className="text-fg-dim text-xs italic">Unavailable until live data loads</p>
                ) : (
                  topGainers.map(({ symbol, ticker }) => (
                    <div key={symbol.id} className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-base">{symbol.emoji}</span>
                        <span className="text-fg-muted text-xs">{symbol.id.replace("USDT", "")}</span>
                      </div>
                      <span className="text-success text-xs font-bold">+{ticker.changePct.toFixed(2)}%</span>
                    </div>
                  ))
                )}
              </div>

              {/* Top Losers */}
              <div className="glass border border-danger/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">📉 Top Losers</p>
                {topLosers.length === 0 ? (
                  <p className="text-fg-dim text-xs italic">Unavailable until live data loads</p>
                ) : (
                  topLosers.filter(({ ticker }) => ticker.changePct < 0).map(({ symbol, ticker }) => (
                    <div key={symbol.id} className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <span className="text-base">{symbol.emoji}</span>
                        <span className="text-fg-muted text-xs">{symbol.id.replace("USDT", "")}</span>
                      </div>
                      <span className="text-danger text-xs font-bold">{ticker.changePct.toFixed(2)}%</span>
                    </div>
                  ))
                )}
              </div>

              {/* Data source note */}
              <div className="glass border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Data Sources</p>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-fg-dim">Crypto prices</span>
                    <span className="text-success">Binance</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-dim">Forex prices</span>
                    <span className="text-fg-dim">Not connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-dim">Commodities</span>
                    <span className="text-fg-dim">Not connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-dim">Indices</span>
                    <span className="text-fg-dim">Not connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-fg-dim">Charts</span>
                    <span className="text-blue-400">TradingView</span>
                  </div>
                </div>
                <p className="text-fg-dim text-xs mt-3 leading-relaxed">
                  Non-crypto live prices require broker/market data API integration in Phase Alpha.
                </p>
              </div>

            </div>
          </div>
        </div>
  );
}