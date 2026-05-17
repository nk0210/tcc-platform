"use client";
import { useState } from "react";

const tabs = ["Positions", "History", "Journal", "Replay", "Backtest"];

export default function BottomPanel() {
  const [active, setActive] = useState("Positions");

  return (
    <div className="glass border-t border-white/5 h-48 flex flex-col">

      <div className="flex items-center gap-1 px-4 border-b border-white/5">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-2 text-xs font-semibold transition border-b-2 ${
              active === tab
                ? "border-green-400 text-green-400"
                : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        {active === "Positions" && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30">
                <th className="text-left py-1">Symbol</th>
                <th className="text-left py-1">Direction</th>
                <th className="text-left py-1">Lots</th>
                <th className="text-left py-1">Entry</th>
                <th className="text-left py-1">Current</th>
                <th className="text-left py-1">SL</th>
                <th className="text-left py-1">TP</th>
                <th className="text-left py-1">P&L</th>
              </tr>
            </thead>
            <tbody>
              {[
                { symbol: "XAUUSD", dir: "BUY", lots: "0.10", entry: "2338.50", current: "2345.50", sl: "2325.00", tp: "2360.00", pnl: "+$70.00", positive: true },
                { symbol: "EURUSD", dir: "SELL", lots: "0.05", entry: "1.0842", current: "1.0831", sl: "1.0880", tp: "1.0800", pnl: "+$5.50", positive: true },
              ].map((pos) => (
                <tr key={pos.symbol} className="border-t border-white/5">
                  <td className="py-2 text-white font-semibold">{pos.symbol}</td>
                  <td className={`py-2 font-semibold ${pos.dir === "BUY" ? "text-green-400" : "text-red-400"}`}>{pos.dir}</td>
                  <td className="py-2 text-white/60">{pos.lots}</td>
                  <td className="py-2 text-white/60">{pos.entry}</td>
                  <td className="py-2 text-white">{pos.current}</td>
                  <td className="py-2 text-red-400">{pos.sl}</td>
                  <td className="py-2 text-green-400">{pos.tp}</td>
                  <td className={`py-2 font-bold ${pos.positive ? "text-green-400" : "text-red-400"}`}>{pos.pnl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {active !== "Positions" && (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/20 text-xs">{active} panel — coming soon</p>
          </div>
        )}
      </div>

    </div>
  );
}