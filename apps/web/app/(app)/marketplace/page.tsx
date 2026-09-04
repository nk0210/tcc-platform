"use client";
/**
 * TCC Strategy Marketplace
 *
 * API-backed via strategyStore.ts (Phase Alpha Frontend Integration):
 *   StrategyType / StrategyRiskLevel / StrategyPricing / PerformanceStatus are
 *   all uppercase enums matching the Prisma schema.
 *   isSaved / isInPlaybook are booleans on the Strategy object itself (no
 *   longer store selector functions) — toggled via toggleSave / togglePlaybook.
 *   Reviews are not embedded on Strategy anymore (only _count.reviews) —
 *   fetched on demand via getReviews().
 *   createStrategy() replaces publishStrategy() and only accepts the fields
 *   the API allows (server derives author/verification/featured status).
 */
import { useState, useMemo, useEffect } from "react";
import {
  useStrategyStore,
  type Strategy,
  type StrategyType,
  type StrategyRiskLevel,
  type StrategyPricing,
  type PerformanceStatus,
  type StrategyReview,
} from "@/store/strategyStore";
import { useAcademyStore, type Course } from "@/store/academyStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import ReportButton from "@/components/ReportButton";

// ── Badge / label helpers (uppercase enum keys) ────────────────────────────

const RISK_BADGE: Record<StrategyRiskLevel, string> = {
  LOW:    "text-success  bg-success-soft  border-success/30",
  MEDIUM: "text-warning  bg-warning-soft  border-warning/30",
  HIGH:   "text-danger    bg-danger-soft    border-danger/30",
};

const RISK_LABEL: Record<StrategyRiskLevel, string> = {
  LOW:    "Low",
  MEDIUM: "Medium",
  HIGH:   "High",
};

