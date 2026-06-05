"use client";
/**
 * TCC Strategy Marketplace
 *
 * Honest labels throughout:
 * - No fake verified win rates
 * - No fake purchase counts
 * - No fake reviews
 * - Educational templates clearly labeled
 * - Performance status shown for every strategy
 * - ReportButton on all strategy cards
 * - Academy cross-links where available
 */
import { useState, useMemo, useCallback } from "react";
import {
  useStrategyStore, Strategy, StrategyType,
  StrategyRiskLevel, StrategyAssetClass, StrategyTimeframe, StrategyReview
} from "@/store/strategyStore";
import { useAcademyStore } from "@/store/academyStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import ReportButton from "@/components/ReportButton";

// ── Badge helpers ─────────────────────────────────────────────────────────

const riskBadge: Record<StrategyRiskLevel, string> = {
  low:    "text-green-400  bg-green-500/10  border-green-500/20",
  medium: "text-amber-400  bg-amber-500/10  border-amber-500/20",
  high:   "text-red-400    bg-red-500/10    border-red-500/20",
};

const typeBadge: Record<StrategyType, string> = {
  official:             "text-blue-400  bg-blue-500/10  border-blue-500/20",
  educational_template: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  creator_published:    "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const typeLabel: Record<StrategyType, string> = {
  official:             "Official TCC",
  educational_template: "Educational Template",
  creator_published:    "Creator Published",
};

const perfStatusBadge: Record<string, string> = {
  unverified:    "text-white/40 bg-white/5 border-white/10",
  self_reported: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  verified:      "text-green-400 bg-green-500/10 border-green-500/20",
};

const perfStatusLabel: Record<string, string> = {
  unverified:    "Educational — not verified",
  self_reported: "Self-reported data",
  verified:      "Verified",
};

// ── Strategy Detail Panel ─────────────────────────────────────────────────

