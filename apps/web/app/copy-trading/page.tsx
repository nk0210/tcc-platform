"use client";
/**
 * TCC Copy Trading Page — /copy-trading
 *
 * Tabs:
 *   1. Discover Masters   — approved active masters only (no fake data)
 *   2. Active Copies      — user's copy relationships
 *   3. Copy History       — local copy events with safety results
 *   4. Apply as Master    — application form / status
 *   5. Admin Review       — role-gated admin actions
 *
 * Paper-copy mode ONLY. No real broker execution. Phase Alpha required for live copy.
 * NO FAKE MASTER TRADERS. NO FAKE WIN RATES. NO FAKE COPIED AMOUNTS.
 */
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useMasterRegistryStore,
  useCopyTradingStore,
  runCopySafetyChecks,
  type ApprovedMasterTrader,
  type CopyRelationship,
  type CopyRiskSettings,
  type CopySafetyCheckResult,
  type MasterTraderApplication,
  type NewsFilterImpactSetting,
  type NewsFilterBufferMinutes,
  DEFAULT_COPY_RISK_SETTINGS,
} from "@/store/copyTradingStore";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import { useJournalStore } from "@/store/journalStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useReportStore } from "@/store/reportStore";
import { useAdminActionLogStore } from "@/store/adminActionLogStore";
import { getEffectiveRole, isAdmin } from "@/lib/auth/roles";
import { TCC_SYMBOLS } from "@/lib/markets/symbols";
import { PAPER_INITIAL_BALANCE } from "@/lib/analytics/performance";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import ReportButton from "@/components/ReportButton";

// ── Helpers ───────────────────────────────────────────────────────────────

type CopyTab = "discover" | "active" | "history" | "apply" | "admin";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const trustScoreLabel: Record<string, string> = {
  unavailable:                "Trust score unavailable",
  insufficient_verified_data: "Insufficient verified data",
  calculating:                "Calculating...",
  available:                  "Available",
};

const appStatusColors: Record<string, string> = {
  draft:              "text-white/40 bg-white/5 border-white/10",
  submitted:          "text-blue-400 bg-blue-500/10 border-blue-500/20",
  under_review:       "text-amber-400 bg-amber-500/10 border-amber-500/20",
  approved:           "text-green-400 bg-green-500/10 border-green-500/20",
  rejected:           "text-red-400 bg-red-500/10 border-red-500/20",
  more_info_required: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  suspended:          "text-red-400 bg-red-500/10 border-red-500/20",
};

const appStatusIcons: Record<string, string> = {
  draft:              "📝",
  submitted:          "📬",
  under_review:       "🔍",
  approved:           "✅",
  rejected:           "❌",
  more_info_required: "❓",
  suspended:          "🚫",
};

function SafetyCheckRow({ check }: { check: CopySafetyCheckResult["checks"][0] }) {
  const icon = {
    passed:        "✅",
    warning:       "⚠️",
    failed:        "❌",
    not_available: "❔",
  }[check.status];
  const color = {
    passed:        "text-green-400",
    warning:       "text-amber-400",
    failed:        "text-red-400",
    not_available: "text-white/30",
  }[check.status];
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-sm shrink-0">{icon}</span>
      <div>
        <p className={`text-xs font-medium ${color}`}>{check.label}</p>
        <p className="text-white/30 text-xs">{check.message}</p>
      </div>
    </div>
  );
}

// ── Risk Settings Form ─────────────────────────────────────────────────────

