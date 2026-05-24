"use client";
import { useState } from "react";
import { useTradeStore } from "@/store/tradeStore";

const tabs = ["Positions", "History", "Replay", "Backtest"];
function calcEstPnl(direction: "BUY" | "SELL", entryPrice: number, targetPrice: number, lots: number): number {
  if (!targetPrice || !entryPrice) return 0;
  const diff = targetPrice - entryPrice;
  const pnl = direction === "BUY" ? diff * lots : -diff * lots;
  return parseFloat(pnl.toFixed(2));
}

export default function BottomPanel() {
  const [active, setActive] = useState("Positions");
  const { positions, closePosition, totalNetPnl, updateSlTp } = useTradeStore();
  const [editing, setEditing] = useState<{id: string, field: "sl" | "tp", value: string} | null>(null);

  const handleNumberInput = (val: string) => {
    if (/^\d*\.?\d*$/.test(val)) {
      setEditing(prev => prev ? {...prev, value: val} : null);
    }
  };

  const handleSave = () => {
    if (!editing) return;
    const pos = positions.find(p => p.id === editing.id);
    if (!pos) return;
    updateSlTp(
      editing.id,
      editing.field === "sl" ? parseFloat(editing.value) || 0 : pos.sl,
      editing.field === "tp" ? parseFloat(editing.value) || 0 : pos.tp,
    );
    setEditing(null);
  };

  const closeAll = () => positions.forEach((p) => closePosition(p.id));

  const getEstPnl = (pos: any) => {
    if (!editing || editing.id !== pos.id) return null;
    const target = parseFloat(editing.value);
    if (!target) return null;
    const pnl = calcEstPnl(pos.direction, pos.entryPrice, target, pos.lots);
    const pips = Math.abs(target - pos.entryPrice).toFixed(2);
    return { pnl, pips };
  };

  return (
    <div className="glass border-t border-white/5 h-48 flex flex-col">

      <div className="flex items-center gap-1 px-4 border-b border-white/5">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActive(tab)}
            className={`px-4 py-2 text-xs font-semibold transition border-b-2 ${
              active === tab ? "border-green-400 text-green-400" : "border-transparent text-white/40 hover:text-white/70"
            }`}>
            {tab}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 pr-2">
          {positions.length > 1 && (
            <button onClick={closeAll}
              className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg hover:bg-red-500/20 transition">
              Close All ({positions.length})
            </button>
          )}
          <span className="text-xs text-white/40">Total P&L</span>
          <span className={`text-sm font-bold ${totalNetPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
            {totalNetPnl >= 0 ? "+" : ""}${totalNetPnl.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {active === "Positions" && (
          <>
            {positions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-white/20 text-xs">No open positions — place a trade to get started</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30">
                    <th className="text-left py-1">Symbol</th>
                    <th className="text-left py-1">Dir</th>
                    <th className="text-left py-1">Lots</th>
                    <th className="text-left py-1">Entry</th>
                    <th className="text-left py-1">Current</th>
                    <th className="text-left py-1">SL</th>
                    <th className="text-left py-1">TP</th>
                    <th className="text-left py-1">R:R</th>
                    <th className="text-left py-1">Net P&L</th>
                    <th className="text-left py-1">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const est = getEstPnl(pos);
                    return (
                      <tr key={pos.id} className="border-t border-white/5">
                        <td className="py-2 text-white font-semibold">{pos.symbol}</td>
                        <td className={`py-2 font-semibold ${pos.direction === "BUY" ? "text-green-400" : "text-red-400"}`}>
                          {pos.direction}
                        </td>
                        <td className="py-2 text-white/60">{pos.lots}</td>
                        <td className="py-2 text-white/60">${pos.entryPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>
                        <td className="py-2 text-white">${pos.currentPrice.toLocaleString(undefined, {maximumFractionDigits: 2})}</td>

                        {/* SL */}
                        <td className="py-1">
                          {editing?.id === pos.id && editing.field === "sl" ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1">
                                <input autoFocus value={editing.value}
                                  onChange={(e) => handleNumberInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(null); }}
                                  className="bg-white/5 border border-red-500/40 rounded px-1 py-0.5 text-red-400 w-20 text-xs"
                                  placeholder="Price" />
                                <button onClick={handleSave} className="text-green-400 text-xs">✓</button>
                                <button onClick={() => setEditing(null)} className="text-white/30 text-xs">✕</button>
                              </div>
                              {est && (
                                <div className={`text-xs ${est.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  Est: {est.pnl >= 0 ? "+" : ""}${est.pnl} ({est.pips} pts)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-start">
                              <span className="text-red-400">{pos.sl > 0 ? `$${pos.sl.toLocaleString(undefined, {maximumFractionDigits: 2})}` : "—"}</span>
                              <button onClick={() => setEditing({id: pos.id, field: "sl", value: pos.sl > 0 ? pos.sl.toString() : ""})}
                                className="text-white/20 hover:text-amber-400 transition text-xs leading-none mt-0.5" title="Edit SL">✏</button>
                            </div>
                          )}
                        </td>

                        {/* TP */}
                        <td className="py-1">
                          {editing?.id === pos.id && editing.field === "tp" ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1">
                                <input autoFocus value={editing.value}
                                  onChange={(e) => handleNumberInput(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(null); }}
                                  className="bg-white/5 border border-green-500/40 rounded px-1 py-0.5 text-green-400 w-20 text-xs"
                                  placeholder="Price" />
                                <button onClick={handleSave} className="text-green-400 text-xs">✓</button>
                                <button onClick={() => setEditing(null)} className="text-white/30 text-xs">✕</button>
                              </div>
                              {est && (
                                <div className={`text-xs ${est.pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  Est: {est.pnl >= 0 ? "+" : ""}${est.pnl} ({est.pips} pts)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-start">
                              <span className="text-green-400">{pos.tp > 0 ? `$${pos.tp.toLocaleString(undefined, {maximumFractionDigits: 2})}` : "—"}</span>
                              <button onClick={() => setEditing({id: pos.id, field: "tp", value: pos.tp > 0 ? pos.tp.toString() : ""})}
                                className="text-white/20 hover:text-amber-400 transition text-xs leading-none mt-0.5" title="Edit TP">✏</button>
                            </div>
                          )}
                        </td>

                        <td className="py-2 text-white/60">
                          {pos.rrRatio ? `1:${pos.rrRatio}` : "—"}
                        </td>

                        <td className={`py-2 font-bold ${pos.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {pos.netPnl >= 0 ? "+" : ""}${pos.netPnl.toFixed(2)}
                        </td>

                        <td className="py-2">
                          <button onClick={() => closePosition(pos.id)}
                            className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded hover:bg-red-500/20 transition">
                            Close
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}      
        {active !== "Positions" && active !== "Journal" && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/20 text-xs">{active} panel — coming next</p>
          </div>
      )}
      </div>
    </div>
  );
}