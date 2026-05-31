"use client";
import { useState } from "react";
import { useStrategyStore, Strategy, StrategyAsset, StrategyRisk } from "@/store/strategyStore";
import { useAuthStore } from "@/store/authStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

const riskColors: Record<StrategyRisk, string> = {
  LOW: "text-green-400 bg-green-500/10 border-green-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  HIGH: "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function MarketplacePage() {
  const { strategies, userStrategies, purchaseStrategy, addReview } = useStrategyStore();
  const { user } = useAuthStore();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [activeTab, setActiveTab] = useState<"browse" | "owned">("browse");
  const [filterAsset, setFilterAsset] = useState<string>("ALL");
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  const filteredStrategies = strategies.filter(s => {
    if (activeTab === "owned") return s.purchased;
    if (filterAsset !== "ALL" && s.asset !== filterAsset) return false;
    if (filterRisk !== "ALL" && s.riskLevel !== filterRisk) return false;
    return true;
  });

  const avgRating = (strategy: Strategy) => {
    if (strategy.reviews.length === 0) return 0;
    return (strategy.reviews.reduce((s, r) => s + r.rating, 0) / strategy.reviews.length).toFixed(1);
  };

  if (selectedStrategy) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <button onClick={() => setSelectedStrategy(null)} className="text-white/40 hover:text-white text-sm mb-4 transition">← Back to Marketplace</button>

              {/* Strategy Header */}
              <div className="glass border border-white/5 rounded-xl p-6 mb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${riskColors[selectedStrategy.riskLevel]}`}>{selectedStrategy.riskLevel} RISK</span>
                      <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">{selectedStrategy.asset}</span>
                      <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">{selectedStrategy.timeframe}</span>
                      {selectedStrategy.verified && <span className="text-xs text-green-400">✓ Verified Backtest</span>}
                      <span className="text-xs text-white/30">{selectedStrategy.version}</span>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-1">{selectedStrategy.title}</h1>
                    <p className="text-white/40 text-xs">by {selectedStrategy.authorHandle} · {selectedStrategy.authorTccId}</p>
                  </div>
                  <div className="text-right">
                    {selectedStrategy.pricingModel === "free" ? (
                      <p className="text-green-400 text-2xl font-bold">FREE</p>
                    ) : (
                      <>
                        <p className="text-white text-2xl font-bold">${selectedStrategy.price}</p>
                        <p className="text-white/30 text-xs">{selectedStrategy.pricingModel}</p>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-white/60 text-sm leading-relaxed mb-4">{selectedStrategy.description}</p>

                <div className="grid grid-cols-5 gap-3 mb-4">
                  {[
                    { label: "Win Rate", value: `${selectedStrategy.winRate}%`, color: selectedStrategy.winRate >= 60 ? "text-green-400" : "text-amber-400" },
                    { label: "Profit Factor", value: selectedStrategy.profitFactor, color: "text-white" },
                    { label: "Avg R:R", value: selectedStrategy.avgRR, color: "text-amber-400" },
                    { label: "Max DD", value: `${selectedStrategy.maxDrawdown}%`, color: selectedStrategy.maxDrawdown < 5 ? "text-green-400" : "text-amber-400" },
                    { label: "Monthly", value: `+${selectedStrategy.monthlyReturn}%`, color: "text-green-400" },
                  ].map(stat => (
                    <div key={stat.label} className="glass border border-white/5 rounded-lg p-3 text-center">
                      <p className="text-white/30 text-xs mb-1">{stat.label}</p>
                      <p className={`font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {!selectedStrategy.purchased ? (
                  <button onClick={() => purchaseStrategy(selectedStrategy.id)}
                    className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm font-semibold transition">
                    {selectedStrategy.pricingModel === "free" ? "✓ Add to My Strategies (Free)" : `Purchase — $${selectedStrategy.price}`}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-green-500/10 text-green-400 border border-green-500/20 py-3 rounded-xl text-sm font-semibold text-center">
                      ✓ Purchased — Applied to Dashboard
                    </div>
                    <button onClick={() => setShowReviewForm(true)}
                      className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-3 rounded-xl text-sm font-semibold hover:bg-indigo-500/30 transition">
                      ⭐ Review
                    </button>
                  </div>
                )}
              </div>

              {/* Rules */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">📋 Rules</p>
                  {selectedStrategy.rules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2">
                      <span className="text-green-400 text-xs mt-0.5">✓</span>
                      <p className="text-white/60 text-xs">{rule}</p>
                    </div>
                  ))}
                </div>
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">🎯 Entry Conditions</p>
                  {selectedStrategy.entryConditions.map((cond, i) => (
                    <div key={i} className="flex items-start gap-2 mb-2">
                      <span className="text-blue-400 text-xs mt-0.5">{i + 1}.</span>
                      <p className="text-white/60 text-xs">{cond}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass border border-white/5 rounded-xl p-5 mb-4">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">🚪 Exit Conditions</p>
                <div className="flex flex-col gap-2">
                  {selectedStrategy.exitConditions.map((cond, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-red-400 text-xs mt-0.5">→</span>
                      <p className="text-white/60 text-xs">{cond}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              <div className="glass border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                    ⭐ Reviews ({selectedStrategy.reviews.length})
                    {selectedStrategy.reviews.length > 0 && ` · ${avgRating(selectedStrategy)} avg`}
                  </p>
                </div>
                {selectedStrategy.reviews.length === 0 ? (
                  <p className="text-white/20 text-xs">No reviews yet. Be the first!</p>
                ) : (
                  selectedStrategy.reviews.map(review => (
                    <div key={review.id} className="border-b border-white/5 pb-3 mb-3 last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/70 text-xs font-semibold">{review.handle}</span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={i < review.rating ? "text-amber-400" : "text-white/20"}>★</span>
                          ))}
                        </div>
                      </div>
                      <p className="text-white/50 text-xs">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Review Form */}
              {showReviewForm && (
                <div className="glass border border-white/10 rounded-xl p-5 mt-4">
                  <p className="text-white font-semibold mb-3">Write a Review</p>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button key={star} onClick={() => setReviewForm({ ...reviewForm, rating: star })}>
                        <span className={`text-2xl ${star <= reviewForm.rating ? "text-amber-400" : "text-white/20"}`}>★</span>
                      </button>
                    ))}
                  </div>
                  <textarea value={reviewForm.comment}
                    onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    placeholder="Share your experience with this strategy..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none h-20 mb-3" />
                  <button onClick={() => {
                    addReview(selectedStrategy.id, { handle: user?.handle || "guest", rating: reviewForm.rating, comment: reviewForm.comment });
                    setShowReviewForm(false);
                    setReviewForm({ rating: 5, comment: "" });
                  }}
                    className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-4 py-2 rounded-lg text-sm font-semibold">
                    Submit Review
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">🏪 Strategy Marketplace</h1>
              <p className="text-white/40 text-sm mt-1">Verified backtested strategies from pro traders. No fake screenshots.</p>
            </div>
            <button onClick={() => setShowPublish(true)}
              className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-500/30 transition">
              + Publish Strategy
            </button>
          </div>

          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-4">
            {(["browse", "owned"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                {tab === "browse" ? "🔍 Browse All" : `📦 My Strategies (${userStrategies.length})`}
              </button>
            ))}
          </div>

          {activeTab === "browse" && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <select value={filterAsset} onChange={e => setFilterAsset(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs">
                <option value="ALL">All Assets</option>
                {["XAUUSD", "EURUSD", "BTCUSDT", "GBPUSD", "NASDAQ"].map(a => (
                  <option key={a} value={a} className="bg-[#0a0a0f]">{a}</option>
                ))}
              </select>
              <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs">
                <option value="ALL">All Risk Levels</option>
                {["LOW", "MEDIUM", "HIGH"].map(r => (
                  <option key={r} value={r} className="bg-[#0a0a0f]">{r}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {filteredStrategies.map(strategy => (
              <div key={strategy.id}
                onClick={() => setSelectedStrategy(strategy)}
                className="glass border border-white/5 rounded-xl p-5 cursor-pointer hover:border-white/15 transition">

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${riskColors[strategy.riskLevel]}`}>{strategy.riskLevel}</span>
                    <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">{strategy.asset}</span>
                    <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">{strategy.timeframe}</span>
                    {strategy.verified && <span className="text-xs text-green-400">✓</span>}
                  </div>
                  <div className="text-right shrink-0">
                    {strategy.pricingModel === "free"
                      ? <span className="text-green-400 font-bold text-sm">FREE</span>
                      : <span className="text-white font-bold text-sm">${strategy.price}</span>}
                    <p className="text-white/30 text-xs">{strategy.pricingModel}</p>
                  </div>
                </div>

                <h3 className="text-white font-semibold text-sm mb-1">{strategy.title}</h3>
                <p className="text-white/40 text-xs mb-3 line-clamp-2">{strategy.description}</p>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "WR", value: `${strategy.winRate}%`, color: strategy.winRate >= 60 ? "text-green-400" : "text-amber-400" },
                    { label: "PF", value: strategy.profitFactor, color: "text-white" },
                    { label: "RR", value: strategy.avgRR, color: "text-amber-400" },
                    { label: "DD", value: `${strategy.maxDrawdown}%`, color: strategy.maxDrawdown < 5 ? "text-green-400" : "text-amber-400" },
                  ].map(stat => (
                    <div key={stat.label} className="glass border border-white/5 rounded-lg p-1.5 text-center">
                      <p className="text-white/20 text-xs">{stat.label}</p>
                      <p className={`text-xs font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <span>👤 {strategy.authorHandle}</span>
                    {strategy.reviews.length > 0 && <span>⭐ {avgRating(strategy)}</span>}
                  </div>
                  {strategy.purchased
                    ? <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">✓ Owned</span>
                    : <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">View →</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPublish && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">Publish Strategy</h2>
              <button onClick={() => setShowPublish(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-white/40 text-sm">Strategy publishing coming in the next update. Your strategies will be verified against TCC backtest engine before listing.</p>
            <button onClick={() => setShowPublish(false)}
              className="mt-4 w-full bg-white/5 text-white/40 border border-white/10 py-2 rounded-lg text-sm">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}