function RiskSettingsForm({
  settings,
  onChange,
}: {
  settings: CopyRiskSettings;
  onChange: (s: CopyRiskSettings) => void;
}) {
  const num = (val: number, min: number, max: number, step: number, key: keyof CopyRiskSettings) => (
    <div key={key}>
      <div className="flex justify-between mb-1">
        <span className="text-white/40 text-xs capitalize">{String(key).replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</span>
        <span className="text-white/60 text-xs font-semibold">{val}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={val}
        onChange={e => onChange({ ...settings, [key]: parseFloat(e.target.value) })}
        className="w-full accent-green-400" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {num(settings.maxRiskPerTradePercent, 0.1, 5, 0.1, "maxRiskPerTradePercent")}
        {num(settings.maxDailyLossPercent, 0.5, 10, 0.5, "maxDailyLossPercent")}
        {num(settings.maxTotalDrawdownPercent, 1, 30, 1, "maxTotalDrawdownPercent")}
        {num(settings.maxOpenCopiedTrades, 1, 10, 1, "maxOpenCopiedTrades")}
      </div>

      <div>
        <p className="text-white/40 text-xs mb-2">Copy Lot Mode</p>
        <div className="flex gap-2">
          {(["fixed_lot","risk_multiplier","equity_ratio"] as const).map(mode => (
            <button key={mode}
              onClick={() => onChange({ ...settings, copyLotMode: mode })}
              className={`flex-1 py-1.5 rounded-lg text-xs border transition ${settings.copyLotMode === mode ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
              {mode.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {settings.copyLotMode === "fixed_lot" && num(settings.fixedLotSize, 0.01, 1, 0.01, "fixedLotSize")}
      {settings.copyLotMode === "risk_multiplier" && num(settings.riskMultiplier, 0.1, 5, 0.1, "riskMultiplier")}

      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.requireStopLoss}
            onChange={e => onChange({ ...settings, requireStopLoss: e.target.checked })}
            className="accent-green-400" />
          <span className="text-white/60 text-xs">Require stop loss on all copied trades</span>
        </label>
      </div>

      <div className="flex gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.newsFilterEnabled}
            onChange={e => onChange({ ...settings, newsFilterEnabled: e.target.checked })}
            className="accent-green-400" />
          <span className="text-white/60 text-xs">News filter (economic calendar — not connected yet)</span>
        </label>
      </div>

      {settings.newsFilterEnabled && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
          <p className="text-amber-400/70 text-xs">
            News filter rules saved locally. Live economic calendar integration not connected.
            Trades will pass the news filter check until Phase Alpha connects a real calendar API.
          </p>
        </div>
      )}

      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
        <p className="text-blue-400/60 text-xs">
          <strong>Slippage:</strong> Max {settings.maxSlippagePoints} points.
          Slippage enforcement requires live broker data (Phase Alpha).
        </p>
      </div>
    </div>
  );
}

// ── Copy Setup Modal ───────────────────────────────────────────────────────

function CopySetupModal({
  master,
  followerUserId,
  onClose,
  onStart,
}: {
  master: ApprovedMasterTrader;
  followerUserId: string;
  onClose: () => void;
  onStart: (settings: CopyRiskSettings) => void;
}) {
  const [riskSettings, setRiskSettings] = useState<CopyRiskSettings>({ ...DEFAULT_COPY_RISK_SETTINGS });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111217] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold">Start Paper-Copy</h2>
            <p className="text-white/40 text-xs mt-0.5">{master.displayName} · {master.tccId}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl w-7 h-7 flex items-center justify-center">✕</button>
        </div>

        {/* Master info */}
        <div className="glass border border-white/5 rounded-xl p-4 mb-5">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">✓ Approved</span>
            <span className="text-xs text-amber-400/60 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-full">
              Trust: {trustScoreLabel[master.trustScoreStatus]}
            </span>
          </div>
          <p className="text-white/50 text-xs">Markets: {master.marketsTraded.join(", ") || "Not specified"}</p>
          <p className="text-white/50 text-xs mt-0.5">Strategies: {master.strategiesUsed.join(", ") || "Not specified"}</p>
          <p className="text-white/30 text-xs mt-1">
            Broker: Same broker required for live copy. Paper-copy available without broker connection.
          </p>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-5">
          <p className="text-amber-400/80 text-xs font-semibold mb-1">⚠ Paper-Copy Mode Only</p>
          <p className="text-white/40 text-xs leading-relaxed">
            No real broker orders will be placed. This is a local simulation for paper trading practice only.
            Live copy trading requires broker API integration (Phase Alpha).
          </p>
        </div>

        {step === 1 && (
          <>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Risk Settings</p>
            <RiskSettingsForm settings={riskSettings} onChange={setRiskSettings} />
            <button onClick={() => setStep(2)}
              className="w-full mt-5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-2.5 rounded-xl text-sm font-semibold transition">
              Next — Confirm Terms →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Terms & Confirmation</p>
            <div className="flex flex-col gap-3 mb-5">
              {[
                "I understand this is paper-copy mode only — no real money is involved.",
                "I understand copy trading involves risk and past paper results do not predict real performance.",
                "I understand the master trader has been approved locally and their performance is not independently verified.",
                "I will not hold TCC or The Cane & Co. liable for any decisions made based on copy trading.",
              ].map((term, i) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-0.5 accent-green-400 shrink-0" />
                  <p className="text-white/50 text-xs leading-relaxed">{term}</p>
                </label>
              ))}
            </div>

            <div className="glass border border-white/5 rounded-xl p-4 mb-4 text-xs text-white/40">
              <p className="font-semibold text-white/60 mb-2">Fee model (Phase Alpha placeholder)</p>
              <p>Performance fee: 0% — Fee engine foundation only. Payments not connected.</p>
              <p className="mt-1">High-Water Mark (HWM) logic will apply when payment system is connected.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-white/5 text-white/40 border border-white/10 py-2.5 rounded-xl text-sm transition">← Back</button>
              <button
                onClick={() => acceptedTerms && onStart(riskSettings)}
                disabled={!acceptedTerms}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40">
                ✓ Start Paper-Copy
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Simulate Copy Modal ───────────────────────────────────────────────────

function SimulateCopyModal({
  relationship,
  followerBalance,
  followerUserId,
  onClose,
}: {
  relationship: CopyRelationship;
  followerBalance: number;
  followerUserId: string;
  onClose: () => void;
}) {
  const { getMasterById, getActiveMasters } = useMasterRegistryStore();
  const { executePaperCopy, recordBlockedCopy, getOpenCopiedTradeCount } = useCopyTradingStore();
  const { addNotification } = useNotificationStore();

  const allSymbols = TCC_SYMBOLS.slice(0, 12); // crypto only for simulation
  const [symbol, setSymbol]       = useState(allSymbols[0].id);
  const [side, setSide]           = useState<"BUY" | "SELL">("BUY");
  const [lotSize, setLotSize]     = useState("0.01");
  const [hasStopLoss, setHasSL]   = useState(true);
  const [result, setResult]       = useState<ReturnType<typeof runCopySafetyChecks> | null>(null);

  const selectedSymbol = allSymbols.find(s => s.id === symbol) ?? allSymbols[0];

  const handleSimulate = () => {
    const master = getMasterById(relationship.masterTraderId);
    const openCount = getOpenCopiedTradeCount(relationship.id);
    const checks = runCopySafetyChecks({
      relationship,
      masterTrader: master ?? null,
      followerBalance,
      currentOpenCopiedTrades: openCount,
      todayLossAmount: 0,
      proposedLotSize: parseFloat(lotSize) || 0,
      hasStopLoss,
      currentDrawdownPercent: Math.max(0, ((PAPER_INITIAL_BALANCE - followerBalance) / PAPER_INITIAL_BALANCE) * 100),
    });
    setResult(checks);
    if (checks.canCopy) {
      executePaperCopy({
        relationshipId:       relationship.id,
        masterTraderUserId:   relationship.masterTraderUserId,
        masterDisplayName:    relationship.masterDisplayName,
        followerUserId,
        symbol:               selectedSymbol.id,
        displayName:          selectedSymbol.displayName,
        side,
        lotSize:              parseFloat(lotSize) || 0.01,
        entryPrice:           0, // simulation — no live price required
        safetyResult:         checks,
      });
      addNotification({
        type:     "copy_trade",
        priority: "low",
        title:    `📡 Paper Copy Simulated — ${selectedSymbol.displayName}`,
        message:  `${side} ${lotSize} lots · Paper-copy mode · No real order placed.`,
        action:   { label: "View History", path: "/copy-trading" },
      });
    } else {
      recordBlockedCopy({
        relationshipId:       relationship.id,
        masterTraderUserId:   relationship.masterTraderUserId,
        masterDisplayName:    relationship.masterDisplayName,
        followerUserId,
        symbol:               selectedSymbol.id,
        displayName:          selectedSymbol.displayName,
        side,
        lotSize:              parseFloat(lotSize) || 0.01,
        entryPrice:           0,
        reason:               checks.checks.find(c => c.status === "failed")?.message ?? "Safety check failed",
        safetyResult:         checks,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111217] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold">Test Copy Signal</h2>
            <p className="text-white/40 text-xs mt-0.5">Simulates a paper-copy trade signal from {relationship.masterDisplayName}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl">✕</button>
        </div>

        {!result ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-white/40 text-xs mb-1">Symbol</p>
              <select value={symbol} onChange={e => setSymbol(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                {allSymbols.map(s => (
                  <option key={s.id} value={s.id} className="bg-[#0a0a0f]">{s.displayName}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSide("BUY")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${side === "BUY" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>BUY</button>
              <button onClick={() => setSide("SELL")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition ${side === "SELL" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>SELL</button>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Lot Size</p>
              <input value={lotSize} onChange={e => setLotSize(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm text-center" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasStopLoss} onChange={e => setHasSL(e.target.checked)} className="accent-green-400" />
              <span className="text-white/50 text-xs">Trade has stop loss</span>
            </label>
            <button onClick={handleSimulate}
              className="w-full bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/30 py-2.5 rounded-xl text-sm font-semibold transition">
              🧪 Run Safety Checks
            </button>
          </div>
        ) : (
          <div>
            <div className={`flex items-center gap-3 p-3 rounded-xl border mb-4 ${result.canCopy ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
              <span className="text-2xl">{result.canCopy ? "✅" : "❌"}</span>
              <div>
                <p className={`font-bold text-sm ${result.canCopy ? "text-green-400" : "text-red-400"}`}>
                  {result.canCopy ? "Paper copy executed successfully" : "Copy blocked by safety checks"}
                </p>
                <p className="text-white/30 text-xs mt-0.5">Paper-copy only — no real order placed</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 mb-4">
              {result.checks.map(c => <SafetyCheckRow key={c.id} check={c} />)}
            </div>
            <button onClick={onClose}
              className="w-full bg-white/5 text-white/50 border border-white/10 py-2.5 rounded-xl text-sm transition">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Application Form ───────────────────────────────────────────────────────

function ApplicationForm({ userId, tccId, displayName }: { userId: string; tccId: string; displayName: string }) {
  const { submitApplication, myApplication } = useCopyTradingStore();
  const { addNotification } = useNotificationStore();

  const [form, setForm] = useState({
    marketsTraded:           myApplication?.marketsTraded.join(", ") ?? "",
    strategiesUsed:          myApplication?.strategiesUsed.join(", ") ?? "",
    experienceSummary:       myApplication?.experienceSummary ?? "",
    riskManagementSummary:   myApplication?.riskManagementSummary ?? "",
    reasonForApplying:       myApplication?.reasonForApplying ?? "",
  });
  const [terms, setTerms] = useState({
    risk:        false,
    performance: false,
    copyTerms:   false,
  });
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = form.marketsTraded.trim() &&
    form.experienceSummary.trim() &&
    form.riskManagementSummary.trim() &&
    form.reasonForApplying.trim() &&
    terms.risk && terms.performance && terms.copyTerms;

  const handleSubmit = () => {
    if (!canSubmit) return;
    submitApplication({
      userId, tccId, displayName,
      marketsTraded:   form.marketsTraded.split(",").map(s => s.trim()).filter(Boolean),
      strategiesUsed:  form.strategiesUsed.split(",").map(s => s.trim()).filter(Boolean),
      experienceSummary:      form.experienceSummary,
      riskManagementSummary:  form.riskManagementSummary,
      reasonForApplying:      form.reasonForApplying,
      hasAcceptedRiskDisclosure:         terms.risk,
      hasAcceptedPerformanceTruthPolicy: terms.performance,
      hasAcceptedCopyTradingTerms:       terms.copyTerms,
    });
    addNotification({
      type: "system", priority: "medium",
      title: "📬 Master Trader Application Submitted",
      message: "Your application has been submitted. The TCC admin team will review it.",
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="glass border border-green-500/20 bg-green-500/5 rounded-xl p-6 text-center">
        <p className="text-3xl mb-3">📬</p>
        <p className="text-green-400 font-semibold">Application Submitted</p>
        <p className="text-white/40 text-xs mt-2">The TCC admin team will review your application. You'll be notified of any updates.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass border border-amber-500/15 bg-amber-500/3 rounded-xl p-4">
        <p className="text-amber-400/80 text-xs font-semibold mb-1">⚠ Important</p>
        <p className="text-white/40 text-xs leading-relaxed">
          Do not claim fake performance numbers. All master trader profiles must comply with TCC's
          performance honesty policy. Approved master traders will be clearly labeled with their
          verification status. Performance verification requires Phase Alpha backend integration.
        </p>
      </div>

      <div>
        <p className="text-white/40 text-xs mb-1">Markets Traded <span className="text-white/20">(comma separated) *</span></p>
        <input value={form.marketsTraded} onChange={e => setForm({ ...form, marketsTraded: e.target.value })}
          placeholder="e.g. Crypto, Forex, Gold"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
      </div>

      <div>
        <p className="text-white/40 text-xs mb-1">Strategies Used <span className="text-white/20">(comma separated)</span></p>
        <input value={form.strategiesUsed} onChange={e => setForm({ ...form, strategiesUsed: e.target.value })}
          placeholder="e.g. SMC, Price Action, EMA Crossover"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
      </div>

      <div>
        <p className="text-white/40 text-xs mb-1">Trading Experience Summary *</p>
        <textarea value={form.experienceSummary} rows={3}
          onChange={e => setForm({ ...form, experienceSummary: e.target.value })}
          placeholder="Briefly describe your trading background, how long you've been trading, what you specialise in..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-white/25 placeholder-white/20" />
      </div>

      <div>
        <p className="text-white/40 text-xs mb-1">Risk Management Approach *</p>
        <textarea value={form.riskManagementSummary} rows={3}
          onChange={e => setForm({ ...form, riskManagementSummary: e.target.value })}
          placeholder="How do you manage risk? What is your typical risk per trade? How do you protect your account?"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-white/25 placeholder-white/20" />
      </div>

      <div>
        <p className="text-white/40 text-xs mb-1">Why do you want to become a master trader? *</p>
        <textarea value={form.reasonForApplying} rows={3}
          onChange={e => setForm({ ...form, reasonForApplying: e.target.value })}
          placeholder="Why are you applying? What value do you bring to TCC followers?"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-white/25 placeholder-white/20" />
      </div>

      <div className="glass border border-white/5 rounded-xl p-4">
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Terms & Policies</p>
        {[
          { key: "risk" as const, text: "I have read and accept the Copy Trading Risk Disclosure. I understand that copy trading involves financial risk and followers may incur losses." },
          { key: "performance" as const, text: "I accept the Performance Honesty Policy. I will NOT claim fake verified performance, fabricated win rates, or misleading returns. My profile will be labeled based on what is actually verifiable." },
          { key: "copyTerms" as const, text: "I accept the TCC Copy Trading Master Trader Terms. I understand that my trading activity may be replicated by followers in paper-copy mode." },
        ].map(item => (
          <label key={item.key} className="flex items-start gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={terms[item.key]} onChange={e => setTerms({ ...terms, [item.key]: e.target.checked })} className="mt-0.5 accent-green-400 shrink-0" />
            <p className="text-white/50 text-xs leading-relaxed">{item.text}</p>
          </label>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={!canSubmit}
        className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40">
        Submit Application
      </button>

      <p className="text-white/15 text-xs leading-relaxed text-center">
        Applications are reviewed manually by TCC admin. Approval does not constitute endorsement of
        performance. Local/prototype approval only — Phase Alpha requires verified broker data.
      </p>
    </div>
  );
}

// ── Application Status Card ────────────────────────────────────────────────

function ApplicationStatusCard({ app }: { app: MasterTraderApplication }) {
  const { resubmitApplication } = useCopyTradingStore();

  const statusColor = appStatusColors[app.status] ?? appStatusColors.draft;
  const statusIcon  = appStatusIcons[app.status] ?? "📝";

  return (
    <div className="flex flex-col gap-4">
      <div className={`glass border rounded-xl p-5 ${statusColor}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{statusIcon}</span>
          <div>
            <p className="text-white font-semibold text-sm capitalize">
              Status: {app.status.replace(/_/g, " ")}
            </p>
            <p className="text-white/30 text-xs mt-0.5">
              Submitted: {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {app.status === "submitted" && (
          <p className="text-blue-400/80 text-xs">Your application has been submitted and is awaiting admin review.</p>
        )}
        {app.status === "under_review" && (
          <p className="text-amber-400/80 text-xs">Your application is currently under review by the TCC team.</p>
        )}
        {app.status === "approved" && (
          <p className="text-green-400/80 text-xs">🎉 Congratulations! Your application has been approved. You are now a master trader.</p>
        )}
        {app.status === "rejected" && (
          <div>
            <p className="text-red-400/80 text-xs mb-2">Your application was rejected.</p>
            {app.rejectionReason && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2">
                <p className="text-white/40 text-xs">Reason: {app.rejectionReason}</p>
              </div>
            )}
            <button onClick={resubmitApplication}
              className="mt-3 bg-white/5 text-white/60 border border-white/10 px-4 py-2 rounded-lg text-xs font-semibold hover:bg-white/10 transition">
              Submit New Application
            </button>
          </div>
        )}
        {app.status === "more_info_required" && (
          <div>
            <p className="text-orange-400/80 text-xs mb-2">Admin has requested more information.</p>
            {app.moreInfoRequest && (
              <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-2">
                <p className="text-white/40 text-xs">{app.moreInfoRequest}</p>
              </div>
            )}
          </div>
        )}
        {app.status === "suspended" && (
          <div>
            <p className="text-red-400/80 text-xs mb-2">Your master trader status has been suspended.</p>
            {app.adminNotes && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2">
                <p className="text-white/40 text-xs">{app.adminNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Application details */}
      <div className="glass border border-white/5 rounded-xl p-5">
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Application Details</p>
        <div className="flex flex-col gap-2 text-xs">
          <div><span className="text-white/30">TCC ID</span> <span className="text-white/60 font-mono ml-2">{app.tccId}</span></div>
          <div><span className="text-white/30">Markets</span> <span className="text-white/60 ml-2">{app.marketsTraded.join(", ") || "—"}</span></div>
          <div><span className="text-white/30">Strategies</span> <span className="text-white/60 ml-2">{app.strategiesUsed.join(", ") || "—"}</span></div>
          <div className="mt-1"><span className="text-white/30">Experience</span><p className="text-white/50 mt-1 leading-relaxed">{app.experienceSummary || "—"}</p></div>
        </div>
      </div>
    </div>
  );
}

// ── Master Trader Card ─────────────────────────────────────────────────────

function MasterTraderCard({
  master,
  existingRelationship,
  onStartCopy,
}: {
  master: ApprovedMasterTrader;
  existingRelationship: CopyRelationship | undefined;
  onStartCopy: () => void;
}) {
  return (
    <div className="glass border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xl font-bold shrink-0">
            {master.displayName[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-white font-semibold">{master.displayName}</p>
            <p className="text-green-400/60 font-mono text-xs">{master.tccId}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">✓ Approved</span>
              {master.status !== "active" && (
                <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full capitalize">{master.status}</span>
              )}
            </div>
          </div>
        </div>
        <ReportButton
          reportedItemType="master_trader"
          reportedItemId={master.id}
          reportedItemTitle={`${master.displayName} (${master.tccId})`}
          reportedUserId={master.userId}
          sourceFeature="Copy Trading Discovery"
          compact
        />
      </div>

      <div className="flex flex-col gap-2 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-white/30 w-24 shrink-0">Markets</span>
          <span className="text-white/60">{master.marketsTraded.join(", ") || "Not specified"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 w-24 shrink-0">Strategies</span>
          <span className="text-white/60">{master.strategiesUsed.join(", ") || "Not specified"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 w-24 shrink-0">Trust Score</span>
          <span className="text-amber-400/60">{trustScoreLabel[master.trustScoreStatus]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 w-24 shrink-0">Broker</span>
          <span className="text-white/30 italic">
            {master.brokerCompatibility.status === "not_connected"
              ? "Broker API not connected — paper-copy available"
              : master.brokerCompatibility.requiredBrokerName ?? "Same broker required"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 w-24 shrink-0">Performance</span>
          <span className="text-white/30 italic">No verified data — local approval only</span>
        </div>
      </div>

      {/* Honest disclaimer */}
      <div className="bg-amber-500/3 border border-amber-500/10 rounded-lg p-2 mb-4">
        <p className="text-amber-400/50 text-xs">
          ⚠ Performance not verified. Approved locally. Paper-copy only. Not financial advice.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-white/20 text-xs">Approved {timeAgo(master.approvedAt)}</span>
        {existingRelationship ? (
          <span className={`text-xs px-3 py-1 rounded-lg border ${
            existingRelationship.status === "active" ? "text-green-400 bg-green-500/10 border-green-500/20"
            : existingRelationship.status === "paused" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
            : "text-white/30 bg-white/5 border-white/10"
          }`}>
            {existingRelationship.status === "active" ? "📡 Copying" : existingRelationship.status === "paused" ? "⏸ Paused" : "⬜ Stopped"}
          </span>
        ) : (
          <button onClick={onStartCopy}
            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-4 py-1.5 rounded-lg text-xs font-semibold transition">
            + Start Paper-Copy
          </button>
        )}
      </div>
    </div>
  );
}

// ── Relationship Card ──────────────────────────────────────────────────────

function RelationshipCard({
  rel,
  balance,
  userId,
}: {
  rel: CopyRelationship;
  balance: number;
  userId: string;
}) {
  const { pauseRelationship, resumeRelationship, stopRelationship } = useCopyTradingStore();
  const { addNotification } = useNotificationStore();
  const [showSimulate, setShowSimulate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { updateRiskSettings } = useCopyTradingStore();
  const [editedSettings, setEditedSettings] = useState<CopyRiskSettings>({ ...rel.riskSettings });
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const handlePause = () => {
    pauseRelationship(rel.id);
    addNotification({ type: "copy_trade", priority: "medium", title: `⏸ Copy Paused — ${rel.masterDisplayName}`, message: "Paper-copy relationship paused." });
  };
  const handleResume = () => {
    resumeRelationship(rel.id);
    addNotification({ type: "copy_trade", priority: "low", title: `▶ Copy Resumed — ${rel.masterDisplayName}`, message: "Paper-copy relationship resumed." });
  };
  const handleStop = () => {
    stopRelationship(rel.id, "Stopped by user");
    addNotification({ type: "copy_trade", priority: "medium", title: `⬜ Copy Stopped — ${rel.masterDisplayName}`, message: "Paper-copy relationship stopped." });
    setShowStopConfirm(false);
  };

  return (
    <div className={`glass border rounded-xl p-5 ${rel.status === "active" ? "border-green-500/15" : rel.status === "paused" ? "border-amber-500/15" : "border-white/5"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 font-bold shrink-0">
            {rel.masterDisplayName[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-white font-semibold">{rel.masterDisplayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                rel.status === "active" ? "text-green-400 bg-green-500/10 border-green-500/20"
                : rel.status === "paused" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-white/30 bg-white/5 border-white/10"
              }`}>
                {rel.status === "active" ? "🟢 Active" : rel.status === "paused" ? "⏸ Paused" : `⬜ ${rel.status}`}
              </span>
              <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                Paper-Copy Only
              </span>
            </div>
          </div>
        </div>
        <ReportButton
          reportedItemType="copy_trade"
          reportedItemId={rel.id}
          reportedItemTitle={`Copy relationship with ${rel.masterDisplayName}`}
          reportedUserId={rel.masterTraderUserId}
          sourceFeature="Active Copy Trading"
          compact
        />
      </div>

      {/* Risk settings summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        {[
          { label: "Risk/trade", val: `${rel.riskSettings.maxRiskPerTradePercent}%` },
          { label: "Daily loss", val: `${rel.riskSettings.maxDailyLossPercent}%` },
          { label: "Max DD",      val: `${rel.riskSettings.maxTotalDrawdownPercent}%` },
          { label: "Max trades",  val: rel.riskSettings.maxOpenCopiedTrades },
          { label: "Lot mode",    val: rel.riskSettings.copyLotMode.replace(/_/g," ") },
          { label: "SL required", val: rel.riskSettings.requireStopLoss ? "Yes" : "No" },
        ].map(item => (
          <div key={item.label} className="glass border border-white/5 rounded-lg p-2">
            <p className="text-white/30">{item.label}</p>
            <p className="text-white/70 font-medium capitalize">{item.val}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {rel.status === "active" && (
          <>
            <button onClick={handlePause}
              className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition">
              ⏸ Pause
            </button>
            <button onClick={() => setShowSimulate(true)}
              className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-500/20 transition">
              🧪 Test Signal
            </button>
          </>
        )}
        {rel.status === "paused" && (
          <button onClick={handleResume}
            className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition">
            ▶ Resume
          </button>
        )}
        {rel.status !== "stopped" && (
          <>
            <button onClick={() => setShowSettings(true)}
              className="bg-white/5 text-white/50 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 transition">
              ⚙ Edit Risk
            </button>
            {!showStopConfirm ? (
              <button onClick={() => setShowStopConfirm(true)}
                className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition">
                ⬜ Stop
              </button>
            ) : (
              <>
                <button onClick={handleStop}
                  className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                  Confirm Stop
                </button>
                <button onClick={() => setShowStopConfirm(false)}
                  className="bg-white/5 text-white/40 border border-white/10 px-3 py-1.5 rounded-lg text-xs transition">
                  Cancel
                </button>
              </>
            )}
          </>
        )}
      </div>

      <p className="text-white/15 text-xs mt-3">Started {timeAgo(rel.startedAt)}</p>

      {/* Edit risk modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="bg-[#111217] border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Edit Risk Settings</h3>
              <button onClick={() => setShowSettings(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <RiskSettingsForm settings={editedSettings} onChange={setEditedSettings} />
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSettings(false)} className="flex-1 bg-white/5 text-white/40 border border-white/10 py-2.5 rounded-xl text-sm transition">Cancel</button>
              <button onClick={() => { updateRiskSettings(rel.id, editedSettings); setShowSettings(false); }}
                className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-2.5 rounded-xl text-sm font-semibold transition">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showSimulate && (
        <SimulateCopyModal
          relationship={rel}
          followerBalance={balance}
          followerUserId={userId}
          onClose={() => setShowSimulate(false)}
        />
      )}
    </div>
  );
}

// ── Admin Review Panel ─────────────────────────────────────────────────────

function AdminReviewPanel({ adminHandle }: { adminHandle: string }) {
  const { allApplications, approveApplication, rejectApplication, requestMoreInfo, suspendMaster, addAdminNote, markUnderReview, getActiveMasters } = useMasterRegistryStore();
  const { addNotification } = useNotificationStore();
  const { addLog } = useAdminActionLogStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionNote,  setActionNote]  = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = filterStatus === "all" ? allApplications : allApplications.filter(a => a.status === filterStatus);
  const selected = allApplications.find(a => a.id === selectedId);
  const activeMasters = getActiveMasters();

  const handleApprove = (appId: string, displayName: string) => {
    const master = approveApplication(appId, adminHandle);
    if (master) {
      addLog({
        actorUserId: adminHandle, actorHandle: adminHandle, actorRole: "admin",
        actionType: "copy_trading_approved",
        targetType: "copy_trading_application", targetId: appId,
        description: `Approved master trader application for ${displayName}`,
      });
      addNotification({ type: "system", priority: "high", title: `✅ Master Trader Approved`, message: `${displayName} has been approved as a master trader.` });
    }
    setSelectedId(null); setActionNote("");
  };

  const handleReject = (appId: string, displayName: string) => {
    if (!actionNote.trim()) { alert("Enter a rejection reason."); return; }
    rejectApplication(appId, adminHandle, actionNote);
    addLog({ actorUserId: adminHandle, actorHandle: adminHandle, actorRole: "admin", actionType: "copy_trading_rejected", targetType: "copy_trading_application", targetId: appId, description: `Rejected: ${actionNote}` });
    addNotification({ type: "system", priority: "medium", title: `❌ Application Rejected`, message: `${displayName}'s application was rejected.` });
    setSelectedId(null); setActionNote("");
  };

  const handleMoreInfo = (appId: string, displayName: string) => {
    if (!actionNote.trim()) { alert("Enter what information you need."); return; }
    requestMoreInfo(appId, adminHandle, actionNote);
    addNotification({ type: "system", priority: "medium", title: `❓ More Info Requested`, message: `More information requested from ${displayName}.` });
    setSelectedId(null); setActionNote("");
  };

  const handleSuspend = (masterId: string, displayName: string) => {
    if (!actionNote.trim()) { alert("Enter a suspension reason."); return; }
    suspendMaster(masterId, adminHandle, actionNote);
    addNotification({ type: "system", priority: "high", title: `🚫 Master Trader Suspended`, message: `${displayName} has been suspended.` });
    setSelectedId(null); setActionNote("");
  };

  return (
    <div className="flex gap-5">
      {/* Left: list */}
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-white/50 text-xs uppercase tracking-wider">Applications ({allApplications.length})</p>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs">
            <option value="all">All</option>
            {["submitted","under_review","more_info_required","approved","rejected","suspended"].map(s => (
              <option key={s} value={s} className="bg-[#0a0a0f] capitalize">{s.replace(/_/g," ")}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="glass border border-white/5 rounded-xl p-8 text-center">
            <p className="text-white/20 text-sm">No applications yet.</p>
          </div>
        ) : (
          filtered.map(app => (
            <div key={app.id}
              onClick={() => { setSelectedId(app.id); setActionNote(""); }}
              className={`glass border rounded-xl p-4 cursor-pointer transition ${selectedId === app.id ? "border-green-500/30 bg-green-500/3" : "border-white/5 hover:border-white/15"}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white font-semibold text-sm">{app.displayName}</p>
                  <p className="text-white/30 text-xs font-mono">{app.tccId}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${appStatusColors[app.status]}`}>
                  {appStatusIcons[app.status]} {app.status.replace(/_/g," ")}
                </span>
              </div>
              <p className="text-white/40 text-xs">{app.marketsTraded.join(", ") || "—"} · {app.submittedAt ? timeAgo(app.submittedAt) : "—"}</p>
            </div>
          ))
        )}

        {/* Approved masters */}
        {activeMasters.length > 0 && (
          <>
            <p className="text-white/40 text-xs uppercase tracking-wider mt-3">Active Masters ({activeMasters.length})</p>
            {activeMasters.map(m => (
              <div key={m.id} className="glass border border-green-500/10 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-semibold">{m.displayName}</p>
                    <p className="text-green-400/60 text-xs font-mono">{m.tccId}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Active</span>
                    <button onClick={() => { setSelectedId(`master_${m.id}`); setActionNote(""); }}
                      className="text-xs text-red-400/60 hover:text-red-400 bg-red-500/5 border border-red-500/10 px-2 py-0.5 rounded-full transition">
                      Suspend
                    </button>
                  </div>
                </div>
                {selectedId === `master_${m.id}` && (
                  <div className="mt-3">
                    <textarea value={actionNote} onChange={e => setActionNote(e.target.value)}
                      placeholder="Suspension reason..."
                      rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none mb-2" />
                    <button onClick={() => handleSuspend(m.id, m.displayName)}
                      className="w-full bg-red-500/20 text-red-400 border border-red-500/30 py-1.5 rounded-lg text-xs font-semibold">
                      Confirm Suspend
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Right: detail */}
      {selected && !String(selectedId).startsWith("master_") && (
        <div className="w-80 shrink-0">
          <div className="glass border border-white/10 rounded-xl p-5 sticky top-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold text-sm">{selected.displayName}</p>
              <button onClick={() => setSelectedId(null)} className="text-white/30 hover:text-white">✕</button>
            </div>
            <div className="flex flex-col gap-2 text-xs mb-4">
              {[
                { l: "TCC ID",      v: selected.tccId },
                { l: "Status",      v: selected.status.replace(/_/g," ") },
                { l: "Submitted",   v: selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : "—" },
                { l: "Markets",     v: selected.marketsTraded.join(", ") || "—" },
                { l: "Strategies",  v: selected.strategiesUsed.join(", ") || "—" },
                { l: "Accepted Risk", v: selected.hasAcceptedRiskDisclosure ? "✅ Yes" : "❌ No" },
                { l: "Honesty Policy",v: selected.hasAcceptedPerformanceTruthPolicy ? "✅ Yes" : "❌ No" },
                { l: "Copy Terms",   v: selected.hasAcceptedCopyTradingTerms ? "✅ Yes" : "❌ No" },
              ].map(item => (
                <div key={item.l} className="flex gap-2">
                  <span className="text-white/30 w-28 shrink-0">{item.l}</span>
                  <span className="text-white/60 capitalize">{item.v}</span>
                </div>
              ))}
            </div>

            {selected.experienceSummary && (
              <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-3">
                <p className="text-white/30 text-xs mb-1">Experience</p>
                <p className="text-white/50 text-xs leading-relaxed">{selected.experienceSummary}</p>
              </div>
            )}

            {selected.riskManagementSummary && (
              <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-4">
                <p className="text-white/30 text-xs mb-1">Risk Management</p>
                <p className="text-white/50 text-xs leading-relaxed">{selected.riskManagementSummary}</p>
              </div>
            )}

            {selected.adminNotes && (
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3 mb-3">
                <p className="text-indigo-400 text-xs font-semibold mb-1">Admin Note</p>
                <p className="text-white/50 text-xs">{selected.adminNotes}</p>
              </div>
            )}

            <textarea value={actionNote} onChange={e => setActionNote(e.target.value)}
              placeholder="Admin note / reason (required for reject/info)..."
              rows={3} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none mb-3" />

            {(selected.status === "submitted" || selected.status === "under_review" || selected.status === "more_info_required") && (
              <div className="flex flex-col gap-2">
                {selected.status !== "under_review" && (
                  <button onClick={() => markUnderReview(selected.id, adminHandle)}
                    className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 rounded-lg text-xs font-semibold">
                    🔍 Mark Under Review
                  </button>
                )}
                <button onClick={() => handleApprove(selected.id, selected.displayName)}
                  className="w-full bg-green-500/20 text-green-400 border border-green-500/30 py-2 rounded-lg text-xs font-semibold">
                  ✅ Approve
                </button>
                <button onClick={() => handleReject(selected.id, selected.displayName)}
                  className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-2 rounded-lg text-xs font-semibold">
                  ❌ Reject
                </button>
                <button onClick={() => handleMoreInfo(selected.id, selected.displayName)}
                  className="w-full bg-orange-500/10 text-orange-400 border border-orange-500/20 py-2 rounded-lg text-xs font-semibold">
                  ❓ Request More Info
                </button>
                <button onClick={() => { if (actionNote.trim()) addAdminNote(selected.id, actionNote); }}
                  className="w-full bg-white/5 text-white/40 border border-white/10 py-2 rounded-lg text-xs font-semibold">
                  📝 Add Note
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CopyTradingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { balance, equity, closedTrades } = useTradeStore();
  const { addNotification }  = useNotificationStore();

  const { getActiveMasters, getApplicationByUserId } = useMasterRegistryStore();
  const {
    myApplication, relationships, copyHistory,
    submitApplication, startCopyRelationship,
    getActiveRelationships, getRelationshipByMaster,
  } = useCopyTradingStore();

  const [activeTab, setActiveTab] = useState<CopyTab>("discover");
  const [copySetupMaster, setCopySetupMaster] = useState<ApprovedMasterTrader | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!user) router.push("/login"); }, [user, router]);

  if (!user) return null;

  const isAdminUser = mounted && isAdmin(getEffectiveRole(user.role));
  const activeMasters = getActiveMasters();
  const activeRelationships = getActiveRelationships();
  const globalApp = getApplicationByUserId(user.id);
  // Prefer local store's myApplication over global registry for the current user
  const myApp = myApplication ?? globalApp;

  const TABS: { key: CopyTab; label: string; count?: number }[] = [
    { key: "discover", label: "🔍 Discover",        count: activeMasters.length },
    { key: "active",   label: "⚡ Active Copies",   count: activeRelationships.length },
    { key: "history",  label: "📋 History",         count: copyHistory.length },
    { key: "apply",    label: "📝 Apply as Master"  },
    ...(isAdminUser ? [{ key: "admin" as CopyTab, label: "🔑 Admin Review" }] : []),
  ];

  const handleStartCopy = (settings: CopyRiskSettings) => {
    if (!copySetupMaster) return;
    const rel = startCopyRelationship({
      followerUserId:       user.id,
      masterTraderUserId:   copySetupMaster.userId,
      masterTraderId:       copySetupMaster.id,
      masterDisplayName:    copySetupMaster.displayName,
      mode:                 "paper_copy",
      riskSettings:         settings,
    });
    addNotification({
      type:     "copy_trade",
      priority: "medium",
      title:    `📡 Paper-Copy Started — ${copySetupMaster.displayName}`,
      message:  `Paper-copy relationship active. No real broker orders will be placed.`,
    });
    setCopySetupMaster(null);
    setActiveTab("active");
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">

          {/* Header */}
          <div className="glass border-b border-white/5 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">📡 Copy Trading</h1>
                <p className="text-white/30 text-xs mt-0.5">
                  Paper-copy mode only · No real broker execution · No fake master traders
                </p>
              </div>
              {user.tccId && (
                <div className="glass border border-white/10 rounded-xl px-4 py-2 text-right">
                  <p className="text-white/30 text-xs">Your TCC ID</p>
                  <p className="text-green-400 font-mono font-bold text-sm">{user.tccId}</p>
                </div>
              )}
            </div>
            {/* Tabs */}
            <div className="flex gap-0.5 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    activeTab === tab.key ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                  }`}>
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 text-white/30">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">

            {/* ══ DISCOVER ═══════════════════════════════════════════════ */}
            {activeTab === "discover" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Discover Master Traders</h2>
                  <p className="text-white/30 text-xs">
                    Locally approved master traders only. Performance is not verified or broker-connected.
                    Paper-copy mode only until Phase Alpha broker integration.
                  </p>
                </div>

                {activeMasters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-4xl">📡</p>
                    <p className="text-white/30 text-sm font-semibold">No approved master traders yet.</p>
                    <p className="text-white/15 text-xs text-center max-w-sm leading-relaxed">
                      Master traders are approved through the application process by TCC admin.
                      Be the first to apply using the "Apply as Master" tab.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeMasters.map(master => (
                      <MasterTraderCard
                        key={master.id}
                        master={master}
                        existingRelationship={getRelationshipByMaster(master.id)}
                        onStartCopy={() => setCopySetupMaster(master)}
                      />
                    ))}
                  </div>
                )}

                <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
                  <p className="text-white/20 text-xs leading-relaxed">
                    <strong className="text-white/30">Disclaimer:</strong>{" "}
                    All master traders shown here are locally approved. Performance data is not verified,
                    not broker-connected, and not audited. This is paper-copy mode only —
                    no real money is involved. All data is local to this browser. Phase Alpha will
                    require verified broker data and independent performance auditing.
                  </p>
                </div>
              </div>
            )}

            {/* ══ ACTIVE COPIES ══════════════════════════════════════════ */}
            {activeTab === "active" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Active Copy Relationships</h2>
                  <p className="text-white/30 text-xs">All paper-copy only. No real orders placed.</p>
                </div>
                {relationships.filter(r => r.status !== "stopped").length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-4xl">⚡</p>
                    <p className="text-white/30 text-sm">No active copy relationships yet.</p>
                    <button onClick={() => setActiveTab("discover")}
                      className="text-green-400/60 text-xs hover:text-green-400 transition">
                      Browse master traders →
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {relationships.filter(r => r.status !== "stopped").map(rel => (
                      <RelationshipCard key={rel.id} rel={rel} balance={balance} userId={user.id} />
                    ))}
                  </div>
                )}

                {relationships.filter(r => r.status === "stopped").length > 0 && (
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Stopped Relationships</p>
                    {relationships.filter(r => r.status === "stopped").map(rel => (
                      <div key={rel.id} className="glass border border-white/5 rounded-xl p-4 flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 font-bold text-sm">
                          {rel.masterDisplayName[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-white/40 text-sm">{rel.masterDisplayName}</p>
                          <p className="text-white/20 text-xs">
                            Stopped {rel.stoppedAt ? timeAgo(rel.stoppedAt) : "—"}
                            {rel.stopReason && ` · ${rel.stopReason}`}
                          </p>
                        </div>
                        <span className="text-xs text-white/20 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">Stopped</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══ HISTORY ══════════════════════════════════════════════════ */}
            {activeTab === "history" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Copy History</h2>
                  <p className="text-white/30 text-xs">Local paper-copy events only. No real trades.</p>
                </div>
                {copyHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-4xl">📋</p>
                    <p className="text-white/30 text-sm">No copy history yet.</p>
                    <p className="text-white/15 text-xs">Start a copy relationship and use "Test Signal" to create history.</p>
                  </div>
                ) : (
                  <div className="glass border border-white/5 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/5 bg-white/2">
                          <th className="text-left px-4 py-3 text-white/40">Master</th>
                          <th className="text-left px-4 py-3 text-white/40">Symbol</th>
                          <th className="text-left px-4 py-3 text-white/40">Side</th>
                          <th className="text-right px-4 py-3 text-white/40">Lots</th>
                          <th className="text-left px-4 py-3 text-white/40">Status</th>
                          <th className="text-left px-4 py-3 text-white/40">Mode</th>
                          <th className="text-left px-4 py-3 text-white/40">Reason / Note</th>
                          <th className="text-right px-4 py-3 text-white/40">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {copyHistory.map(item => (
                          <tr key={item.id} className="border-b border-white/5 hover:bg-white/2">
                            <td className="px-4 py-3 text-white/60">{item.masterDisplayName}</td>
                            <td className="px-4 py-3 text-white font-medium">{item.displayName}</td>
                            <td className={`px-4 py-3 font-semibold ${item.side === "BUY" ? "text-green-400" : "text-red-400"}`}>{item.side}</td>
                            <td className="px-4 py-3 text-right text-white/60">{item.lotSize}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                item.status === "copied_paper" ? "text-green-400 bg-green-500/10"
                                : item.status === "blocked" ? "text-red-400 bg-red-500/10"
                                : item.status === "skipped" ? "text-amber-400 bg-amber-500/10"
                                : "text-white/30 bg-white/5"
                              }`}>
                                {item.status === "copied_paper" ? "✓ Paper-Copied"
                                 : item.status === "blocked" ? "⛔ Blocked"
                                 : item.status === "skipped" ? "⏭ Skipped"
                                 : item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/30 italic text-xs">Paper-copy only</td>
                            <td className="px-4 py-3 text-white/30 text-xs max-w-[120px] truncate">{item.reason ?? "—"}</td>
                            <td className="px-4 py-3 text-right text-white/30">{timeAgo(item.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ══ APPLY ══════════════════════════════════════════════════ */}
            {activeTab === "apply" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Apply as Master Trader</h2>
                  <p className="text-white/30 text-xs">
                    Local application only. Admin review required. Approval does not guarantee performance or income.
                  </p>
                </div>

                {myApp && myApp.status !== "rejected" ? (
                  <ApplicationStatusCard app={myApp} />
                ) : (
                  <ApplicationForm
                    userId={user.id}
                    tccId={user.tccId ?? "TCC-GL-TRD-XXXXXXXX"}
                    displayName={user.handle ?? user.email}
                  />
                )}
              </div>
            )}

            {/* ══ ADMIN REVIEW ══════════════════════════════════════════ */}
            {activeTab === "admin" && isAdminUser && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Admin: Master Trader Applications</h2>
                  <p className="text-white/30 text-xs">Review applications. No fake approvals. No fake rejections.</p>
                </div>
                <AdminReviewPanel adminHandle={user.handle ?? "admin"} />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Copy setup modal */}
      {copySetupMaster && (
        <CopySetupModal
          master={copySetupMaster}
          followerUserId={user.id}
          onClose={() => setCopySetupMaster(null)}
          onStart={handleStartCopy}
        />
      )}
    </div>
  );
}