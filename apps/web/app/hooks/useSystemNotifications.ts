"use client";

/**
 * TCC System Notifications Hook
 *
 * Listens to trade store events and watchlist alerts.
 * No fake notifications. All generated from actual user actions.
 */

import { useEffect, useRef } from "react";
import { useTradeStore, TradeEvent } from "@/store/tradeStore";
import { useJournalStore } from "@/store/journalStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useWatchlistStore } from "@/store/watchlistStore";
import { calculateRiskScore } from "@/store/riskStore";

function formatPnl(pnl: number): string {
  return `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`;
}

function formatDuration(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function useSystemNotifications() {
  const processedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Trade events subscription.
    // Use one-argument subscribe because the store does not use subscribeWithSelector.
    const unsubTrade = useTradeStore.subscribe((state) => {
      const events = state.events;

      if (!events || events.length === 0) return;

      const { addNotification } = useNotificationStore.getState();
      const { addEntryFromClosedTrade } = useJournalStore.getState();

      const unprocessedEvents = events.filter(
        (event: TradeEvent) => !processedEvents.current.has(event.id)
      );

      if (unprocessedEvents.length === 0) return;

      unprocessedEvents.forEach((event: TradeEvent) => {
        processedEvents.current.add(event.id);

        if (event.type === "position_opened" && event.position) {
          const pos = event.position;

          addNotification({
            type: "journal_prompt",
            priority: "low",
            title: `📊 Paper ${pos.side} Opened — ${pos.displayName}`,
            message: `${pos.lotSize} lot${pos.lotSize !== 1 ? "s" : ""} @ $${pos.entryPrice.toLocaleString(
              undefined,
              { maximumFractionDigits: 4 }
            )} | Paper Mode`,
            action: { label: "View Positions", path: "/" },
          });

          const risk = calculateRiskScore();

          if (risk.level === "HIGH" || risk.level === "EXTREME") {
            addNotification({
              type: "risk_warning",
              priority: risk.level === "EXTREME" ? "critical" : "high",
              title: `⚠ Risk Level: ${risk.level}`,
              message: risk.recommendation,
              action: { label: "View Dashboard", path: "/" },
            });
          }
        }

        if (
          (event.type === "position_closed_manual" ||
            event.type === "position_closed_sl" ||
            event.type === "position_closed_tp") &&
          event.closedTrade
        ) {
          const trade = event.closedTrade;

          const reasonLabel =
            event.type === "position_closed_sl"
              ? "⛔ Stop Loss Hit"
              : event.type === "position_closed_tp"
                ? "✅ Take Profit Hit"
                : "📤 Manually Closed";

          addNotification({
            type: event.type === "position_closed_sl" ? "risk_warning" : "journal_prompt",
            priority: event.type === "position_closed_sl" ? "high" : "medium",
            title: `${reasonLabel} — ${trade.displayName}`,
            message: `Paper ${trade.side} closed | P&L: ${formatPnl(
              trade.netPnl
            )} | Duration: ${formatDuration(trade.durationMs)}`,
            action: { label: "Update Journal", path: "/journal" },
          });

          try {
            addEntryFromClosedTrade(trade);

            addNotification({
              type: "journal_prompt",
              priority: "low",
              title: "📓 Journal Entry Created",
              message: `${trade.displayName} trade logged. Add your notes, emotion, and lessons.`,
              action: { label: "Update Journal", path: "/journal" },
            });
          } catch {
            // Keep silent so notification hook never breaks trading flow.
          }
        }
      });
    });

    // Watchlist alerts subscription.
    // Also one-argument subscribe for the same reason.
    const unsubWatchlist = useWatchlistStore.subscribe((state) => {
      const items = state.items;

      if (!items || items.length === 0) return;

      const { addNotification } = useNotificationStore.getState();

      items.forEach((item) => {
        if (!item.currentPrice || item.currentPrice === 0) return;
        if (!item.alerts || item.alerts.length === 0) return;

        item.alerts.forEach((alert) => {
          if (alert.triggered) return;

          const triggered =
            (alert.type === "above" && item.currentPrice >= alert.price) ||
            (alert.type === "below" && item.currentPrice <= alert.price);

          if (!triggered) return;

          useWatchlistStore.getState().triggerAlert(item.symbolId, alert.id);

          addNotification({
            type: "price_alert",
            priority: "high",
            title: `🔔 Price Alert — ${item.displayName}`,
            message: `${item.symbolId} hit your ${alert.type} alert at $${alert.price.toLocaleString()}. Current: $${item.currentPrice.toLocaleString(
              undefined,
              { maximumFractionDigits: 4 }
            )}`,
            action: { label: "Open Chart", path: "/" },
          });
        });
      });
    });

    return () => {
      unsubTrade();
      unsubWatchlist();
    };
  }, []);
}