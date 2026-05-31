"use client";
import { useState } from "react";
import { useWatchlistStore } from "@/store/watchlistStore";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useNotificationStore } from "@/store/notificationStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

export default function WatchlistPage() {
  const { items, availableSymbols, addSymbol, removeSymbol, addAlert, removeAlert } = useWatchlistStore();
  const { loading } = useMarketPrices();
  const { addNotification } = useNotificationStore();
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState<string | null>(null);
  const [alertForm, setAlertForm] = useState({ type: "above" as "above" | "below", price: "" });
  const [selectedForAdd, setSelectedForAdd] = useState("");

  const handleAddAlert = (symbol: string) => {
    if (!alertForm.price) return;
    addAlert(symbol, alertForm.type, parseFloat(alertForm.price));
    addNotification({
      type: "price_alert",
      priority: "medium",
      title: `🔔 Price Alert Set — ${symbol}`,
      message: `You'll be notified when ${symbol} goes ${alertForm.type} $${alertForm.price}`,
    });
    setShowAlertModal(null);
    setAlertForm({ type: "above", price: "" });
  };

  const notWatchlisted = availableSymbols.filter(s => !items.find(i => i.symbol === s.symbol));

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">👁 Watchlist</h1>
              <p className="text-white/40 text-sm mt-1">Monitor your favorite assets. Set price alerts.</p>
            </div>
            <div className="flex items-center gap-3">
              {!loading && <div className="flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /><span className="text-green-400 text-xs">Live</span></div>}
              <button onClick={() => setShowAddSymbol(true)}
                className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-500/30 transition">
                + Add Symbol
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-5xl mb-3">👁</p>
                <p className="text-white/40">Your watchlist is empty</p>
                <button onClick={() => setShowAddSymbol(true)} className="mt-3 bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm">Add Symbol</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {items.map(item => (
                <div key={item.symbol} className="glass border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
                  <div className="flex items-center gap-6">

                    <div className="flex items-center gap-3 w-48">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white font-bold">
                        {item.symbol.replace("USDT", "").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{item.label}</p>
                        <p className="text-white/30 text-xs capitalize">{item.category}</p>
                      </div>
                    </div>

                    <div className="flex-1 flex items-center gap-8">
                      <div>
                        <p className="text-white/40 text-xs">Price</p>
                        <p className="text-white font-bold text-lg">
                          {item.currentPrice > 0 ? `$${item.currentPrice.toLocaleString(undefined, { maximumFractionDigits: item.currentPrice > 100 ? 2 : 4 })}` : "Loading..."}
                        </p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">24h Change</p>
                        <p className={`font-bold ${item.changePct24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {item.changePct24h >= 0 ? "+" : ""}{item.changePct24h.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">24h High</p>
                        <p className="text-white/70 text-sm">{item.high24h > 0 ? `$${item.high24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">24h Low</p>
                        <p className="text-white/70 text-sm">{item.low24h > 0 ? `$${item.low24h.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-white/40 text-xs">Volume</p>
                        <p className="text-white/70 text-sm">
                          {item.volume24h > 0 ? (item.volume24h > 1e9 ? `$${(item.volume24h / 1e9).toFixed(2)}B` : `$${(item.volume24h / 1e6).toFixed(2)}M`) : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Alerts */}
                    <div className="flex flex-col gap-1 w-32">
                      {item.alerts.filter(a => !a.triggered).map(alert => (
                        <div key={alert.id} className="flex items-center gap-1">
                          <span className={`text-xs ${alert.type === "above" ? "text-green-400" : "text-red-400"}`}>
                            {alert.type === "above" ? "↑" : "↓"} ${alert.price.toLocaleString()}
                          </span>
                          <button onClick={() => removeAlert(item.symbol, alert.id)} className="text-white/20 hover:text-red-400 text-xs">✕</button>
                        </div>
                      ))}
                      {item.alerts.filter(a => !a.triggered).length === 0 && (
                        <p className="text-white/20 text-xs">No alerts</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => { setShowAlertModal(item.symbol); setAlertForm({ type: "above", price: "" }); }}
                        className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs hover:bg-amber-500/20 transition">
                        🔔 Alert
                      </button>
                      <button onClick={() => removeSymbol(item.symbol)}
                        className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs hover:bg-red-500/20 transition">
                        ✕
                      </button>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Symbol Modal */}
      {showAddSymbol && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">Add to Watchlist</h2>
              <button onClick={() => setShowAddSymbol(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <select value={selectedForAdd} onChange={e => setSelectedForAdd(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4">
              <option value="">Select symbol...</option>
              {notWatchlisted.map(s => (
                <option key={s.symbol} value={s.symbol} className="bg-[#0a0a0f]">{s.label}</option>
              ))}
            </select>
            <button
              onClick={() => { if (selectedForAdd) { addSymbol(selectedForAdd, selectedForAdd.replace("USDT", "/USDT")); setShowAddSymbol(false); setSelectedForAdd(""); } }}
              disabled={!selectedForAdd}
              className="w-full bg-green-500/20 text-green-400 border border-green-500/30 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
              Add to Watchlist
            </button>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">Set Price Alert — {showAlertModal}</h2>
              <button onClick={() => setShowAlertModal(null)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
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
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-4"
            />
            <button onClick={() => handleAddAlert(showAlertModal)}
              disabled={!alertForm.price}
              className="w-full bg-amber-500/20 text-amber-400 border border-amber-500/30 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
              🔔 Set Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}