const TYPE_BADGE: Record<StrategyType, string> = {
  OFFICIAL:             "text-blue-400   bg-blue-500/10   border-blue-500/20",
  EDUCATIONAL_TEMPLATE: "text-accent-hover bg-accent/10 border-accent/30",
  CREATOR_PUBLISHED:    "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

const TYPE_LABEL: Record<StrategyType, string> = {
  OFFICIAL:             "Official TCC",
  EDUCATIONAL_TEMPLATE: "Educational Template",
  CREATOR_PUBLISHED:    "Creator Published",
};

const PERF_BADGE: Record<PerformanceStatus, string> = {
  UNVERIFIED:    "text-fg-dim bg-elevated border-border",
  SELF_REPORTED: "text-warning bg-warning-soft border-warning/30",
  VERIFIED:      "text-success bg-success-soft border-success/30",
};

const PERF_LABEL: Record<PerformanceStatus, string> = {
  UNVERIFIED:    "Educational — not verified",
  SELF_REPORTED: "Self-reported data",
  VERIFIED:      "Verified",
};

// ── Filter types ──────────────────────────────────────────────────────────

type FilterTab = "all" | StrategyType | "saved";

// ── Strategy Detail Panel ─────────────────────────────────────────────────

function StrategyDetail({
  strategy,
  onClose,
}: {
  strategy: Strategy;
  onClose:  () => void;
}) {
  const { toggleSave, togglePlaybook, addReview, getReviews } = useStrategyStore();
  const { courses }         = useAcademyStore();
  const { addNotification } = useNotificationStore();
  const { user }            = useAuthStore();
  const router              = useRouter();

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating,   setReviewRating]   = useState(5);
  const [reviewComment,  setReviewComment]  = useState("");
  const [reviews,        setReviews]        = useState<StrategyReview[]>([]);

  const saved      = strategy.isSaved;
  const inPlaybook = strategy.isInPlaybook;

  useEffect(() => {
    let cancelled = false;
    getReviews(strategy.id).then((res) => {
      if (!cancelled && res) setReviews(res.items);
    });
    return () => { cancelled = true; };
  }, [strategy.id, getReviews]);

  // Link to Academy course — uses linkedCourseId
  const linkedCourse: Course | undefined = strategy.linkedCourseId
    ? courses.find((c) => c.id === strategy.linkedCourseId)
    : undefined;

  const handleSave = async () => {
    const wasSaved = saved;
    await toggleSave(strategy.id);
    if (!wasSaved) {
      addNotification({
        type:        "system",
        priority:    "low",
        title:       `💾 Strategy Saved: ${strategy.title}`,
        message:     "Saved to My Strategies. Use as a reference for your paper trading.",
        actionLabel: "View Saved",
        actionPath:  "/marketplace",
      });
    }
  };

  const handlePlaybook = async () => {
    if (!saved) await toggleSave(strategy.id);
    await togglePlaybook(strategy.id);
    if (!inPlaybook) {
      addNotification({
        type:        "system",
        priority:    "low",
        title:       `📋 Added to Playbook: ${strategy.title}`,
        message:     "Strategy framework added to your Playbook for reference during trades.",
        actionLabel: "Open Playbook",
        actionPath:  "/playbook",
      });
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewComment.trim()) return;
    const review = await addReview(strategy.id, {
      rating:  reviewRating,
      comment: reviewComment.trim(),
    });
    if (review) setReviews((prev) => [review, ...prev]);
    setShowReviewForm(false);
    setReviewRating(5);
    setReviewComment("");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <button onClick={onClose} className="text-fg-dim hover:text-fg text-xs transition">
          ← Back
        </button>
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

        {/* Strategy header section */}
        <div className="p-6 border-b border-border">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_BADGE[strategy.type]}`}>
              {TYPE_LABEL[strategy.type]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${RISK_BADGE[strategy.riskLevel]}`}>
              {RISK_LABEL[strategy.riskLevel]} risk
            </span>
            <span className="text-xs bg-elevated text-fg-dim border border-border px-2 py-0.5 rounded-full">
              {strategy.timeframe === "any" ? "Any timeframe" : strategy.timeframe}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${PERF_BADGE[strategy.performanceStatus]}`}>
              {PERF_LABEL[strategy.performanceStatus]}
            </span>
            {strategy.isFeatured && (
              <span className="text-xs text-warning bg-warning-soft border border-warning/30 px-2 py-0.5 rounded-full">
                ⭐ Featured
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-fg mb-2">{strategy.title}</h1>
          <p className="text-fg-muted text-sm leading-relaxed mb-4">{strategy.description}</p>

          {/* Disclaimer */}
          <div className="bg-warning-soft border border-warning/30 rounded-xl p-3 mb-4">
            <p className="text-warning/80 text-xs leading-relaxed">
              ⚠ <strong>Disclaimer:</strong> {strategy.disclaimer}
            </p>
          </div>

          {/* Asset / Timeframe / Author meta */}
          <div className="flex flex-wrap gap-3 text-xs text-fg-dim mb-4">
            <span>
              🪙 {strategy.assetCategory === "all" ? "All assets" : strategy.assetCategory}
            </span>
            <span>⏱ {strategy.timeframe === "any" ? "Any TF" : strategy.timeframe}</span>
            <span>✍ {strategy.authorHandle}</span>
            <span>v{strategy.version}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSave}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                saved
                  ? "bg-success-soft text-success border-success/30"
                  : "bg-elevated text-fg-muted border-border hover:border-border-strong hover:bg-elevated"
              }`}>
              {saved ? "✓ Saved" : "💾 Save Strategy"}
            </button>

            <button
              onClick={handlePlaybook}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition ${
                inPlaybook
                  ? "bg-accent-soft text-accent-hover border-accent/30"
                  : "bg-elevated text-fg-muted border-border hover:border-border-strong hover:bg-elevated"
              }`}>
              {inPlaybook ? "📋 In Playbook" : "📋 Add to Playbook"}
            </button>

            {/* Linked Academy course */}
            {linkedCourse && (
              <button
                onClick={() => router.push("/academy")}
                className="bg-blue-500/10 hover:bg-blue-500/15 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-lg text-xs font-semibold transition">
                🎓 Learn This Strategy →
              </button>
            )}
          </div>
        </div>

        {/* Rules & Conditions grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-border">

          <div className="glass border border-border rounded-xl p-4">
            <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">📋 Core Rules</p>
            {strategy.rules.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-success text-xs mt-0.5 shrink-0">✓</span>
                <p className="text-fg-muted text-xs">{rule}</p>
              </div>
            ))}
          </div>

          <div className="glass border border-border rounded-xl p-4">
            <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">🎯 Entry Conditions</p>
            {strategy.entryConditions.map((cond, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-blue-400 text-xs mt-0.5 shrink-0">{i + 1}.</span>
                <p className="text-fg-muted text-xs">{cond}</p>
              </div>
            ))}
          </div>

          <div className="glass border border-border rounded-xl p-4">
            <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">🚪 Exit Conditions</p>
            {strategy.exitConditions.map((cond, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-danger text-xs mt-0.5 shrink-0">→</span>
                <p className="text-fg-muted text-xs">{cond}</p>
              </div>
            ))}
          </div>

          <div className="glass border border-border rounded-xl p-4">
            <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">🛡 Risk Management</p>
            {strategy.riskManagement.map((rule, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-warning text-xs mt-0.5 shrink-0">⚠</span>
                <p className="text-fg-muted text-xs">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Linked Academy resource */}
        {linkedCourse && (
          <div className="px-6 pt-5 pb-0 border-b border-border">
            <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">
              🎓 Learn This Strategy in Academy
            </p>
            <div
              onClick={() => router.push("/academy")}
              className="glass border border-blue-500/20 bg-blue-500/5 rounded-xl p-4 mb-5 cursor-pointer hover:border-blue-500/30 transition flex items-center gap-4">
              <span className="text-3xl">{linkedCourse.thumbnail}</span>
              <div className="flex-1">
                <p className="text-fg font-semibold text-sm">{linkedCourse.title}</p>
                <p className="text-fg-dim text-xs mt-0.5 line-clamp-1">
                  {linkedCourse.description.slice(0, 80)}...
                </p>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-xs text-blue-400">Free</span>
                  <span className="text-xs text-fg-dim">·</span>
                  <span className="text-xs text-fg-dim">{linkedCourse.totalDuration}</span>
                  <span className="text-xs text-fg-dim">·</span>
                  <span className="text-xs text-fg-dim capitalize">{linkedCourse.level.toLowerCase()}</span>
                </div>
              </div>
              <span className="text-fg-dim text-sm">→</span>
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-fg-dim text-xs uppercase tracking-wider">
              User Reviews ({strategy._count.reviews})
            </p>
            {saved && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="bg-elevated hover:bg-elevated text-fg-muted border border-border px-3 py-1 rounded-lg text-xs transition">
                ⭐ Write a Review
              </button>
            )}
          </div>

          {showReviewForm && (
            <div className="glass border border-border rounded-xl p-4 mb-4">
              <p className="text-fg-muted text-xs mb-2">Your rating</p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className="text-xl transition">
                    <span className={star <= reviewRating ? "text-warning" : "text-fg-dim"}>★</span>
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience using this strategy in paper trading..."
                rows={3}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs resize-none focus:outline-none focus:border-border placeholder-white/20 mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReviewForm(false)}
                  className="bg-elevated text-fg-dim border border-border px-3 py-1.5 rounded-lg text-xs">
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={!reviewComment.trim()}
                  className="bg-accent-soft text-accent-hover border border-accent/30 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40">
                  Submit Review
                </button>
              </div>
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-fg-dim text-xs">
              No reviews yet. Save this strategy and share your paper trading experience.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((review) => (
                <div key={review.id} className="glass border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-fg-muted text-xs font-semibold">{review.handle}</span>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span
                            key={i}
                            className={i < review.rating ? "text-warning text-xs" : "text-fg-dim text-xs"}>
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-fg-dim text-xs">
                        {new Date(review.timestamp).toLocaleDateString()}
                      </span>
                      <ReportButton
                        reportedItemType="comment"
                        reportedItemId={review.id}
                        reportedItemTitle={review.comment.slice(0, 60)}
                        sourceFeature="Strategy Marketplace Review"
                        compact
                      />
                    </div>
                  </div>
                  <p className="text-fg-muted text-xs leading-relaxed">{review.comment}</p>
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
  onClick:  () => void;
}) {
  const saved      = strategy.isSaved;
  const inPlaybook = strategy.isInPlaybook;

  return (
    <div
      onClick={onClick}
      className="glass border border-border rounded-xl p-5 cursor-pointer hover:border-border transition relative group">

      {/* Report button — on hover */}
      <div
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition z-10"
        onClick={(e) => e.stopPropagation()}>
        <ReportButton
          reportedItemType="strategy"
          reportedItemId={strategy.id}
          reportedItemTitle={strategy.title}
          sourceFeature="Strategy Marketplace"
          compact
        />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3 pr-8">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_BADGE[strategy.type]}`}>
          {TYPE_LABEL[strategy.type]}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${RISK_BADGE[strategy.riskLevel]}`}>
          {RISK_LABEL[strategy.riskLevel]}
        </span>
        {strategy.isFeatured && (
          <span className="text-xs text-warning bg-warning-soft border border-warning/30 px-2 py-0.5 rounded-full">
            ⭐ Featured
          </span>
        )}
      </div>

      <h3 className="text-fg font-semibold text-sm mb-1 pr-6">{strategy.title}</h3>
      <p className="text-fg-dim text-xs leading-relaxed mb-3 line-clamp-2">
        {strategy.description}
      </p>

      {/* Performance status */}
      <div className={`text-xs px-2 py-1 rounded-lg border mb-3 ${PERF_BADGE[strategy.performanceStatus]}`}>
        {PERF_LABEL[strategy.performanceStatus]}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-fg-dim mb-3">
        <span>{strategy.timeframe === "any" ? "Any TF" : strategy.timeframe}</span>
        <span>·</span>
        <span className="capitalize">
          {strategy.assetCategory === "all" ? "All assets" : strategy.assetCategory}
        </span>
        {strategy.linkedCourseId && (
          <>
            <span>·</span>
            <span className="text-blue-400/60">🎓 Academy</span>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {saved && (
            <span className="text-xs text-success bg-success-soft border border-success/30 px-2 py-0.5 rounded-full">
              ✓ Saved
            </span>
          )}
          {inPlaybook && (
            <span className="text-xs text-accent-hover bg-accent/10 border border-accent/30 px-2 py-0.5 rounded-full">
              📋 Playbook
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {strategy._count.reviews > 0 && (
            <span className="text-xs text-fg-dim">
              {strategy._count.reviews} review{strategy._count.reviews > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-fg-dim bg-elevated border border-border px-2 py-0.5 rounded-full">
            {strategy.pricingModel === "FREE" ? "Free" : `$${strategy.price}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Publish Form ──────────────────────────────────────────────────────────

