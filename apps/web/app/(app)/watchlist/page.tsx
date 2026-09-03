"use client";
import { useState, useMemo } from "react";
import { useWatchlistStore } from "@/store/watchlistStore";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useNotificationStore } from "@/store/notificationStore";
import { useSymbolStore } from "@/store/symbolStore";
import { TCC_SYMBOL_MAP, TCCSymbol } from "@/lib/markets/symbols";
import { useRouter } from "next/navigation";

function formatPrice(price: number, symbolId: string): string {
  if (price <= 0) return "—";
  if (price > 1000) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price > 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatVol(vol: number): string {
  if (vol <= 0) return "—";
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  return `$${(vol / 1e3).toFixed(1)}K`;
}

export default function WatchlistPage() {
  const { items, getAvailableToAdd, addSymbol, removeSymbol, addAlert, removeAlert, isLoading, isInitialized, error } = useWatchlistStore();
  const { loading, wsConnected } = useMarketPrices();
  const { addNotification } = useNotificationStore();
  const { setActiveSymbol } = useSymbolStore();
  const router = useRouter();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState({ type: "above" as "above" | "below", price: "" });
  const [addSearch, setAddSearch] = useState("");

  // Get available symbols for Add picker (excludes already watched)
  const availableToAdd = useMemo(() => {
    const list = getAvailableToAdd();
    if (!addSearch.trim()) return list;
    const q = addSearch.toLowerCase();
    return list.filter(s =>
      s.displayName.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  }, [getAvailableToAdd, addSearch]);

  const handleAddSymbol = (symbolId: string) => {
    addSymbol(symbolId);
    setShowAddModal(false);
    setAddSearch("");
  };

  const handleAddAlert = (symbolId: string) => {
    if (!alertForm.price) return;
    const price = parseFloat(alertForm.price);
    if (isNaN(price) || price <= 0) return;
    addAlert(symbolId, alertForm.type, price);
    const def = TCC_SYMBOL_MAP[symbolId];
    addNotification({
      type: "price_alert",
      priority: "medium",
      title: `🔔 Price Alert Set — ${def?.displayName || symbolId}`,
      message: `You'll be notified when ${symbolId} goes ${alertForm.type} $${price.toLocaleString()}`,
    });
    setShowAlertModal(null);
    setAlertForm({ type: "above", price: "" });
  };

  const handleOpenChart = (symbolId: string) => {
    const def = TCC_SYMBOL_MAP[symbolId];
    if (def) {
      setActiveSymbol(def);
      router.push("/");
    }
  };

  if (!isInitialized || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/30 text-sm animate-pulse">Loading watchlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => useWatchlistStore.getState().init()}
          className="text-white/40 text-xs border border-white/10 px-3 py-1 rounded hover:text-white/70 hover:border-white/20 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">👁 Watchlist</h1>
              <p className="text-white/40 text-sm mt-1">
                {items.length === 0
                  ? "Your watchlist is empty. Add symbols from Markets to start tracking them."
                  : `Tracking ${items.length} symbol${items.length > 1 ? "s" : ""}${wsConnected ? " · Live" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!loading && items.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-400 animate-pulse" : "bg-amber-400"}`} />
                  <span className="text-xs text-white/30">{wsConnected ? "Live" : "REST"}</span>
                </div>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-500/30 transition">
                + Add Symbol
              </button>
            </div>
          </div>

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-5xl mb-4">👁</p>
                <p className="text-white/40 text-sm mb-2">Your watchlist is empty</p>
                <p className="text-white/20 text-xs mb-6">
                  Add symbols from Markets to start tracking prices and set alerts.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-green-500/20 text-green-400 border border-green-500/30 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-500/30 transition">
                  + Add Your First Symbol
                </button>
              </div>
            </div>
          )}

          {/* Watchlist items */}
          {items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map(item => {
                const def = TCC_SYMBOL_MAP[item.symbolId];
                if (!def) return null;

                const hasLivePrice = def.livePriceSupported && item.currentPrice > 0;
                const activeAlerts = item.alerts.filter(a => !a.triggered);

                return (
                  <div key={item.symbolId} className="glass border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
                    <div className="flex items-center gap-6">

                      {/* Symbol info */}
                      <div className="flex items-center gap-3 w-52 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl shrink-0">
                          {def.emoji}
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{def.displayName}</p>
                          <p className="text-white/30 text-xs capitalize">{def.description}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${
                            def.category === "crypto" ? "text-amber-400/60" :
                            def.category === "forex" ? "text-blue-400/60" :
                            def.category === "commodity" ? "text-yellow-400/60" :
                            "text-purple-400/60"
                          }`}>{def.category}</span>
                        </div>
                      </div>

                      {/* Price data */}
                      <div className="flex-1 flex items-center gap-8">
                        <div>
                          <p className="text-white/40 text-xs">Price</p>
                          {hasLivePrice ? (
                            <p className="text-white font-bold text-lg">{formatPrice(item.currentPrice, item.symbolId)}</p>
                          ) : (
                            <p className="text-white/20 text-xs italic mt-1">{def.statusLabel || "Live price not connected"}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-white/40 text-xs">24h Change</p>
                          {hasLivePrice ? (
                            <p className={`font-bold ${item.changePct24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {item.changePct24h >= 0 ? "+" : ""}{item.changePct24h.toFixed(2)}%
                            </p>
                          ) : (
                            <p className="text-white/15 text-xs mt-1">—</p>
                          )}
                        </div>
                        <div>
                          <p className="text-white/40 text-xs">24h High</p>
                          <p className={`text-sm ${hasLivePrice ? "text-white/60" : "text-white/15"}`}>
                            {hasLivePrice ? formatPrice(item.high24h, item.symbolId) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs">24h Low</p>
                          <p className={`text-sm ${hasLivePrice ? "text-white/60" : "text-white/15"}`}>
                            {hasLivePrice ? formatPrice(item.low24h, item.symbolId) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/40 text-xs">Volume</p>
                          <p className={`text-sm ${hasLivePrice ? "text-white/60" : "text-white/15"}`}>
                            {hasLivePrice ? formatVol(item.volume24h) : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Active alerts */}
                      <div className="flex flex-col gap-1 w-32 shrink-0">
                        {activeAlerts.length === 0 ? (
                          <p className="text-white/20 text-xs">No alerts set</p>
                        ) : (
                          activeAlerts.slice(0, 3).map(alert => (
                            <div key={alert.id} className="flex items-center gap-1">
                              <span className={`text-xs ${alert.type === "above" ? "text-green-400" : "text-red-400"}`}>
                                {alert.type === "above" ? "↑" : "↓"} ${alert.price.toLocaleString()}
                              </span>
                              <button
                                onClick={() => removeAlert(item.symbolId, alert.id)}
                                className="text-white/20 hover:text-red-400 text-xs ml-1 transition">
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                        {activeAlerts.length > 3 && (
                          <p className="text-white/20 text-xs">+{activeAlerts.length - 3} more</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenChart(item.symbolId)}
                          className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg text-xs hover:bg-blue-500/20 transition">
                          📊 Chart
                        </button>
                        {def.livePriceSupported && (
                          <button
                            onClick={() => { setShowAlertModal(item.symbolId); setAlertForm({ type: "above", price: "" }); }}
                            className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs hover:bg-amber-500/20 transition">
                            🔔 Alert
                          </button>
                        )}
                        <button
                          onClick={() => removeSymbol(item.symbolId)}
                          className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/20 transition">
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {/* Add Symbol Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="bg-[#111217] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-bold">Add to Watchlist</h2>
                <p className="text-white/30 text-xs mt-0.5">Only TCC-supported symbols</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setAddSearch(""); }}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition text-sm">✕</button>
            </div>

            <input
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              placeholder="Search symbols..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 mb-4"
            />

            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
              {availableToAdd.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-6">
                  {addSearch ? `No TCC-supported symbol found for "${addSearch}"` : "All symbols are already in your watchlist"}
                </p>
              ) : (
                availableToAdd.map(symbol => (
                  <button
                    key={symbol.id}
                    onClick={() => handleAddSymbol(symbol.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-white/5 transition group">
                    <span className="text-xl shrink-0">{symbol.emoji}</span>
                    <div className="flex-1">
                      <p className="text-white/80 group-hover:text-white font-medium">{symbol.displayName}</p>
                      <p className="text-white/30 text-xs">{symbol.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        symbol.category === "crypto" ? "text-amber-400/60 bg-amber-500/10" :
                        symbol.category === "forex" ? "text-blue-400/60 bg-blue-500/10" :
                        symbol.category === "commodity" ? "text-yellow-400/60 bg-yellow-500/10" :
                        "text-purple-400/60 bg-purple-500/10"
                      }`}>{symbol.category}</span>
                      {!symbol.livePriceSupported && (
                        <p className="text-white/20 text-xs mt-0.5">Chart only</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowAlertModal(null); }}>
          <div className="bg-[#111217] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-bold">Set Price Alert</h2>
              <button onClick={() => setShowAlertModal(null)}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition text-sm">✕</button>
            </div>
            <p className="text-white/40 text-xs mb-4">{TCC_SYMBOL_MAP[showAlertModal]?.displayName || showAlertModal}</p>
            <div className="flex gap-2 mb-4">
              {(["above", "below"] as const).map(type => (
                <button key={type} onClick={() => setAlertForm({ ...alertForm, type })}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition ${alertForm.type === type ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                  {type === "above" ? "↑ Price Above" : "↓ Price Below"}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={alertForm.price}
              onChange={e => setAlertForm({ ...alertForm, price: e.target.value })}
              placeholder="Enter price..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm mb-5 focus:outline-none focus:border-white/25 placeholder-white/20"
            />
            <button
              onClick={() => handleAddAlert(showAlertModal)}
              disabled={!alertForm.price || parseFloat(alertForm.price) <= 0}
              className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-amber-500/30 transition">
              🔔 Set Alert
            </button>
          </div>
        </div>
      )}
    </>
  );
}