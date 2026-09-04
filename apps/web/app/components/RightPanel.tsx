"use client";
/**
 * TCC Right Panel — Risk Score + Journal + News
 *
 * Risk score calculated from REAL trade state.
 * No fake scores. Empty/low state when no positions.
 *
 * Fixed:
 * - Hydration mismatch from persisted trade/account values.
 * - Removed useTradeStore.getState() from JSX render.
 * - Added mounted guards so server and first client render match safely.
 */

import { useState, useEffect, memo } from "react";
import { useTradeStore } from "@/store/tradeStore";
import { useJournalStore } from "@/store/journalStore";
import {
  calculateRiskScore,
  getRiskColor,
  getRiskBg,
  type RiskScore,
} from "@/store/riskStore";
import { useNewsStore } from "@/store/newsStore";
import CopilotPanel from "@/components/copilot/CopilotPanel";

type RightTab = "risk" | "journal" | "news" | "copilot";

// ── Risk Score Display ────────────────────────────────────────────────

function RiskPanel({ score }: { score: RiskScore }) {
  const [mounted, setMounted] = useState(false);

  // Individual selectors — RiskPanel only needs these 6 fields, but a plain
  // useTradeStore() subscribes to the whole store and re-renders on every
  // WS price tick's positions/events churn too, not just these values.
  const balance     = useTradeStore((s) => s.balance);
  const equity      = useTradeStore((s) => s.equity);
  const freeMargin  = useTradeStore((s) => s.freeMargin);
  const marginUsed  = useTradeStore((s) => s.marginUsed);
  const marginLevel = useTradeStore((s) => s.marginLevel);
  const floatingPnl = useTradeStore((s) => s.floatingPnl);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayLevel = mounted ? score.level : "LOW";
  const displayTotal = mounted ? score.total : 0;
  const displayRecommendation = mounted
    ? score.recommendation
    : "Open paper trades to see real risk analysis.";
  const displayFactors = mounted ? score.factors : [];

  const levelColor = getRiskColor(displayLevel);
  const levelBg = getRiskBg(displayLevel);
  const pct = displayTotal;

  const gaugeColor =
    displayLevel === "LOW"
      ? "#00ff88"
      : displayLevel === "MEDIUM"
        ? "#f59e0b"
        : displayLevel === "HIGH"
          ? "#f97316"
          : "#ef4444";

  const accountItems = [
    {
      label: "Balance",
      value: `$${balance.toFixed(2)}`,
      color: "text-fg",
    },
    {
      label: "Equity",
      value: `$${equity.toFixed(2)}`,
      color: equity >= balance ? "text-success" : "text-danger",
    },
    {
      label: "Free Margin",
      value: `$${freeMargin.toFixed(2)}`,
      color: freeMargin < 500 ? "text-danger" : "text-fg-muted",
    },
    {
      label: "Margin Used",
      value: `$${marginUsed.toFixed(2)}`,
      color: "text-fg-muted",
    },
    {
      label: "Margin Level",
      value: marginUsed > 0 ? `${marginLevel.toFixed(0)}%` : "—",
      color:
        marginLevel < 150 && marginUsed > 0
          ? "text-danger"
          : "text-fg-muted",
    },
    {
      label: "Floating P&L",
      value: `${floatingPnl >= 0 ? "+" : ""}$${floatingPnl.toFixed(2)}`,
      color: floatingPnl >= 0 ? "text-success" : "text-danger",
    },
  ];

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Score gauge */}
      <div className={`glass border rounded-xl p-4 ${levelBg}`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-fg-muted text-xs uppercase tracking-wider">
            Risk Score
          </p>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${levelBg} border ${levelColor}`}
          >
            {displayLevel}
          </span>
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-3xl font-bold ${levelColor}`}>
            {displayTotal}
          </span>
          <div className="flex-1">
            <div className="w-full bg-elevated rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: gaugeColor,
                }}
              />
            </div>
            <div className="flex justify-between text-fg-dim text-xs mt-0.5">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <p
          className={`text-xs leading-relaxed ${
            displayTotal === 0 ? "text-fg-dim" : levelColor
          }`}
        >
          {displayRecommendation}
        </p>
      </div>

      {/* Account summary */}
      <div className="glass border border-border rounded-xl p-4">
        <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">
          Account (Paper)
        </p>

        {accountItems.map((item) => (
          <div
            key={item.label}
            className="flex justify-between items-center mb-1.5"
          >
            <span className="text-fg-dim text-xs">{item.label}</span>
            <span
              className={`text-xs font-semibold ${
                mounted ? item.color : "text-fg-dim"
              }`}
            >
              {mounted ? item.value : "—"}
            </span>
          </div>
        ))}
      </div>

      {/* Risk factors */}
      {displayFactors.length > 0 && (
        <div className="glass border border-border rounded-xl p-4">
          <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">
            Risk Factors
          </p>
          <div className="flex flex-col gap-2">
            {displayFactors.map((factor, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-2 rounded-lg ${
                  factor.severity === "danger"
                    ? "bg-danger-soft"
                    : factor.severity === "warning"
                      ? "bg-warning-soft"
                      : "bg-elevated"
                }`}
              >
                <span className="text-sm shrink-0">
                  {factor.severity === "danger"
                    ? "🔴"
                    : factor.severity === "warning"
                      ? "🟡"
                      : "🟢"}
                </span>
                <div>
                  <p
                    className={`text-xs font-semibold ${
                      factor.severity === "danger"
                        ? "text-danger"
                        : factor.severity === "warning"
                          ? "text-warning"
                          : "text-fg-muted"
                    }`}
                  >
                    {factor.name}
                  </p>
                  <p className="text-fg-dim text-xs">{factor.description}</p>
                </div>
                <span className="ml-auto text-xs text-fg-dim shrink-0">
                  +{factor.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {displayTotal === 0 && (
        <div className="glass border border-border rounded-xl p-4">
          <p className="text-fg-dim text-xs text-center">
            Open paper trades to see real risk analysis.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Journal Panel ─────────────────────────────────────────────────────

function JournalPanel() {
  const { entries, updateEntry } = useJournalStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = entries.find((e) => e.id === selectedId);
  const recentEntries = entries.slice(0, 15);

  if (selected) {
    const pnlColor =
      (selected.netPnl || 0) >= 0 ? "text-success" : "text-danger";

    const resultBadge =
      selected.result === "WIN"
        ? "text-success bg-success-soft border-success/30"
        : selected.result === "LOSS"
          ? "text-danger bg-danger-soft border-danger/30"
          : "text-fg-dim bg-elevated border-border";

    return (
      <div className="p-4 flex flex-col gap-3">
        <button
          onClick={() => setSelectedId(null)}
          className="text-fg-dim hover:text-fg-muted text-xs transition text-left"
        >
          ← Back to journal
        </button>

        <div className="glass border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-sm font-bold ${
                    selected.side === "BUY" ? "text-success" : "text-danger"
                  }`}
                >
                  {selected.side}
                </span>
                <span className="text-fg font-semibold text-sm">
                  {selected.displayName}
                </span>
              </div>
              <p className="text-fg-dim text-xs">
                {selected.closedAt
                  ? new Date(selected.closedAt).toLocaleString()
                  : "Open trade"}
              </p>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full border capitalize ${resultBadge}`}
            >
              {selected.result || "—"}
            </span>
          </div>

          {selected.netPnl != null && (
            <p className={`text-xl font-bold ${pnlColor} mb-3`}>
              {selected.netPnl >= 0 ? "+" : ""}${selected.netPnl.toFixed(2)}
            </p>
          )}

          <div className="grid grid-cols-2 gap-1 text-xs mb-3">
            <div>
              <span className="text-fg-dim">Entry</span>{" "}
              <span className="text-fg-muted">
                ${selected.entryPrice?.toFixed(4)}
              </span>
            </div>

            {selected.exitPrice && (
              <div>
                <span className="text-fg-dim">Exit</span>{" "}
                <span className="text-fg-muted">
                  ${selected.exitPrice?.toFixed(4)}
                </span>
              </div>
            )}

            <div>
              <span className="text-fg-dim">Lots</span>{" "}
              <span className="text-fg-muted">{selected.lotSize}</span>
            </div>

            {selected.closeReason && (
              <div>
                <span className="text-fg-dim">Reason</span>{" "}
                <span className="text-fg-muted capitalize">
                  {selected.closeReason.replace("_", " ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Editable fields */}
        <div className="glass border border-border rounded-xl p-4 flex flex-col gap-3">
          <p className="text-fg-dim text-xs uppercase tracking-wider">
            Your Notes
          </p>

          <div>
            <p className="text-fg-dim text-xs mb-1">Emotion</p>
            <select
              value={selected.emotion}
              onChange={(e) =>
                updateEntry(selected.id, { emotion: e.target.value as any })
              }
              className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs"
            >
              {[
                "neutral",
                "confident",
                "fearful",
                "greedy",
                "hesitant",
                "frustrated",
              ].map((emotion) => (
                <option
                  key={emotion}
                  value={emotion}
                  className="bg-[#0a0a0f] capitalize"
                >
                  {emotion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-fg-dim text-xs mb-1">Followed plan?</p>
            <div className="flex gap-2">
              {[
                { label: "Yes", val: true },
                { label: "No", val: false },
                { label: "—", val: null },
              ].map((opt) => (
                <button
                  key={String(opt.val)}
                  onClick={() =>
                    updateEntry(selected.id, { followedPlan: opt.val })
                  }
                  className={`flex-1 py-1 rounded-lg text-xs border transition ${
                    selected.followedPlan === opt.val
                      ? "bg-success-soft text-success border-success/30"
                      : "bg-elevated text-fg-dim border-border"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-fg-dim text-xs mb-1">Notes</p>
            <textarea
              value={selected.notes}
              onChange={(e) =>
                updateEntry(selected.id, { notes: e.target.value })
              }
              placeholder="What happened? What was your thesis?"
              rows={3}
              className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs resize-none focus:outline-none focus:border-border-strong placeholder-white/20"
            />
          </div>

          <div>
            <p className="text-fg-dim text-xs mb-1">Lesson Learned</p>
            <textarea
              value={selected.lessonLearned}
              onChange={(e) =>
                updateEntry(selected.id, { lessonLearned: e.target.value })
              }
              placeholder="What would you do differently?"
              rows={2}
              className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs resize-none focus:outline-none focus:border-border-strong placeholder-white/20"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {recentEntries.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <p className="text-3xl mb-2">📓</p>
            <p className="text-fg-dim text-xs">No journal entries yet.</p>
            <p className="text-fg-dim text-xs mt-1">
              Entries are created automatically when you close a paper trade.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recentEntries.map((entry) => {
            const pnlColor =
              (entry.netPnl || 0) >= 0 ? "text-success" : "text-danger";

            return (
              <div
                key={entry.id}
                onClick={() => setSelectedId(entry.id)}
                className="glass border border-border rounded-xl p-3 cursor-pointer hover:border-border transition"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        entry.side === "BUY"
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {entry.side}
                    </span>
                    <span className="text-fg-muted text-xs font-semibold">
                      {entry.displayName}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${
                        entry.result === "WIN"
                          ? "text-success bg-success-soft"
                          : entry.result === "LOSS"
                            ? "text-danger bg-danger-soft"
                            : "text-fg-dim bg-elevated"
                      }`}
                    >
                      {entry.result || "—"}
                    </span>
                  </div>

                  {entry.netPnl != null && (
                    <span className={`text-xs font-bold ${pnlColor}`}>
                      {entry.netPnl >= 0 ? "+" : ""}${entry.netPnl.toFixed(2)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-fg-dim text-xs">
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>

                  {entry.closeReason && (
                    <span className="text-fg-dim text-xs capitalize">
                      {entry.closeReason.replace("_", " ")}
                    </span>
                  )}
                </div>

                {!entry.notes && (
                  <p className="text-fg-dim text-xs mt-1 italic">
                    Tap to add notes →
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── News Panel ────────────────────────────────────────────────────────

function NewsPanel() {
  const { news } = useNewsStore();
  const recent = news.slice(0, 8);

  return (
    <div className="p-4 flex flex-col gap-2">
      {recent.length === 0 ? (
        <p className="text-fg-dim text-xs text-center py-8">
          No news loaded yet.
        </p>
      ) : (
        recent.map((item) => (
          <div
            key={item.id}
            className="glass border border-border rounded-xl p-3 hover:border-border transition cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full border capitalize ${
                  item.sentiment === "bullish"
                    ? "text-success bg-success-soft border-success/30"
                    : item.sentiment === "bearish"
                      ? "text-danger bg-danger-soft border-danger/30"
                      : "text-fg-dim bg-elevated border-border"
                }`}
              >
                {item.sentiment}
              </span>
              <span className="text-fg-dim text-xs">{item.source}</span>
              <span className="text-fg-dim text-xs ml-auto">
                {Math.floor(
                  (Date.now() - new Date(item.timestamp).getTime()) / 3600000
                )}
                h ago
              </span>
            </div>
            <p className="text-fg-muted text-xs leading-relaxed line-clamp-2">
              {item.title}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

function RightPanel() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<RightTab>("risk");
  const [riskScore, setRiskScore] = useState<RiskScore>(() =>
    calculateRiskScore()
  );

  const { entries } = useJournalStore();
  const { news } = useNewsStore();

  useEffect(() => {
    setMounted(true);
    setRiskScore(calculateRiskScore());

    const unsub = useTradeStore.subscribe(() => {
      setRiskScore(calculateRiskScore());
    });

    return unsub;
  }, []);

  const tabs = [
    {
      key: "risk" as RightTab,
      label: "Risk",
      badge: mounted && riskScore.total > 0 ? riskScore.level : null,
    },
    {
      key: "journal" as RightTab,
      label: "Journal",
      badge: mounted && entries.length > 0 ? entries.length : null,
    },
    {
      key: "news" as RightTab,
      label: "News",
      badge: mounted && news.length > 0 ? news.length : null,
    },
    {
      key: "copilot" as RightTab,
      label: "Copilot",
      badge: null,
    },
  ];

  return (
    <div className="glass !border-y-0 !border-r-0 rounded-none flex flex-col w-72 shrink-0 overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition border-b-2 ${
              activeTab === tab.key
                ? "text-accent-hover border-accent"
                : "text-fg-dim border-transparent hover:text-fg-muted"
            }`}
          >
            {tab.label}

            {tab.badge && (
              <span
                className={`text-xs px-1 rounded-full ${
                  tab.key === "risk" && tab.badge !== 0
                    ? riskScore.level === "EXTREME"
                      ? "bg-danger text-fg"
                      : riskScore.level === "HIGH"
                        ? "bg-warning text-fg"
                        : riskScore.level === "MEDIUM"
                          ? "bg-warning text-black"
                          : "bg-success-soft text-success"
                    : "bg-elevated text-fg-dim"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "risk" && <RiskPanel score={riskScore} />}
        {activeTab === "journal" && <JournalPanel />}
        {activeTab === "news" && <NewsPanel />}
        {activeTab === "copilot" && <CopilotPanel />}
      </div>
    </div>
  );
}

// RightPanel takes no props — memo insulates it from parent re-renders,
// leaving only its own store subscriptions (now field-level, see RiskPanel
// above) as re-render triggers.
export default memo(RightPanel);