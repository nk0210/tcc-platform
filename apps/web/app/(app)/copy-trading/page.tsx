"use client";
/**
 * TCC Copy Trading Page — /copy-trading
 *
 * API-backed via copyTradingStore.ts (Phase Alpha Frontend Integration).
 *
 * Changes from the old local-only two-store design:
 *   - useMasterRegistryStore is gone — masters/applications come straight
 *     from the API via the single copyTradingStore.
 *   - Risk settings are flat fields on CopyRelationship now (rel.maxRiskPerTradePercent,
 *     not rel.riskSettings.maxRiskPerTradePercent).
 *   - Client-side safety-check simulation (runCopySafetyChecks / "Test Signal")
 *     has no backend equivalent — copy trades are recorded server-side only
 *     when a master actually opens a position (copyTradingService.recordCopyTrade,
 *     not wired to any route yet). That whole feature was removed; starting a
 *     copy relationship now just calls startCopying() and surfaces API errors
 *     instead of pre-validating locally.
 *   - Admin moderation (approve/reject/suspend) now lives entirely on
 *     /owner/copy-trading (API-backed there too) — the in-page "Admin Review"
 *     tab was replaced with a link to avoid duplicating that logic.
 *   - The application flow is create → update (fill in fields) → submit as
 *     three separate calls, matching the API. There's no "resubmit a
 *     rejected application" endpoint, so that action was removed.
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useCopyTradingStore,
  type MasterTrader,
  type CopyRelationship,
  type CopyRiskSettings,
  type MasterTraderApplication,
} from "@/store/copyTradingStore";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { isAdmin } from "@/lib/auth/roles";
import ReportButton from "@/components/ReportButton";

// ── Helpers ───────────────────────────────────────────────────────────────

type CopyTab = "discover" | "active" | "history" | "apply";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const TRUST_SCORE_LABEL: Record<string, string> = {
  unavailable:                "Unavailable",
  insufficient_verified_data: "Insufficient verified data",
  calculating:                "Calculating...",
  available:                  "Available",
};

const APP_STATUS_COLORS: Record<string, string> = {
  DRAFT:               "text-white/40 bg-white/5 border-white/10",
  SUBMITTED:           "text-blue-400 bg-blue-500/10 border-blue-500/20",
  UNDER_REVIEW:        "text-amber-400 bg-amber-500/10 border-amber-500/20",
  APPROVED:            "text-green-400 bg-green-500/10 border-green-500/20",
  REJECTED:            "text-red-400 bg-red-500/10 border-red-500/20",
  MORE_INFO_REQUIRED:  "text-orange-400 bg-orange-500/10 border-orange-500/20",
  SUSPENDED:           "text-red-400 bg-red-500/15 border-red-500/30",
};

const APP_STATUS_ICONS: Record<string, string> = {
  DRAFT: "📝", SUBMITTED: "📬", UNDER_REVIEW: "🔍",
  APPROVED: "✅", REJECTED: "❌", MORE_INFO_REQUIRED: "❓", SUSPENDED: "🚫",
};

const DEFAULT_RISK_SETTINGS: CopyRiskSettings = {
  maxRiskPerTradePercent: 1,
  maxDailyLossPercent: 3,
  maxTotalDrawdownPercent: 10,
  maxOpenCopiedTrades: 3,
  copyLotMode: "FIXED_LOT",
  fixedLotSize: 0.01,
  riskMultiplier: 1,
  maxSlippagePoints: 5,
  requireStopLoss: true,
  newsFilterEnabled: false,
};

// ── Risk Settings Form ─────────────────────────────────────────────────────

function RiskSettingsForm({
  settings,
  onChange,
}: {
  settings: CopyRiskSettings;
  onChange: (s: CopyRiskSettings) => void;
}) {
  const sliders: Array<{
    label: string;
    key: keyof CopyRiskSettings;
    min: number; max: number; step: number;
    suffix?: string;
  }> = [
    { label: "Max Risk per Trade", key: "maxRiskPerTradePercent", min: 0.1, max: 5, step: 0.1, suffix: "%" },
    { label: "Max Daily Loss", key: "maxDailyLossPercent", min: 0.5, max: 10, step: 0.5, suffix: "%" },
    { label: "Max Total Drawdown", key: "maxTotalDrawdownPercent", min: 1, max: 30, step: 1, suffix: "%" },
    { label: "Max Open Copied Trades", key: "maxOpenCopiedTrades", min: 1, max: 10, step: 1 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {sliders.map(s => (
          <div key={String(s.key)}>
            <div className="flex justify-between mb-1">
              <span className="text-white/40 text-xs">{s.label}</span>
              <span className="text-white/60 text-xs font-semibold">
                {settings[s.key] as number}{s.suffix ?? ""}
              </span>
            </div>
            <input type="range" min={s.min} max={s.max} step={s.step}
              value={settings[s.key] as number}
              onChange={e => onChange({ ...settings, [s.key]: parseFloat(e.target.value) })}
              className="w-full accent-green-400" />
          </div>
        ))}
      </div>

      <div>
        <p className="text-white/40 text-xs mb-2">Copy Lot Mode</p>
        <div className="flex gap-2">
          {(["FIXED_LOT", "RISK_MULTIPLIER", "EQUITY_RATIO"] as const).map(mode => (
            <button key={mode}
              onClick={() => onChange({ ...settings, copyLotMode: mode })}
              className={`flex-1 py-1.5 rounded-lg text-xs border transition ${
                settings.copyLotMode === mode
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
              }`}>
              {mode.toLowerCase().replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {settings.copyLotMode === "FIXED_LOT" && (
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/40 text-xs">Fixed Lot Size</span>
            <span className="text-white/60 text-xs">{settings.fixedLotSize}</span>
          </div>
          <input type="range" min={0.01} max={1} step={0.01} value={settings.fixedLotSize}
            onChange={e => onChange({ ...settings, fixedLotSize: parseFloat(e.target.value) })}
            className="w-full accent-green-400" />
        </div>
      )}

      {settings.copyLotMode === "RISK_MULTIPLIER" && (
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/40 text-xs">Risk Multiplier</span>
            <span className="text-white/60 text-xs">{settings.riskMultiplier}x</span>
          </div>
          <input type="range" min={0.1} max={5} step={0.1} value={settings.riskMultiplier}
            onChange={e => onChange({ ...settings, riskMultiplier: parseFloat(e.target.value) })}
            className="w-full accent-green-400" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.requireStopLoss}
            onChange={e => onChange({ ...settings, requireStopLoss: e.target.checked })}
            className="accent-green-400" />
          <span className="text-white/60 text-xs">Require stop loss on all copied trades</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={settings.newsFilterEnabled}
            onChange={e => onChange({ ...settings, newsFilterEnabled: e.target.checked })}
            className="accent-green-400" />
          <span className="text-white/60 text-xs">News filter (economic calendar not connected yet)</span>
        </label>
      </div>

      {settings.newsFilterEnabled && (
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
          <p className="text-amber-400/70 text-xs leading-relaxed">
            News filter rules saved. Live economic calendar not connected yet (Phase Alpha).
          </p>
        </div>
      )}

      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
        <p className="text-blue-400/60 text-xs">
          Slippage: Max {settings.maxSlippagePoints} pts.
          Enforcement requires live broker data (Phase Alpha).
        </p>
      </div>
    </div>
  );
}

// ── Copy Setup Modal ───────────────────────────────────────────────────────

function CopySetupModal({
  master,
  onClose,
  onStart,
}: {
  master: MasterTrader;
  onClose: () => void;
  onStart: (settings: CopyRiskSettings) => void;
}) {
  const [riskSettings, setRiskSettings] = useState<CopyRiskSettings>({ ...DEFAULT_RISK_SETTINGS });
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

        <div className="glass border border-white/5 rounded-xl p-4 mb-4">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">✓ Approved</span>
            <span className="text-xs text-amber-400/60 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-full">
              Trust: {TRUST_SCORE_LABEL[master.trustScoreStatus] ?? master.trustScoreStatus}
            </span>
          </div>
          <p className="text-white/50 text-xs">Markets: {master.marketsTraded.join(", ") || "Not specified"}</p>
          <p className="text-white/50 text-xs mt-0.5">Strategies: {master.strategiesUsed.join(", ") || "Not specified"}</p>
          <p className="text-white/30 text-xs mt-1">Broker: Paper-copy available. Same broker required for live copy (Phase Alpha).</p>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-5">
          <p className="text-amber-400/80 text-xs font-semibold mb-1">⚠ Paper-Copy Mode Only</p>
          <p className="text-white/40 text-xs leading-relaxed">
            No real broker orders will be placed. This is a paper trading simulation only.
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
                "I understand copy trading involves risk. Past paper results do not predict real performance.",
                "I understand the master trader is approved by TCC admin and performance is not independently verified.",
                "I will not hold TCC liable for decisions made based on copy trading.",
              ].map((term, i) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 accent-green-400 shrink-0" />
                  <p className="text-white/50 text-xs leading-relaxed">{term}</p>
                </label>
              ))}
            </div>

            <div className="glass border border-white/5 rounded-xl p-4 mb-4 text-xs text-white/40">
              <p className="font-semibold text-white/60 mb-1">Fee model (Phase Alpha placeholder)</p>
              <p>Performance fee: 0%. Fee engine foundation only. Payments not connected.</p>
              <p className="mt-1">High-Water Mark (HWM) logic will apply when payment system is connected.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)}
                className="flex-1 bg-white/5 text-white/40 border border-white/10 py-2.5 rounded-xl text-sm transition">
                ← Back
              </button>
              <button onClick={() => acceptedTerms && onStart(riskSettings)}
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

// ── Application Form ───────────────────────────────────────────────────────

function ApplicationForm() {
  const { myApplication, createApplication, updateApplication, submitApplication } = useCopyTradingStore();
  const { addNotification }   = useNotificationStore();

  const [form, setForm] = useState({
    marketsTraded:         "",
    strategiesUsed:        "",
    experienceSummary:     "",
    riskManagementSummary: "",
    reasonForApplying:     "",
  });
  const [terms, setTerms] = useState({ risk: false, performance: false, copyTerms: false });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    form.marketsTraded.trim() && form.experienceSummary.trim() &&
    form.riskManagementSummary.trim() && form.reasonForApplying.trim() &&
    terms.risk && terms.performance && terms.copyTerms;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    if (!myApplication) {
      const created = await createApplication();
      if (!created) { setSubmitting(false); return; }
    }

    await updateApplication({
      marketsTraded:  form.marketsTraded.split(",").map(s => s.trim()).filter(Boolean),
      strategiesUsed: form.strategiesUsed.split(",").map(s => s.trim()).filter(Boolean),
      experienceSummary:     form.experienceSummary,
      riskManagementSummary: form.riskManagementSummary,
      reasonForApplying:     form.reasonForApplying,
      hasAcceptedRiskDisclosure:         terms.risk,
      hasAcceptedPerformanceTruthPolicy: terms.performance,
      hasAcceptedCopyTradingTerms:       terms.copyTerms,
    });

    await submitApplication();
    setSubmitting(false);

    addNotification({
      type: "system", priority: "medium",
      title: "📬 Master Trader Application Submitted",
      message: "Your application has been submitted. TCC admin will review it.",
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="glass border border-green-500/20 bg-green-500/5 rounded-xl p-6 text-center">
        <p className="text-3xl mb-3">📬</p>
        <p className="text-green-400 font-semibold">Application Submitted</p>
        <p className="text-white/40 text-xs mt-2">The TCC admin team will review your application. You will be notified of updates.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass border border-amber-500/15 bg-amber-500/3 rounded-xl p-4">
        <p className="text-amber-400/80 text-xs font-semibold mb-1">⚠ Performance Honesty Policy</p>
        <p className="text-white/40 text-xs leading-relaxed">
          Do not claim fake performance numbers. All master trader profiles must comply with
          TCC's performance honesty policy. Performance verification requires Phase Alpha backend integration.
        </p>
      </div>

      {[
        { label: "Markets Traded * (comma separated)", key: "marketsTraded" as const, placeholder: "e.g. Crypto, Forex, Gold" },
        { label: "Strategies Used (comma separated)", key: "strategiesUsed" as const, placeholder: "e.g. SMC, Price Action, EMA Crossover" },
      ].map(f => (
        <div key={f.key}>
          <p className="text-white/40 text-xs mb-1">{f.label}</p>
          <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
        </div>
      ))}

      {[
        { label: "Trading Experience Summary *", key: "experienceSummary" as const, placeholder: "Briefly describe your trading background, how long you've been trading, what you specialise in..." },
        { label: "Risk Management Approach *", key: "riskManagementSummary" as const, placeholder: "How do you manage risk? What is your typical risk per trade?" },
        { label: "Why do you want to become a master trader? *", key: "reasonForApplying" as const, placeholder: "Why are you applying? What value do you bring to TCC followers?" },
      ].map(f => (
        <div key={f.key}>
          <p className="text-white/40 text-xs mb-1">{f.label}</p>
          <textarea value={form[f.key]} rows={3}
            onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-white/25 placeholder-white/20" />
        </div>
      ))}

      <div className="glass border border-white/5 rounded-xl p-4">
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Terms & Policies</p>
        {[
          { key: "risk" as const, text: "I accept the Copy Trading Risk Disclosure. I understand copy trading involves financial risk and followers may incur losses." },
          { key: "performance" as const, text: "I accept the Performance Honesty Policy. I will NOT claim fake verified performance, fabricated win rates, or misleading returns." },
          { key: "copyTerms" as const, text: "I accept the TCC Copy Trading Master Trader Terms. My trading activity may be replicated by followers in paper-copy mode." },
        ].map(item => (
          <label key={item.key} className="flex items-start gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={terms[item.key]}
              onChange={e => setTerms({ ...terms, [item.key]: e.target.checked })}
              className="mt-0.5 accent-green-400 shrink-0" />
            <p className="text-white/50 text-xs leading-relaxed">{item.text}</p>
          </label>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={!canSubmit || submitting}
        className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40">
        {submitting ? "Submitting..." : "Submit Application"}
      </button>

      <p className="text-white/15 text-xs text-center leading-relaxed">
        Applications reviewed manually by TCC admin. Approval does not guarantee performance.
        Phase Alpha requires verified broker data.
      </p>
    </div>
  );
}

// ── Application Status ─────────────────────────────────────────────────────

function ApplicationStatusCard({ app }: { app: MasterTraderApplication }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={`glass border rounded-xl p-5 ${APP_STATUS_COLORS[app.status] ?? APP_STATUS_COLORS.DRAFT}`}>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{APP_STATUS_ICONS[app.status] ?? "📝"}</span>
          <div>
            <p className="text-white font-semibold text-sm capitalize">
              Status: {app.status.toLowerCase().replace(/_/g, " ")}
            </p>
            <p className="text-white/30 text-xs mt-0.5">
              Submitted: {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {app.status === "SUBMITTED"          && <p className="text-blue-400/80 text-xs">Your application is awaiting admin review.</p>}
        {app.status === "UNDER_REVIEW"       && <p className="text-amber-400/80 text-xs">Your application is currently under review by the TCC team.</p>}
        {app.status === "APPROVED"           && <p className="text-green-400/80 text-xs">🎉 Congratulations! Your application has been approved.</p>}
        {app.status === "SUSPENDED"          && <p className="text-red-400/80 text-xs">Your master trader status has been suspended. {app.adminNotes && `Reason: ${app.adminNotes}`}</p>}
        {app.status === "MORE_INFO_REQUIRED" && (
          <div>
            <p className="text-orange-400/80 text-xs mb-2">Admin has requested more information.</p>
            {app.moreInfoRequest && <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-2"><p className="text-white/40 text-xs">{app.moreInfoRequest}</p></div>}
          </div>
        )}
        {app.status === "REJECTED" && (
          <div>
            <p className="text-red-400/80 text-xs mb-2">Your application was rejected.</p>
            {app.rejectionReason && <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-2"><p className="text-white/40 text-xs">Reason: {app.rejectionReason}</p></div>}
            <p className="text-white/20 text-xs">Resubmission isn't available yet — contact support if you'd like to reapply.</p>
          </div>
        )}
      </div>

      <div className="glass border border-white/5 rounded-xl p-5">
        <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Your Application Details</p>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex gap-2"><span className="text-white/30 w-24">TCC ID</span><span className="text-white/60 font-mono">{app.tccId}</span></div>
          <div className="flex gap-2"><span className="text-white/30 w-24">Markets</span><span className="text-white/60">{app.marketsTraded.join(", ") || "—"}</span></div>
          <div className="flex gap-2"><span className="text-white/30 w-24">Strategies</span><span className="text-white/60">{app.strategiesUsed.join(", ") || "—"}</span></div>
          {app.experienceSummary && (
            <div className="mt-1"><span className="text-white/30">Experience</span><p className="text-white/50 mt-1 leading-relaxed text-xs">{app.experienceSummary}</p></div>
          )}
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
  master: MasterTrader;
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
              {master.status !== "ACTIVE" && (
                <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full capitalize">{master.status.toLowerCase()}</span>
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

      <div className="flex flex-col gap-1.5 mb-4 text-xs">
        {[
          { l: "Markets",     v: master.marketsTraded.join(", ") || "Not specified" },
          { l: "Strategies",  v: master.strategiesUsed.join(", ") || "Not specified" },
          { l: "Trust Score", v: TRUST_SCORE_LABEL[master.trustScoreStatus] ?? master.trustScoreStatus, color: "text-amber-400/60" },
          { l: "Broker",      v: "Broker API not connected — paper-copy available", color: "text-white/30 italic" },
          { l: "Performance", v: "Not verified — locally approved only",            color: "text-white/30 italic" },
        ].map(item => (
          <div key={item.l} className="flex items-start gap-2">
            <span className="text-white/30 w-24 shrink-0">{item.l}</span>
            <span className={item.color ?? "text-white/60"}>{item.v}</span>
          </div>
        ))}
      </div>

      <div className="bg-amber-500/3 border border-amber-500/10 rounded-lg p-2 mb-4">
        <p className="text-amber-400/50 text-xs">⚠ Performance not verified. Approved by TCC admin. Paper-copy only. Not financial advice.</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-white/20 text-xs">Approved {timeAgo(master.approvedAt)}</span>
        {existingRelationship ? (
          <span className={`text-xs px-3 py-1 rounded-lg border ${
            existingRelationship.status === "ACTIVE" ? "text-green-400 bg-green-500/10 border-green-500/20"
            : existingRelationship.status === "PAUSED" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
            : "text-white/30 bg-white/5 border-white/10"
          }`}>
            {existingRelationship.status === "ACTIVE" ? "📡 Copying"
             : existingRelationship.status === "PAUSED" ? "⏸ Paused"
             : "⬜ Stopped"}
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

function RelationshipCard({ rel }: { rel: CopyRelationship }) {
  const { pauseCopying, resumeCopying, stopCopying, updateRiskSettings } = useCopyTradingStore();
  const { addNotification } = useNotificationStore();
  const [showSettings,    setShowSettings]    = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [editedSettings,  setEditedSettings]  = useState<CopyRiskSettings>({
    maxRiskPerTradePercent: rel.maxRiskPerTradePercent,
    maxDailyLossPercent: rel.maxDailyLossPercent,
    maxTotalDrawdownPercent: rel.maxTotalDrawdownPercent,
    maxOpenCopiedTrades: rel.maxOpenCopiedTrades,
    copyLotMode: rel.copyLotMode,
    fixedLotSize: rel.fixedLotSize,
    riskMultiplier: rel.riskMultiplier,
    maxSlippagePoints: rel.maxSlippagePoints,
    requireStopLoss: rel.requireStopLoss,
    newsFilterEnabled: rel.newsFilterEnabled,
  });

  return (
    <div className={`glass border rounded-xl p-5 ${
      rel.status === "ACTIVE" ? "border-green-500/15" : rel.status === "PAUSED" ? "border-amber-500/15" : "border-white/5"
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 font-bold shrink-0">
            {rel.masterDisplayName[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-white font-semibold">{rel.masterDisplayName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                rel.status === "ACTIVE" ? "text-green-400 bg-green-500/10 border-green-500/20"
                : rel.status === "PAUSED" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-white/30 bg-white/5 border-white/10"
              }`}>
                {rel.status === "ACTIVE" ? "🟢 Active" : rel.status === "PAUSED" ? "⏸ Paused" : `⬜ ${rel.status.toLowerCase()}`}
              </span>
              <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">Paper-Copy</span>
            </div>
          </div>
        </div>
        <ReportButton
          reportedItemType="copy_trade"
          reportedItemId={rel.id}
          reportedItemTitle={`Copy relationship with ${rel.masterDisplayName}`}
          sourceFeature="Active Copy Trading"
          compact
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
        {[
          { l: "Risk/trade", v: `${rel.maxRiskPerTradePercent}%` },
          { l: "Daily loss", v: `${rel.maxDailyLossPercent}%` },
          { l: "Max DD",     v: `${rel.maxTotalDrawdownPercent}%` },
          { l: "Max trades", v: rel.maxOpenCopiedTrades },
          { l: "Lot mode",   v: rel.copyLotMode.toLowerCase().replace(/_/g," ") },
          { l: "SL req.",    v: rel.requireStopLoss ? "Yes" : "No" },
        ].map(item => (
          <div key={item.l} className="glass border border-white/5 rounded-lg p-2">
            <p className="text-white/30 capitalize">{item.l}</p>
            <p className="text-white/70 font-medium capitalize">{item.v}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {rel.status === "ACTIVE" && (
          <button onClick={() => { pauseCopying(rel.id); addNotification({ type: "copy_trade", priority: "medium", title: `⏸ Copy Paused`, message: `${rel.masterDisplayName} copy paused.` }); }}
            className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-500/20 transition">
            ⏸ Pause
          </button>
        )}
        {rel.status === "PAUSED" && (
          <button onClick={() => { resumeCopying(rel.id); addNotification({ type: "copy_trade", priority: "low", title: `▶ Copy Resumed`, message: `${rel.masterDisplayName} copy resumed.` }); }}
            className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-500/20 transition">
            ▶ Resume
          </button>
        )}
        {rel.status !== "STOPPED" && (
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
                <button onClick={() => { stopCopying(rel.id, "Stopped by user"); addNotification({ type: "copy_trade", priority: "medium", title: "⬜ Copy Stopped", message: `${rel.masterDisplayName} copy stopped.` }); setShowStopConfirm(false); }}
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
                className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-2.5 rounded-xl text-sm font-semibold transition">Save</button>
            </div>
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
  const { addNotification } = useNotificationStore();

  const {
    masters, myApplication, myRelationships, copyHistory,
    startCopying, getCopyHistory,
    isLoading, isInitialized, error,
  } = useCopyTradingStore();

  const [activeTab,       setActiveTab]       = useState<CopyTab>("discover");
  const [copySetupMaster, setCopySetupMaster] = useState<MasterTrader | null>(null);
  const [mounted,         setMounted]         = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (!user) router.push("/login"); }, [user, router]);

  useEffect(() => {
    if (activeTab === "history") getCopyHistory();
  }, [activeTab, getCopyHistory]);

  if (!user) return null;

  if (!isInitialized || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/30 text-sm animate-pulse">Loading copy trading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          type="button"
          onClick={() => useCopyTradingStore.getState().init()}
          className="text-white/40 text-xs border border-white/10 px-3 py-1 rounded hover:text-white/70 hover:border-white/20 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const isAdminUser = mounted && isAdmin(user.roles);

  const TABS: { key: CopyTab; label: string; count?: number }[] = [
    { key: "discover", label: "🔍 Discover",       count: masters.length          },
    { key: "active",   label: "⚡ Active Copies",  count: myRelationships.length  },
    { key: "history",  label: "📋 History",        count: copyHistory.length      },
    { key: "apply",    label: "📝 Apply as Master"                                },
  ];

  const handleStartCopy = async (settings: CopyRiskSettings) => {
    if (!copySetupMaster) return;
    const relationship = await startCopying({ masterTraderId: copySetupMaster.id, riskSettings: settings });
    if (!relationship) return; // error already set on the store; a toast could read it if desired

    addNotification({
      type: "copy_trade", priority: "medium",
      title: `📡 Paper-Copy Started — ${copySetupMaster.displayName}`,
      message: "Paper-copy relationship active. No real broker orders will be placed.",
    });
    setCopySetupMaster(null);
    setActiveTab("active");
  };

  return (
    <>
        <div className="flex-1 overflow-y-auto">

          {/* Header */}
          <div className="glass border-b border-white/5 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white">📡 Copy Trading</h1>
                <p className="text-white/30 text-xs mt-0.5">
                  Paper-copy mode only · No real broker execution
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isAdminUser && (
                  <button onClick={() => router.push("/owner/copy-trading")}
                    className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition">
                    🔑 Admin Review →
                  </button>
                )}
                {user.tccId && (
                  <div className="glass border border-white/10 rounded-xl px-4 py-2 text-right">
                    <p className="text-white/30 text-xs">Your TCC ID</p>
                    <p className="text-green-400 font-mono font-bold text-sm">{user.tccId}</p>
                  </div>
                )}
              </div>
            </div>
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

            {/* DISCOVER */}
            {activeTab === "discover" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Discover Master Traders</h2>
                  <p className="text-white/30 text-xs">
                    TCC-approved master traders only. Performance not verified. Paper-copy mode only.
                  </p>
                </div>
                {masters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-4xl">📡</p>
                    <p className="text-white/30 text-sm font-semibold">No approved master traders yet.</p>
                    <p className="text-white/15 text-xs text-center max-w-sm leading-relaxed">
                      Master traders are approved through the application process by TCC admin.
                      Apply using the "Apply as Master" tab to be the first.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {masters.map(master => (
                      <MasterTraderCard
                        key={master.id}
                        master={master}
                        existingRelationship={myRelationships.find(r => r.masterTraderId === master.id)}
                        onStartCopy={() => setCopySetupMaster(master)}
                      />
                    ))}
                  </div>
                )}
                <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
                  <p className="text-white/20 text-xs leading-relaxed">
                    <strong className="text-white/30">Disclaimer:</strong>{" "}
                    All master traders shown here are approved by TCC admin. Performance data is not verified,
                    not broker-connected, and not audited. This is paper-copy mode only —
                    no real money is involved. Phase Alpha will require verified broker data and
                    independent performance auditing.
                  </p>
                </div>
              </div>
            )}

            {/* ACTIVE COPIES */}
            {activeTab === "active" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Active Copy Relationships</h2>
                  <p className="text-white/30 text-xs">All paper-copy only. No real orders placed.</p>
                </div>

                {myRelationships.filter(r => r.status !== "STOPPED").length === 0 ? (
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
                    {myRelationships.filter(r => r.status !== "STOPPED").map(rel => (
                      <RelationshipCard key={rel.id} rel={rel} />
                    ))}
                  </div>
                )}

                {myRelationships.filter(r => r.status === "STOPPED").length > 0 && (
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-3">Stopped Relationships</p>
                    {myRelationships.filter(r => r.status === "STOPPED").map(rel => (
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

            {/* HISTORY */}
            {activeTab === "history" && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Copy History</h2>
                  <p className="text-white/30 text-xs">Paper-copy events only. No real trades.</p>
                </div>

                {copyHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <p className="text-4xl">📋</p>
                    <p className="text-white/30 text-sm">No copy history yet.</p>
                    <p className="text-white/15 text-xs text-center">
                      History appears here once a master trader you're copying opens a position.
                    </p>
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
                          <th className="text-left px-4 py-3 text-white/40">Note</th>
                          <th className="text-right px-4 py-3 text-white/40">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {copyHistory.map(item => {
                          const rel = myRelationships.find(r => r.id === item.relationshipId);
                          return (
                            <tr key={item.id} className="border-b border-white/5 hover:bg-white/2">
                              <td className="px-4 py-3 text-white/60">{rel?.masterDisplayName ?? "—"}</td>
                              <td className="px-4 py-3 text-white font-medium">{item.displayName}</td>
                              <td className={`px-4 py-3 font-semibold ${item.side === "BUY" ? "text-green-400" : "text-red-400"}`}>
                                {item.side}
                              </td>
                              <td className="px-4 py-3 text-right text-white/60">{item.lotSize}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  item.status === "COPIED_PAPER" ? "text-green-400 bg-green-500/10"
                                  : item.status === "BLOCKED"     ? "text-red-400 bg-red-500/10"
                                  : item.status === "SKIPPED"     ? "text-amber-400 bg-amber-500/10"
                                  : "text-white/30 bg-white/5"
                                }`}>
                                  {item.status === "COPIED_PAPER" ? "✓ Paper-Copied"
                                   : item.status === "BLOCKED"     ? "⛔ Blocked"
                                   : item.status === "SKIPPED"     ? "⏭ Skipped"
                                   : item.status.toLowerCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-white/30 italic text-xs">Paper-copy only</td>
                              <td className="px-4 py-3 text-white/30 text-xs max-w-[120px] truncate">
                                {item.reason ?? "—"}
                              </td>
                              <td className="px-4 py-3 text-right text-white/30">{timeAgo(item.createdAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* APPLY */}
            {activeTab === "apply" && (
              <div className="flex flex-col gap-5 max-w-2xl">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Apply as Master Trader</h2>
                  <p className="text-white/30 text-xs">
                    Admin review required. Approval does not guarantee performance or income.
                  </p>
                </div>

                {myApplication && myApplication.status !== "DRAFT" ? (
                  <ApplicationStatusCard app={myApplication} />
                ) : (
                  <ApplicationForm />
                )}
              </div>
            )}

          </div>
        </div>

      {copySetupMaster && (
        <CopySetupModal
          master={copySetupMaster}
          onClose={() => setCopySetupMaster(null)}
          onStart={handleStartCopy}
        />
      )}
    </>
  );
}