function PublishForm({ onClose }: { onClose: () => void }) {
  const { createStrategy } = useStrategyStore();
  const { addNotification } = useNotificationStore();

  const [form, setForm] = useState({
    title:            "",
    description:      "",
    assetCategory:    "all",
    timeframe:        "H1",
    riskLevel:        "MEDIUM" as StrategyRiskLevel,
    rules:            "",
    entryConditions:  "",
    exitConditions:   "",
    riskManagement:   "",
    tags:             "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePublish = async () => {
    if (!form.title || !form.description) return;
    setIsSubmitting(true);

    // Normal users can only publish CREATOR_PUBLISHED strategies — author,
    // verification, and featured status are all derived server-side.
    const created = await createStrategy({
      title:            form.title,
      description:      form.description,
      type:             "CREATOR_PUBLISHED",
      asset:            "All",
      assetCategory:    form.assetCategory,
      timeframe:        form.timeframe,
      riskLevel:        form.riskLevel,
      pricingModel:     "FREE" as StrategyPricing,
      price:            0,
      rules:            form.rules.split("\n").filter(Boolean),
      entryConditions:  form.entryConditions.split("\n").filter(Boolean),
      exitConditions:   form.exitConditions.split("\n").filter(Boolean),
      riskManagement:   form.riskManagement.split("\n").filter(Boolean),
      tags:             form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      version:          "1.0",
      disclaimer:       "Creator-published strategy. Not independently verified. For educational and paper trading use only.",
    });

    setIsSubmitting(false);
    if (!created) return;

    addNotification({
      type:     "system",
      priority: "low",
      title:    "✅ Strategy Published",
      message:  `"${form.title}" is now visible in the Marketplace.`,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#111217] border border-border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-fg font-bold">Publish Strategy</h2>
            <p className="text-fg-dim text-xs mt-0.5">
              Creator-published · Not verified
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-fg-dim hover:text-fg text-xl w-7 h-7 flex items-center justify-center">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">

          <div>
            <p className="text-fg-dim text-xs mb-1">Title *</p>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Strategy name..."
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs focus:outline-none focus:border-border"
            />
          </div>

          <div>
            <p className="text-fg-dim text-xs mb-1">Description *</p>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What is this strategy about?"
              rows={3}
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs resize-none focus:outline-none focus:border-border"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-fg-dim text-xs mb-1">Asset Category</p>
              <select
                value={form.assetCategory}
                onChange={(e) => setForm({ ...form, assetCategory: e.target.value })}
                className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs">
                <option value="all">All</option>
                <option value="crypto">Crypto</option>
                <option value="forex">Forex</option>
                <option value="commodity">Commodity</option>
                <option value="index">Index</option>
              </select>
            </div>

            <div>
              <p className="text-fg-dim text-xs mb-1">Timeframe</p>
              <select
                value={form.timeframe}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs">
                {["M5", "M15", "M30", "H1", "H4", "D1"].map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-fg-dim text-xs mb-1">Risk Level</p>
              <select
                value={form.riskLevel}
                onChange={(e) =>
                  setForm({ ...form, riskLevel: e.target.value as StrategyRiskLevel })
                }
                className="w-full bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>

          {[
            { label: "Rules (one per line)", key: "rules" as const,           placeholder: "Rule 1\nRule 2"   },
            { label: "Entry Conditions",     key: "entryConditions" as const, placeholder: "Condition 1\n..."  },
            { label: "Exit Conditions",      key: "exitConditions" as const,  placeholder: "Exit 1\n..."       },
            { label: "Risk Management",      key: "riskManagement" as const,  placeholder: "Risk rule 1\n..." },
          ].map((f) => (
            <div key={f.key}>
              <p className="text-fg-dim text-xs mb-1">{f.label}</p>
              <textarea
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                rows={2}
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs resize-none focus:outline-none focus:border-border"
              />
            </div>
          ))}

          <div>
            <p className="text-fg-dim text-xs mb-1">Tags (comma separated)</p>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="SMC, XAUUSD, breakout"
              className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-xs focus:outline-none focus:border-border"
            />
          </div>

          <div className="bg-warning-soft border border-warning/30 rounded-xl p-3">
            <p className="text-warning/80 text-xs leading-relaxed">
              Your strategy will be published and labeled "Creator Published — Educational
              only, not verified." No performance claims will be added automatically.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-elevated text-fg-dim border border-border py-2.5 rounded-xl text-sm">
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={!form.title || !form.description || isSubmitting}
              className="flex-1 bg-success-soft text-success border border-success/30 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-success/22 transition">
              {isSubmitting ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { strategies, savedStrategies, getSavedStrategies, isLoading, isInitialized, error } = useStrategyStore();

  const [activeTab,   setActiveTab]   = useState<FilterTab>("all");
  const [filterRisk,  setFilterRisk]  = useState<string>("all");
  const [filterAsset, setFilterAsset] = useState<string>("all");
  const [filterTF,    setFilterTF]    = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);

  useEffect(() => {
    getSavedStrategies();
  }, [getSavedStrategies]);

  // Filter strategies
  const filtered = useMemo<Strategy[]>(() => {
    let list = activeTab === "saved" ? [...savedStrategies] : [...strategies];

    if (activeTab !== "all" && activeTab !== "saved") {
      list = list.filter((s) => s.type === activeTab);
    }

    if (filterRisk  !== "all") list = list.filter((s) => s.riskLevel === filterRisk);
    if (filterAsset !== "all") list = list.filter((s) => s.assetCategory === filterAsset || s.assetCategory === "all");
    if (filterTF    !== "all") list = list.filter((s) => s.timeframe === filterTF || s.timeframe === "any");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Featured first
    return [...list].sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }, [strategies, savedStrategies, activeTab, filterRisk, filterAsset, filterTF, searchQuery]);

  const selectedStrategy =
    strategies.find((s) => s.id === selectedId) ?? savedStrategies.find((s) => s.id === selectedId);

  // Tab counts
  const savedCount    = savedStrategies.length;
  const officialCount = strategies.filter((s) => s.type === "OFFICIAL").length;
  const templateCount = strategies.filter((s) => s.type === "EDUCATIONAL_TEMPLATE").length;
  const creatorCount  = strategies.filter((s) => s.type === "CREATOR_PUBLISHED").length;

  const tabConfig: { key: FilterTab; label: string }[] = [
    { key: "all",                  label: `All (${strategies.length})`  },
    { key: "OFFICIAL",             label: `Official (${officialCount})` },
    { key: "EDUCATIONAL_TEMPLATE", label: `Templates (${templateCount})` },
    { key: "CREATOR_PUBLISHED",    label: `Creator (${creatorCount})`   },
    { key: "saved",                label: `Saved (${savedCount})`        },
  ];

  if (!isInitialized || isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-fg-dim text-sm animate-pulse">Loading marketplace...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-danger text-sm">{error}</p>
        <button
          type="button"
          onClick={() => useStrategyStore.getState().init()}
          className="text-fg-dim text-xs border border-border px-3 py-1 rounded hover:text-fg-muted hover:border-border-strong transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
        <div className="flex flex-1 overflow-hidden">

          {/* Left — strategy list */}
          <div className={`flex flex-col overflow-hidden ${selectedStrategy ? "w-96 shrink-0 border-r border-border" : "flex-1"}`}>

            {/* Header */}
            <div className="px-6 py-5 border-b border-border shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-xl font-bold text-fg">🏪 Strategy Marketplace</h1>
                  <p className="text-fg-dim text-xs mt-0.5">
                    Official TCC templates and educational frameworks. No fake performance claims.
                  </p>
                </div>
                <button
                  onClick={() => setShowPublish(true)}
                  className="bg-success-soft text-success border border-success/30 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-success/22 transition shrink-0 ml-3">
                  + Publish
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-0.5 bg-elevated rounded-lg p-1 mb-3 overflow-x-auto">
                {tabConfig.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                      activeTab === tab.key
                        ? "bg-success-soft text-success"
                        : "text-fg-dim hover:text-fg-muted"
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search strategies..."
                className="w-full bg-elevated border border-border rounded-lg px-3 py-1.5 text-fg text-xs focus:outline-none focus:border-border placeholder-white/20 mb-2"
              />

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterRisk}
                  onChange={(e) => setFilterRisk(e.target.value)}
                  className="bg-elevated border border-border rounded-lg px-2 py-1 text-fg text-xs flex-1 min-w-0">
                  <option value="all">All risk</option>
                  <option value="LOW">Low risk</option>
                  <option value="MEDIUM">Medium risk</option>
                  <option value="HIGH">High risk</option>
                </select>

                <select
                  value={filterAsset}
                  onChange={(e) => setFilterAsset(e.target.value)}
                  className="bg-elevated border border-border rounded-lg px-2 py-1 text-fg text-xs flex-1 min-w-0">
                  <option value="all">All assets</option>
                  <option value="crypto">Crypto</option>
                  <option value="forex">Forex</option>
                  <option value="commodity">Commodity</option>
                  <option value="index">Index</option>
                </select>

                <select
                  value={filterTF}
                  onChange={(e) => setFilterTF(e.target.value)}
                  className="bg-elevated border border-border rounded-lg px-2 py-1 text-fg text-xs flex-1 min-w-0">
                  <option value="all">All TF</option>
                  {["M5", "M15", "H1", "H4", "D1"].map((tf) => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Strategy grid */}
            <div className="flex-1 overflow-y-auto p-4">

              {/* Educational disclaimer banner */}
              {(activeTab === "all" || activeTab === "EDUCATIONAL_TEMPLATE") && (
                <div className="bg-accent/5 border border-accent/30 rounded-xl p-3 mb-4">
                  <p className="text-accent-hover/70 text-xs leading-relaxed">
                    <strong>📖 Educational Note:</strong> All educational templates are for learning only.
                    No performance data is verified. Paper trade extensively before considering real capital.
                  </p>
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-3xl mb-3">🏪</p>
                    <p className="text-fg-dim text-sm">
                      {activeTab === "saved"
                        ? "No saved strategies yet"
                        : "No strategies match your filters"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-4 ${selectedStrategy ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"}`}>
                  {filtered.map((strategy) => (
                    <StrategyCard
                      key={strategy.id}
                      strategy={strategy}
                      onClick={() => setSelectedId(strategy.id)}
                    />
                  ))}
                </div>
              )}

              {/* Footer disclaimer */}
              <div className="mt-6 p-4 bg-elevated border border-border rounded-xl">
                <p className="text-fg-dim text-xs leading-relaxed">
                  <strong className="text-fg-dim">TCC Strategy Marketplace —</strong>{" "}
                  All strategies are saved to your account. No payment processing connected.
                  Strategy performance data is either educational (theoretical) or self-reported.
                  Real trading involves substantial risk of loss.
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

      {showPublish && <PublishForm onClose={() => setShowPublish(false)} />}
    </>
  );
}
