"use client";
import { useEffect, useRef } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { useCopyTradingStore } from "@/store/copyTradingStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useWatchlistStore } from "@/store/watchlistStore";
import { calculateRiskScore } from "@/store/riskStore";

export function useSystemNotifications() {
  const prevPositions = useRef(0);
  const prevCopyTrades = useRef(0);
  const prevRiskLevel = useRef("LOW");
  const initialized = useRef(false);

  useEffect(() => {
    // Don't fire on first mount
    if (!initialized.current) {
      initialized.current = true;
      prevPositions.current = useTradeStore.getState().positions.length;
      prevCopyTrades.current = useCopyTradingStore.getState().copyTrades.length;
      return;
    }

    const unsubTrade = useTradeStore.subscribe(
      (state) => state.positions.length,
      (count, prev) => {
        const { addNotification } = useNotificationStore.getState();

        if (count > prev) {
          // New position opened
          addNotification({
            type: "journal_prompt",
            priority: "low",
            title: "📓 New Trade Opened",
            message: "Log your emotion in the Journal while it's fresh. What's your confidence level?",
            action: { label: "Open Journal", path: "/journal" },
          });

          // Check risk
          const risk = calculateRiskScore();
          if (risk.level === "HIGH" || risk.level === "EXTREME") {
            addNotification({
              type: "risk_warning",
              priority: risk.level === "EXTREME" ? "critical" : "high",
              title: `⚠ Risk Score ${risk.level}: ${risk.total}/100`,
              message: risk.recommendation,
              action: { label: "View Dashboard", path: "/" },
            });
          }
        }

        if (count < prev) {
          // Position closed
          addNotification({
            type: "journal_prompt",
            priority: "low",
            title: "✅ Trade Closed",
            message: "Update your journal — what went right? What went wrong? Log it now.",
            action: { label: "Open Journal", path: "/journal" },
          });
        }
      }
    );

    const unsubCopy = useCopyTradingStore.subscribe(
      (state) => state.copyTrades.length,
      (count, prev) => {
        if (count > prev) {
          const { addNotification } = useNotificationStore.getState();
          const latest = useCopyTradingStore.getState().copyTrades[0];
          if (latest) {
            addNotification({
              type: "copy_trade",
              priority: latest.status === "blocked" ? "medium" : "high",
              title: `📡 Copy Trade ${latest.status === "copied" ? "Executed" : "Blocked"}`,
              message: `${latest.masterHandle}: ${latest.direction} ${latest.symbol} — Your lot: ${latest.followerLot}${latest.status === "blocked" ? ` | Blocked: ${latest.blockReason}` : ""}`,
              action: { label: "View Copy Trading", path: "/copy-trading" },
            });
          }
        }
      }
    );

    // Watchlist alerts check
    const unsubWatchlist = useWatchlistStore.subscribe(
      (state) => state.items,
      (items) => {
        const { addNotification } = useNotificationStore.getState();
        items.forEach(item => {
          if (item.currentPrice === 0) return;
          item.alerts.forEach(alert => {
            if (alert.triggered) return;
            const triggered =
              (alert.type === "above" && item.currentPrice >= alert.price) ||
              (alert.type === "below" && item.currentPrice <= alert.price);
            if (triggered) {
              useWatchlistStore.getState().triggerAlert(item.symbol, alert.id);
              addNotification({
                type: "price_alert",
                priority: "high",
                title: `🔔 Price Alert Triggered — ${item.label}`,
                message: `${item.symbol} is now ${alert.type} your alert at $${alert.price.toLocaleString()}. Current: $${item.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
                action: { label: "Open Chart", path: "/" },
              });
            }
          });
        });
      }
    );

    return () => {
      unsubTrade();
      unsubCopy();
      unsubWatchlist();
    };
  }, []);
}