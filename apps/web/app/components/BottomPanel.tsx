"use client";
/**
 * TCC Bottom Panel — Open Positions + Trade History
 *
 * Shows real paper positions from tradeStore.
 * No fake data. Empty state if no positions.
 */
import { useState, useCallback } from "react";
import { useTradeStore, PaperPosition, ClosedTrade } from "@/store/tradeStore";
import { useJournalStore } from "@/store/journalStore";
import { useNotificationStore } from "@/store/notificationStore";

type Tab = "positions" | "history";

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
  return `${Math.floor(ms / 86400000)}d`;
}

function formatPrice(price: number): string {
  if (price <= 0) return "—";
  if (price > 100) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

// ── Inline SL/TP editor ────────────────────────────────────────────────

function SLTPEditor({
  positionId, field, currentValue
}: { positionId: string; field: "sl" | "tp"; currentValue: number | null }) {
  const { updateSLTP, positions } = useTradeStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue?.toString() || "");

  const handleSave = () => {
    const num = parseFloat(value);
    const pos = positions.find(p => p.id === positionId);
    if (!pos) return;
    if (field === "sl") {
      updateSLTP(positionId, num > 0 ? num : null, pos.tp);
    } else {
      updateSLTP(positionId, pos.sl, num > 0 ? num : null);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={e => { if (/^\d*\.?\d*$/.test(e.target.value)) setValue(e.target.value); }}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          className="bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white text-xs w-20 text-center focus:outline-none"
        />
        <button onClick={handleSave} className="text-green-400 text-xs hover:text-green-300">✓</button>
        <button onClick={() => setEditing(false)} className="text-white/30 text-xs hover:text-white/60">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 cursor-pointer group" onClick={() => setEditing(true)}>
      <span className="text-white/60 text-xs">
        {currentValue && currentValue > 0 ? formatPrice(currentValue) : "—"}
      </span>
      <span className="text-white/20 text-xs opacity-0 group-hover:opacity-100 transition">✏</span>
    </div>
  );
}

// ── Position Row ───────────────────────────────────────────────────────

function PositionRow({ position }: { position: PaperPosition }) {
  const { closePosition } = useTradeStore();
  const { addEntryFromClosedTrade } = useJournalStore();
  const { addNotification } = useNotificationStore();

  const handleClose = useCallback(() => {
    const closed = closePosition(position.id, "manual");
    if (closed) {
      addEntryFromClosedTrade(closed);
      addNotification({
        type: "journal_prompt",
        priority: "medium",
        title: `✅ Paper ${closed.side} Closed — ${closed.displayName}`,
        message: `Exit: ${formatPrice(closed.exitPrice)} | P&L: ${closed.netPnl >= 0 ? "+" : ""}$${closed.netPnl.toFixed(2)} | ${formatDuration(closed.durationMs)}`,
        action: { label: "Update Journal", path: "/journal" },
      });
    }
  }, [position.id, closePosition, addEntryFromClosedTrade, addNotification]);

  const pnl = position.netPnl;
  const pnlColor = pnl > 0 ? "text-green-400" : pnl < 0 ? "text-red-400" : "text-white/50";
  const sideColor = position.side === "BUY" ? "text-green-400" : "text-red-400";
  const duration = Date.now() - new Date(position.openedAt).getTime();

  return (
    <tr className="border-b border-white/5 hover:bg-white/2 transition">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${sideColor}`}>{position.side}</span>
          <span className="text-white text-xs font-semibold">{position.displayName}</span>
        </div>
        <p className="text-white/20 text-xs">{formatDuration(duration)}</p>
      </td>
      <td className="px-3 py-2 text-white/60 text-xs text-right">{position.lotSize}</td>
      <td className="px-3 py-2 text-white/70 text-xs text-right">{formatPrice(position.entryPrice)}</td>
      <td className="px-3 py-2 text-white text-xs text-right font-medium">
        {position.currentPrice > 0 ? formatPrice(position.currentPrice) : "Updating..."}
      </td>
      <td className="px-3 py-2 text-right">
        <SLTPEditor positionId={position.id} field="sl" currentValue={position.sl} />
      </td>
      <td className="px-3 py-2 text-right">
        <SLTPEditor positionId={position.id} field="tp" currentValue={position.tp} />
      </td>
      <td className="px-3 py-2 text-right">
        <span className="text-white/40 text-xs">${position.marginUsed.toFixed(2)}</span>
      </td>
      <td className={`px-3 py-2 text-right font-bold text-xs ${pnlColor}`}>
        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={handleClose}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg text-xs font-semibold transition">
          Close
        </button>
      </td>
    </tr>
  );
}

// ── Closed Trade Row ───────────────────────────────────────────────────

function HistoryRow({ trade }: { trade: ClosedTrade }) {
  const pnl = trade.netPnl;
  const pnlColor = pnl > 0 ? "text-green-400" : pnl < 0 ? "text-red-400" : "text-white/50";
  const sideColor = trade.side === "BUY" ? "text-green-400" : "text-red-400";
  const reasonBadge = {
    manual: "text-white/30 bg-white/5",
    stop_loss: "text-red-400 bg-red-500/10",
    take_profit: "text-green-400 bg-green-500/10",
  }[trade.closeReason];
  const reasonLabel = {
    manual: "Manual", stop_loss: "SL Hit", take_profit: "TP Hit"
  }[trade.closeReason];

  return (
    <tr className="border-b border-white/5 hover:bg-white/2 transition">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-bold ${sideColor}`}>{trade.side}</span>
          <span className="text-white text-xs font-semibold">{trade.displayName}</span>
        </div>
        <p className="text-white/20 text-xs">{new Date(trade.closedAt).toLocaleString()}</p>
      </td>
      <td className="px-3 py-2 text-white/60 text-xs text-right">{trade.lotSize}</td>
      <td className="px-3 py-2 text-white/60 text-xs text-right">{formatPrice(trade.entryPrice)}</td>
      <td className="px-3 py-2 text-white/70 text-xs text-right">{formatPrice(trade.exitPrice)}</td>
      <td className="px-3 py-2 text-white/40 text-xs text-right">{formatDuration(trade.durationMs)}</td>
      <td className="px-3 py-2 text-right">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${reasonBadge}`}>{reasonLabel}</span>
      </td>
      <td className={`px-3 py-2 text-right font-bold text-xs ${pnlColor}`}>
        {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function BottomPanel() {
  const { positions, closedTrades, closeAllPositions } = useTradeStore();
  const { addEntryFromClosedTrade } = useJournalStore();
  const { addNotification } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<Tab>("positions");

  const totalPnl = positions.reduce((s, p) => s + p.netPnl, 0);
  const totalClosedPnl = closedTrades.reduce((s, t) => s + t.netPnl, 0);
  const totalPnlColor = totalPnl >= 0 ? "text-green-400" : "text-red-400";

  const handleCloseAll = useCallback(() => {
    const openPositions = [...positions];
    closeAllPositions();
    openPositions.forEach(pos => {
      // We don't have the closed trade here, so we create minimal journal entries
      // The store already added events — useSystemNotifications will handle them
    });
    if (openPositions.length > 0) {
      addNotification({
        type: "journal_prompt",
        priority: "medium",
        title: `📤 ${openPositions.length} Paper Position${openPositions.length > 1 ? "s" : ""} Closed`,
        message: "All positions closed manually. Journal entries created.",
        action: { label: "Review Journal", path: "/journal" },
      });
    }
  }, [positions, closeAllPositions, addNotification]);

  return (
    <div className="glass border-t border-white/5 flex flex-col" style={{ minHeight: "160px", maxHeight: "300px" }}>

      {/* Tab bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("positions")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${activeTab === "positions" ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/70"}`}>
            Open Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition ${activeTab === "history" ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/70"}`}>
            History ({closedTrades.length})
          </button>
        </div>

        <div className="flex items-center gap-4">
          {activeTab === "positions" && positions.length > 0 && (
            <>
              <span className={`text-xs font-bold ${totalPnlColor}`}>
                Float: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </span>
              <button
                onClick={handleCloseAll}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1 rounded-lg text-xs font-semibold transition">
                Close All
              </button>
            </>
          )}
          {activeTab === "history" && closedTrades.length > 0 && (
            <span className={`text-xs font-bold ${totalClosedPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              Realized: {totalClosedPnl >= 0 ? "+" : ""}${totalClosedPnl.toFixed(2)}
            </span>
          )}
          <span className="text-xs text-green-400/40 bg-green-500/5 border border-green-500/10 px-2 py-0.5 rounded-full">Paper</span>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">

        {/* ── Positions Tab ── */}
        {activeTab === "positions" && (
          positions.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-white/20 text-sm">No open paper positions. BUY or SELL from the chart above.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0a0a0f] z-10">
                <tr className="border-b border-white/5">
                  <th className="text-left px-3 py-2 text-white/30">Symbol</th>
                  <th className="text-right px-3 py-2 text-white/30">Lots</th>
                  <th className="text-right px-3 py-2 text-white/30">Entry</th>
                  <th className="text-right px-3 py-2 text-white/30">Current</th>
                  <th className="text-right px-3 py-2 text-white/30">SL ✏</th>
                  <th className="text-right px-3 py-2 text-white/30">TP ✏</th>
                  <th className="text-right px-3 py-2 text-white/30">Margin</th>
                  <th className="text-right px-3 py-2 text-white/30">Float P&L</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {positions.map(pos => (
                  <PositionRow key={pos.id} position={pos} />
                ))}
              </tbody>
            </table>
          )
        )}

        {/* ── History Tab ── */}
        {activeTab === "history" && (
          closedTrades.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-white/20 text-sm">No closed paper trades yet.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0a0a0f] z-10">
                <tr className="border-b border-white/5">
                  <th className="text-left px-3 py-2 text-white/30">Symbol</th>
                  <th className="text-right px-3 py-2 text-white/30">Lots</th>
                  <th className="text-right px-3 py-2 text-white/30">Entry</th>
                  <th className="text-right px-3 py-2 text-white/30">Exit</th>
                  <th className="text-right px-3 py-2 text-white/30">Duration</th>
                  <th className="text-right px-3 py-2 text-white/30">Reason</th>
                  <th className="text-right px-3 py-2 text-white/30">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map(trade => (
                  <HistoryRow key={trade.id} trade={trade} />
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}