function StrategyDetail({
  strategy,
  onClose,
}: {
  strategy: Strategy;
  onClose: () => void;
}) {
  const { saveStrategy, unsaveStrategy, togglePlaybook, addReview, isSaved, isInPlaybook } = useStrategyStore();
  const { courses } = useAcademyStore();
  const { addNotification } = useNotificationStore();
  const { user } = useAuthStore();
  const router = useRouter();

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating,   setReviewRating]   = useState(5);
  const [reviewComment,  setReviewComment]  = useState("");

  const saved      = isSaved(strategy.id);
  const inPlaybook = isInPlaybook(strategy.id);
  const linkedCourse = strategy.linkedAcademyCourseId
    ? courses.find(c => c.id === strategy.linkedAcademyCourseId)
    : null;

  const handleSave = () => {
    if (saved) {
      unsaveStrategy(strategy.id);
    } else {
      saveStrategy(strategy.id);
      addNotification({
        type: "system",
        priority: "low",
        title: `💾 Strategy Saved: ${strategy.title}`,
        message: "Saved to My Strategies. Use it as a reference for your paper trading.",
        action: { label: "View Saved", path: "/marketplace" },
      });
    }
  };

  const handlePlaybook = () => {
    if (!saved) {
      saveStrategy(strategy.id);
    }
    togglePlaybook(strategy.id);
    if (!inPlaybook) {
      addNotification({
        type: "system",
        priority: "low",
        title: `📋 Added to Playbook: ${strategy.title}`,
        message: "Strategy framework added to your Playbook for reference during trades.",
        action: { label: "Open Playbook", path: "/playbook" },
      });
    }
  };

  const handleSubmitReview = () => {
    if (!reviewComment.trim()) return;
    addReview(strategy.id, {
      authorHandle: user?.handle || "guest",
      rating: reviewRating,
      comment: reviewComment.trim(),
    });
    setShowReviewForm(false);
    setReviewRating(5);
    setReviewComment("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
        <button onClick={onClose} className="text-white/40 hover:text-white text-xs transition">← Back</button>
        <div className="flex items-center gap-2">
          <ReportButton
            reportedItemType="strategy"
            reportedItemId={strategy.id}
            reportedItemTitle={strategy.title}
            sourceFeature="Strategy Marketplace Detail"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Strategy header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadge[strategy.type]}`}>
              {typeLabel[strategy.type]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${riskBadge[strategy.riskLevel]}`}>
              {strategy.riskLevel} risk
            </span>
            <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">
              {strategy.timeframe} timeframe
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${perfStatusBadge[strategy.performanceStatus]}`}>
              {perfStatusLabel[strategy.performanceStatus]}
            </span>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">{strategy.title}</h1>
          <p className="text-white/50 text-sm leading-relaxed mb-4">{strategy.description}</p>

          {/* Performance disclaimer — always visible */}
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mb-4">
            <p className="text-amber-400/80 text-xs leading-relaxed">
              ⚠ <strong>Disclaimer:</strong> {strategy.performanceDisclaimer}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleSave}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                saved
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:bg-white/8"
              }`}>
              {saved ? "✓ Saved" : "💾 Save Strategy"}
            </button>
            <button onClick={handlePlaybook}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                inPlaybook
                  ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                  : "bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:bg-white/8"
              }`}>
              {inPlaybook ? "📋 In Playbook" : "📋 Add to Playbook"}
            </button>
            {linkedCourse && (
              <button
                onClick={() => router.push("/academy")}
                className="bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-lg text-xs font-semibold transition">
                🎓 Learn This Strategy →
              </button>
            )}
          </div>
        </div>

        {/* Rules & Conditions */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-white/5">
          <div className="glass border border-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">📋 Core Rules</p>
            {strategy.rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-green-400 text-xs mt-0.5 shrink-0">✓</span>
                <p className="text-white/60 text-xs">{rule}</p>
              </div>
            ))}
          </div>

          <div className="glass border border-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">🎯 Entry Conditions</p>
            {strategy.entryConditions.map((cond, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-blue-400 text-xs mt-0.5 shrink-0">{i + 1}.</span>
                <p className="text-white/60 text-xs">{cond}</p>
              </div>
            ))}
          </div>

          <div className="glass border border-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">🚪 Exit Conditions</p>
            {strategy.exitConditions.map((cond, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-red-400 text-xs mt-0.5 shrink-0">→</span>
                <p className="text-white/60 text-xs">{cond}</p>
              </div>
            ))}
          </div>

          <div className="glass border border-white/5 rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">🛡 Risk Management</p>
            {strategy.riskManagementRules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-amber-400 text-xs mt-0.5 shrink-0">⚠</span>
                <p className="text-white/60 text-xs">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Linked academy resource */}
        {linkedCourse && (
          <div className="px-6 pt-5 pb-0 border-b border-white/5">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">🎓 Learn This Strategy in Academy</p>
            <div
              onClick={() => router.push("/academy")}
              className="glass border border-blue-500/20 bg-blue-500/5 rounded-xl p-4 mb-5 cursor-pointer hover:border-blue-500/30 transition flex items-center gap-4">
              <span className="text-3xl">{linkedCourse.thumbnail}</span>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{linkedCourse.title}</p>
                <p className="text-white/40 text-xs mt-0.5">{linkedCourse.description.slice(0, 80)}...</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs text-blue-400">Free</span>
                  <span className="text-xs text-white/30">·</span>
                  <span className="text-xs text-white/40">{linkedCourse.totalDuration}</span>
                  <span className="text-xs text-white/30">·</span>
                  <span className="text-xs text-white/40 capitalize">{linkedCourse.level}</span>
                </div>
              </div>
              <span className="text-white/40 text-sm">→</span>
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/40 text-xs uppercase tracking-wider">
              User Reviews ({strategy.reviews.length})
            </p>
            {saved && (
              <button onClick={() => setShowReviewForm(!showReviewForm)}
                className="bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 px-3 py-1 rounded-lg text-xs transition">
                ⭐ Write a Review
              </button>
            )}
          </div>

          {showReviewForm && (
            <div className="glass border border-white/10 rounded-xl p-4 mb-4">
              <p className="text-white/50 text-xs mb-3">Your rating</p>
              <div className="flex gap-1 mb-3">
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setReviewRating(star)} className="text-xl transition">
                    <span className={star <= reviewRating ? "text-amber-400" : "text-white/20"}>★</span>
                  </button>
                ))}
              </div>
              <textarea value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Share your experience using this strategy in paper trading..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25 placeholder-white/20 mb-3"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowReviewForm(false)}
                  className="bg-white/5 text-white/40 border border-white/10 px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                <button onClick={handleSubmitReview}
                  disabled={!reviewComment.trim()}
                  className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40">
                  Submit Review
                </button>
              </div>
            </div>
          )}

          {strategy.reviews.length === 0 ? (
            <p className="text-white/20 text-xs">No reviews yet. Save this strategy and share your paper trading experience.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {strategy.reviews.map(review => (
                <div key={review.id} className="glass border border-white/5 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white/70 text-xs font-semibold">{review.authorHandle}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={i < review.rating ? "text-amber-400 text-xs" : "text-white/20 text-xs"}>★</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 text-xs">{new Date(review.createdAt).toLocaleDateString()}</span>
                      <ReportButton
                        reportedItemType="comment"
                        reportedItemId={review.id}
                        reportedItemTitle={review.comment.slice(0, 60)}
                        sourceFeature="Strategy Marketplace Review"
                        compact
                      />
                    </div>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Strategy Card ─────────────────────────────────────────────────────────

function StrategyCard({
  strategy,
  onClick,
}: {
  strategy: Strategy;
  onClick: () => void;
}) {
  const { isSaved, isInPlaybook } = useStrategyStore();
  const saved = isSaved(strategy.id);
  const inPlaybook = isInPlaybook(strategy.id);

  return (
    <div
      onClick={onClick}
      className="glass border border-white/5 rounded-xl p-5 cursor-pointer hover:border-white/15 transition relative group">

      {/* Report button */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition z-10"
        onClick={e => e.stopPropagation()}>
        <ReportButton
          reportedItemType="strategy"
          reportedItemId={strategy.id}
          reportedItemTitle={strategy.title}
          sourceFeature="Strategy Marketplace"
          compact
        />
      </div>

      {/* Header badges */}
      <div className="flex flex-wrap gap-1.5 mb-3 pr-8">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${typeBadge[strategy.type]}`}>
          {typeLabel[strategy.type]}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${riskBadge[strategy.riskLevel]}`}>
          {strategy.riskLevel}
        </span>
        {strategy.isFeatured && (
          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">⭐ Featured</span>
        )}
      </div>

      <h3 className="text-white font-semibold text-sm mb-1 pr-6">{strategy.title}</h3>
      <p className="text-white/40 text-xs leading-relaxed mb-3 line-clamp-2">{strategy.description}</p>

      {/* Performance status — always visible */}
      <div className={`text-xs px-2 py-1 rounded-lg border mb-3 ${perfStatusBadge[strategy.performanceStatus]}`}>
        {perfStatusLabel[strategy.performanceStatus]}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-white/30 mb-3">
        <span>{strategy.timeframe}</span>
        <span>·</span>
        <span className="capitalize">{strategy.assetClass === "all" ? "All assets" : strategy.assetClass}</span>
        {strategy.linkedAcademyCourseId && (
          <>
            <span>·</span>
            <span className="text-blue-400/60">🎓 Academy resource</span>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {saved && (
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">✓ Saved</span>
          )}
          {inPlaybook && (
            <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">📋 Playbook</span>
          )}
        </div>
        {strategy.reviews.length > 0 && (
          <span className="text-xs text-white/30">{strategy.reviews.length} review{strategy.reviews.length > 1 ? "s" : ""}</span>
        )}
        <span className="text-white/40 text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
          {strategy.isPaid ? `$${strategy.price}` : "Free"}
        </span>
      </div>
    </div>
  );
}

// ── Publish Strategy Form ─────────────────────────────────────────────────

function PublishForm({ onClose }: { onClose: () => void }) {
  const { publishStrategy } = useStrategyStore();
  const { addNotification } = useNotificationStore();
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    title: "", description: "", assetClass: "all" as StrategyAssetClass,
    timeframe: "H1" as StrategyTimeframe, riskLevel: "medium" as StrategyRiskLevel,
    tags: "", rules: "", entryConditions: "", exitConditions: "", riskManagementRules: "",
  });

  const handlePublish = () => {
    if (!form.title || !form.description) return;
    publishStrategy({
      title: form.title,
      description: form.description,
      assetClass: form.assetClass,
      timeframe: form.timeframe,
      riskLevel: form.riskLevel,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
      rules: form.rules.split("\n").filter(Boolean),
      entryConditions: form.entryConditions.split("\n").filter(Boolean),
      exitConditions: form.exitConditions.split("\n").filter(Boolean),
      riskManagementRules: form.riskManagementRules.split("\n").filter(Boolean),
      performanceStatus: "unverified",
      performanceDisclaimer: "Creator-published strategy. Not independently verified. Educational and paper trading use only.",
      isPaid: false,
      price: 0,
      isFeatured: false,
      creatorId: user?.id,
      creatorName: user?.handle,
    });
    addNotification({
      type: "system",
      priority: "low",
      title: "✅ Strategy Published Locally",
      message: `"${form.title}" is now visible in your Marketplace. Saved locally to your account.`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111217] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold">Publish Strategy</h2>
            <p className="text-white/30 text-xs mt-0.5">Creator-published · Saved locally · Not verified</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl w-7 h-7 flex items-center justify-center">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-white/40 text-xs mb-1">Title *</p>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Strategy name..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Description *</p>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="What is this strategy about?"
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-white/40 text-xs mb-1">Asset</p>
              <select value={form.assetClass} onChange={e => setForm({ ...form, assetClass: e.target.value as StrategyAssetClass })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
                <option value="all">All</option>
                <option value="crypto">Crypto</option>
                <option value="forex">Forex</option>
                <option value="commodity">Commodity</option>
                <option value="index">Index</option>
              </select>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Timeframe</p>
              <select value={form.timeframe} onChange={e => setForm({ ...form, timeframe: e.target.value as StrategyTimeframe })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
                {["M5","M15","M30","H1","H4","D1"].map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Risk</p>
              <select value={form.riskLevel} onChange={e => setForm({ ...form, riskLevel: e.target.value as StrategyRiskLevel })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Rules (one per line)</p>
            <textarea value={form.rules} onChange={e => setForm({ ...form, rules: e.target.value })}
              placeholder={"Rule 1\nRule 2"} rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Entry Conditions (one per line)</p>
            <textarea value={form.entryConditions} onChange={e => setForm({ ...form, entryConditions: e.target.value })}
              placeholder={"Condition 1\nCondition 2"} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Exit Conditions (one per line)</p>
            <textarea value={form.exitConditions} onChange={e => setForm({ ...form, exitConditions: e.target.value })}
              placeholder={"Exit condition 1\nExit condition 2"} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Risk Management Rules (one per line)</p>
            <textarea value={form.riskManagementRules} onChange={e => setForm({ ...form, riskManagementRules: e.target.value })}
              placeholder={"Risk rule 1\nRisk rule 2"} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-none focus:outline-none focus:border-white/25" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Tags (comma separated)</p>
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
              placeholder="SMC, XAUUSD, breakout"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-white/25" />
          </div>

          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
            <p className="text-amber-400/80 text-xs leading-relaxed">
              Your strategy will be published locally and saved to your account. It will be labeled "Creator Published — Educational only, not verified." No performance claims will be added automatically.
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-white/5 text-white/40 border border-white/10 py-2.5 rounded-xl text-sm">Cancel</button>
            <button onClick={handlePublish} disabled={!form.title || !form.description}
              className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-green-500/30 transition">
              Publish Locally
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

type FilterTab = "all" | "official" | "educational_template" | "creator_published" | "saved";

export default function MarketplacePage() {
  const { getAllStrategies, userStrategies, isSaved } = useStrategyStore();
  const router = useRouter();

  const [activeTab,     setActiveTab]     = useState<FilterTab>("all");
  const [filterRisk,    setFilterRisk]    = useState<string>("all");
  const [filterAsset,   setFilterAsset]   = useState<string>("all");
  const [filterTF,      setFilterTF]      = useState<string>("all");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [showPublish,   setShowPublish]   = useState(false);

  const allStrategies = getAllStrategies();

  const filtered = useMemo(() => {
    let list = allStrategies;

    if (activeTab === "saved")      list = list.filter(s => isSaved(s.id));
    else if (activeTab !== "all")   list = list.filter(s => s.type === activeTab);

    if (filterRisk  !== "all") list = list.filter(s => s.riskLevel  === filterRisk);
    if (filterAsset !== "all") list = list.filter(s => s.assetClass === filterAsset || s.assetClass === "all");
    if (filterTF    !== "all") list = list.filter(s => s.timeframe  === filterTF || s.timeframe === "any");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Featured first
    return [...list].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }, [allStrategies, activeTab, filterRisk, filterAsset, filterTF, searchQuery, userStrategies]);

  const selectedStrategy = allStrategies.find(s => s.id === selectedId);

  const savedCount     = userStrategies.length;
  const officialCount  = allStrategies.filter(s => s.type === "official").length;
  const templateCount  = allStrategies.filter(s => s.type === "educational_template").length;
  const creatorCount   = allStrategies.filter(s => s.type === "creator_published").length;

  const tabConfig: { key: FilterTab; label: string }[] = [
    { key: "all",                  label: `All (${allStrategies.length})` },
    { key: "official",             label: `Official (${officialCount})` },
    { key: "educational_template", label: `Templates (${templateCount})` },
    { key: "creator_published",    label: `Creator (${creatorCount})` },
    { key: "saved",                label: `Saved (${savedCount})` },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex flex-1 overflow-hidden">

          {/* Left — strategy list */}
          <div className={`flex flex-col overflow-hidden ${selectedStrategy ? "w-96 shrink-0 border-r border-white/5" : "flex-1"}`}>

            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-xl font-bold text-white">🏪 Strategy Marketplace</h1>
                  <p className="text-white/30 text-xs mt-0.5">
                    Official TCC templates and educational frameworks. No fake performance claims. No verified win rates.
                  </p>
                </div>
                <button onClick={() => setShowPublish(true)}
                  className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-500/30 transition shrink-0 ml-3">
                  + Publish
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-0.5 bg-white/5 rounded-lg p-1 mb-3 overflow-x-auto">
                {tabConfig.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${activeTab === tab.key ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60"}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search strategies..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-white/25 placeholder-white/20 mb-2" />

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs flex-1 min-w-0">
                  <option value="all">All risk</option>
                  <option value="low">Low risk</option>
                  <option value="medium">Medium risk</option>
                  <option value="high">High risk</option>
                </select>
                <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs flex-1 min-w-0">
                  <option value="all">All assets</option>
                  <option value="crypto">Crypto</option>
                  <option value="forex">Forex</option>
                  <option value="commodity">Commodity</option>
                  <option value="index">Index</option>
                </select>
                <select value={filterTF} onChange={e => setFilterTF(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs flex-1 min-w-0">
                  <option value="all">All TF</option>
                  {["M5","M15","H1","H4","D1"].map(tf => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
            </div>

            {/* Strategy grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-3xl mb-3">🏪</p>
                    <p className="text-white/30 text-sm">
                      {activeTab === "saved" ? "No saved strategies yet" : "No strategies match your filters"}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Show disclaimer if educational templates in view */}
                  {(activeTab === "all" || activeTab === "educational_template") && (
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 mb-4">
                      <p className="text-indigo-400/70 text-xs leading-relaxed">
                        <strong>📖 Educational Note:</strong> Educational templates are well-known trading approaches for learning only.
                        No performance data is verified. Past hypothetical results do not guarantee future results.
                        Use TCC paper trading to test any approach before considering real capital.
                      </p>
                    </div>
                  )}

                  <div className={`grid gap-4 ${selectedStrategy ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
                    {filtered.map(strategy => (
                      <StrategyCard
                        key={strategy.id}
                        strategy={strategy}
                        onClick={() => setSelectedId(strategy.id)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Footer note */}
              <div className="mt-6 p-4 bg-white/2 border border-white/5 rounded-xl">
                <p className="text-white/20 text-xs leading-relaxed">
                  <strong className="text-white/30">TCC Strategy Marketplace —</strong>{" "}
                  All strategies are saved locally per user. No payment processing is connected.
                  Strategy performance data is either educational (theoretical) or self-reported — neither is independently verified.
                  This is a paper trading educational platform only. Real trading involves substantial risk of loss.
                </p>
              </div>
            </div>
          </div>

          {/* Right — strategy detail panel */}
          {selectedStrategy && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <StrategyDetail
                strategy={selectedStrategy}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}
        </div>
      </div>

      {showPublish && <PublishForm onClose={() => setShowPublish(false)} />}
    </div>
  );
}