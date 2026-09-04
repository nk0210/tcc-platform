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
        <p className="text-fg-dim text-sm animate-pulse">Loading watchlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-danger text-sm">{error}</p>
        <button
          type="button"
          onClick={() => useWatchlistStore.getState().init()}
          className="text-fg-dim text-xs border border-border px-3 py-1 rounded hover:text-fg-muted hover:border-border-strong transition"
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
              <h1 className="text-2xl font-bold text-fg">👁 Watchlist</h1>
              <p className="text-fg-dim text-sm mt-1">
                {items.length === 0
                  ? "Your watchlist is empty. Add symbols from Markets to start tracking them."
                  : `Tracking ${items.length} symbol${items.length > 1 ? "s" : ""}${wsConnected ? " · Live" : ""}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!loading && items.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-success animate-pulse" : "bg-warning"}`} />
                  <span className="text-xs text-fg-dim">{wsConnected ? "Live" : "REST"}</span>
                </div>
              )}
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-success-soft text-success border border-success/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-success/22 transition">
                + Add Symbol
              </button>
            </div>
          </div>

          {/* Empty state */}
          {items.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-5xl mb-4">👁</p>
                <p className="text-fg-dim text-sm mb-2">Your watchlist is empty</p>
                <p className="text-fg-dim text-xs mb-6">
                  Add symbols from Markets to start tracking prices and set alerts.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-success-soft text-success border border-success/30 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-success/22 transition">
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
                  <div key={item.symbolId} className="glass border border-border rounded-xl p-5 hover:border-border transition">
                    <div className="flex items-center gap-6">

                      {/* Symbol info */}
                      <div className="flex items-center gap-3 w-52 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-elevated flex items-center justify-center text-xl shrink-0">
                          {def.emoji}
                        </div>
                        <div>
                          <p className="text-fg font-semibold text-sm">{def.displayName}</p>
                          <p className="text-fg-dim text-xs capitalize">{def.description}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${
                            def.category === "crypto" ? "text-warning/60" :
                            def.category === "forex" ? "text-blue-400/60" :
                            def.category === "commodity" ? "text-yellow-400/60" :
                            "text-purple-400/60"
                          }`}>{def.category}</span>
                        </div>
                      </div>

                      {/* Price data */}
                      <div className="flex-1 flex items-center gap-8">
                        <div>
                          <p className="text-fg-dim text-xs">Price</p>
                          {hasLivePrice ? (
                            <p className="text-fg font-bold text-lg">{formatPrice(item.currentPrice, item.symbolId)}</p>
                          ) : (
                            <p className="text-fg-dim text-xs italic mt-1">{def.statusLabel || "Live price not connected"}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-fg-dim text-xs">24h Change</p>
                          {hasLivePrice ? (
                            <p className={`font-bold ${item.changePct24h >= 0 ? "text-success" : "text-danger"}`}>
                              {item.changePct24h >= 0 ? "+" : ""}{item.changePct24h.toFixed(2)}%
                            </p>
                          ) : (
                            <p className="text-fg-dim text-xs mt-1">—</p>
                          )}
                        </div>
                        <div>
                          <p className="text-fg-dim text-xs">24h High</p>
                          <p className={`text-sm ${hasLivePrice ? "text-fg-muted" : "text-fg-dim"}`}>
                            {hasLivePrice ? formatPrice(item.high24h, item.symbolId) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-fg-dim text-xs">24h Low</p>
                          <p className={`text-sm ${hasLivePrice ? "text-fg-muted" : "text-fg-dim"}`}>
                            {hasLivePrice ? formatPrice(item.low24h, item.symbolId) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-fg-dim text-xs">Volume</p>
                          <p className={`text-sm ${hasLivePrice ? "text-fg-muted" : "text-fg-dim"}`}>
                            {hasLivePrice ? formatVol(item.volume24h) : "—"}
                          </p>
                        </div>
                      </div>

                      {/* Active alerts */}
                      <div className="flex flex-col gap-1 w-32 shrink-0">
                        {activeAlerts.length === 0 ? (
                          <p className="text-fg-dim text-xs">No alerts set</p>
                        ) : (
                          activeAlerts.slice(0, 3).map(alert => (
                            <div key={alert.id} className="flex items-center gap-1">
                              <span className={`text-xs ${alert.type === "above" ? "text-success" : "text-danger"}`}>
                                {alert.type === "above" ? "↑" : "↓"} ${alert.price.toLocaleString()}
                              </span>
                              <button
                                onClick={() => removeAlert(item.symbolId, alert.id)}
                                className="text-fg-dim hover:text-danger text-xs ml-1 transition">
                                ✕
                              </button>
                            </div>
                          ))
                        )}
                        {activeAlerts.length > 3 && (
                          <p className="text-fg-dim text-xs">+{activeAlerts.length - 3} more</p>
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
                            className="bg-warning-soft text-warning border border-warning/30 px-3 py-1.5 rounded-lg text-xs hover:bg-warning/22 transition">
                            🔔 Alert
                          </button>
                        )}
                        <button
                          onClick={() => removeSymbol(item.symbolId)}
                          className="bg-danger-soft text-danger border border-danger/30 px-3 py-1.5 rounded-lg text-xs hover:bg-danger/22 transition">
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
          <div className="bg-[#111217] border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-fg font-bold">Add to Watchlist</h2>
                <p className="text-fg-dim text-xs mt-0.5">Only TCC-supported symbols</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setAddSearch(""); }}
                className="w-7 h-7 rounded-lg bg-elevated hover:bg-elevated flex items-center justify-center text-fg-dim hover:text-fg transition text-sm">✕</button>
            </div>

            <input
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              placeholder="Search symbols..."
              className="w-full bg-elevated border border-border rounded-xl px-4 py-2 text-fg text-sm placeholder-white/20 focus:outline-none focus:border-border-strong mb-4"
            />

            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
              {availableToAdd.length === 0 ? (
                <p className="text-fg-dim text-sm text-center py-6">
                  {addSearch ? `No TCC-supported symbol found for "${addSearch}"` : "All symbols are already in your watchlist"}
                </p>
              ) : (
                availableToAdd.map(symbol => (
                  <button
                    key={symbol.id}
                    onClick={() => handleAddSymbol(symbol.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-elevated transition group">
                    <span className="text-xl shrink-0">{symbol.emoji}</span>
                    <div className="flex-1">
                      <p className="text-fg-muted group-hover:text-fg font-medium">{symbol.displayName}</p>
                      <p className="text-fg-dim text-xs">{symbol.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        symbol.category === "crypto" ? "text-warning/60 bg-warning-soft" :
                        symbol.category === "forex" ? "text-blue-400/60 bg-blue-500/10" :
                        symbol.category === "commodity" ? "text-yellow-400/60 bg-yellow-500/10" :
                        "text-purple-400/60 bg-purple-500/10"
                      }`}>{symbol.category}</span>
                      {!symbol.livePriceSupported && (
                        <p className="text-fg-dim text-xs mt-0.5">Chart only</p>
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
          <div className="bg-[#111217] border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-fg font-bold">Set Price Alert</h2>
              <button onClick={() => setShowAlertModal(null)}
                className="w-7 h-7 rounded-lg bg-elevated hover:bg-elevated flex items-center justify-center text-fg-dim hover:text-fg transition text-sm">✕</button>
            </div>
            <p className="text-fg-dim text-xs mb-4">{TCC_SYMBOL_MAP[showAlertModal]?.displayName || showAlertModal}</p>
            <div className="flex gap-2 mb-4">
              {(["above", "below"] as const).map(type => (
                <button key={type} onClick={() => setAlertForm({ ...alertForm, type })}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition ${alertForm.type === type ? "bg-success-soft text-success border-success/30" : "bg-elevated text-fg-dim border-border"}`}>
                  {type === "above" ? "↑ Price Above" : "↓ Price Below"}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={alertForm.price}
              onChange={e => setAlertForm({ ...alertForm, price: e.target.value })}
              placeholder="Enter price..."
              className="w-full bg-elevated border border-border rounded-xl px-4 py-2.5 text-fg text-sm mb-5 focus:outline-none focus:border-border placeholder-white/20"
            />
            <button
              onClick={() => handleAddAlert(showAlertModal)}
              disabled={!alertForm.price || parseFloat(alertForm.price) <= 0}
              className="w-full bg-warning-soft text-warning border border-warning/30 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-warning/22 transition">
              🔔 Set Alert
            </button>
          </div>
        </div>
      )}
    </>
  );
}