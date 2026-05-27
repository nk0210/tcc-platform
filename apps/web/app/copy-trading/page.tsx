"use client";
import { useState } from "react";
import { useCopyTradingStore, MasterTrader, CopyMode } from "@/store/copyTradingStore";
import { useAuthStore } from "@/store/authStore";
import { useTradeStore } from "@/store/tradeStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

const trustScoreColor = (score: number) =>
  score >= 90 ? "text-green-400" : score >= 75 ? "text-amber-400" : "text-red-400";

const trustScoreBg = (score: number) =>
  score >= 90 ? "bg-green-500/10 border-green-500/20" : score >= 75 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

export default function CopyTradingPage() {
  const { masters, relationships, copyTrades, setupRelationship, updateRelationshipStatus, calculateFollowerLot } = useCopyTradingStore();
  const { user } = useAuthStore();
  const { balance } = useTradeStore();

  const [selectedMaster, setSelectedMaster] = useState<MasterTrader | null>(null);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"discover" | "active" | "history">("discover");
  const [consentChecked, setConsentChecked] = useState(false);

  const [form, setForm] = useState({
    copyMode: "auto" as CopyMode,
    capitalAllocation: 1000,
    riskPercent: 1,
    maxLot: 0.10,
    maxDailyLoss: 5,
    maxOpenTrades: 3,
    copyMultiplier: 0.1,
    minRR: 1.5,
  });

  const activeRelationships = relationships.filter(r => r.followerId === (user?.id || "guest"));
  const myRelationshipHandles = new Set(activeRelationships.map(r => r.masterHandle));

  const handleSetup = () => {
    if (!selectedMaster || !consentChecked) return;

    // Check broker match
    if (selectedMaster.broker !== "TCC Paper") {
      alert(`${selectedMaster.handle} uses a different broker. Connect their broker to copy.`);
      return;
    }

    setupRelationship({
      followerId: user?.id || "guest",
      followerHandle: user?.handle || "guest",
      masterId: selectedMaster.id,
      masterHandle: selectedMaster.handle,
      status: "active",
      broker: "TCC Paper",
      ...form,
    });

    setShowConsentModal(false);
    setShowSetupForm(false);
    setSelectedMaster(null);
    setConsentChecked(false);
    setActiveTab("active");
  };

  // Simulate a copy trade execution
  const simulateCopyTrade = (masterHandle: string) => {
    const rel = activeRelationships.find(r => r.masterHandle === masterHandle);
    const master = masters.find(m => m.handle === masterHandle);
    if (!rel || !master) return;

    const masterLot = 0.5;
    const entryPrice = 77500;
    const sl = 77200;
    const tp = 78100;
    const slDistance = Math.abs(entryPrice - sl);
    const rrRatio = Math.abs(tp - entryPrice) / slDistance;

    const calc = calculateFollowerLot(master, rel, masterLot, slDistance, entryPrice);

    const checks = [
      { check: rel.broker === master.broker, reason: "Different broker" },
      { check: rel.status === "active", reason: "Relationship not active" },
      { check: calc.finalLot >= 0.01, reason: "Lot too small" },
      { check: rrRatio >= rel.minRR, reason: `RR ${rrRatio.toFixed(1)} below minimum ${rel.minRR}` },
      { check: activeRelationships.length <= rel.maxOpenTrades, reason: "Max open trades reached" },
    ];

    const failed = checks.find(c => !c.check);

    const { addCopyTrade } = useCopyTradingStore.getState();
    addCopyTrade({
      masterId: master.id,
      masterHandle: master.handle,
      symbol: "BTCUSDT",
      direction: "BUY",
      masterLot,
      followerLot: calc.finalLot,
      entryPrice,
      sl,
      tp,
      rrRatio: parseFloat(rrRatio.toFixed(2)),
      slDistance,
      riskAmount: calc.riskAmount,
      status: failed ? "blocked" : "copied",
      blockReason: failed?.reason,
      pnl: failed ? undefined : parseFloat((Math.random() * 20 - 5).toFixed(2)),
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">📡 Copy Trading</h1>
              <p className="text-white/40 text-sm mt-1">Follow verified master traders. All trades copied with full risk control.</p>
            </div>
            {user?.tccId && (
              <div className="glass border border-white/10 rounded-xl px-4 py-2 text-right">
                <p className="text-white/40 text-xs">Your TCC ID</p>
                <p className="text-green-400 font-mono font-bold text-sm">{user.tccId}</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-6">
            {(["discover", "active", "history"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                {tab === "discover" ? "🔍 Discover Masters" : tab === "active" ? `⚡ Active (${activeRelationships.length})` : "📋 History"}
              </button>
            ))}
          </div>

          {/* Discover */}
          {activeTab === "discover" && (
            <div className="grid grid-cols-2 gap-4">
              {masters.map((master) => {
                const isFollowing = myRelationshipHandles.has(master.handle);
                return (
                  <div key={master.id} className="glass border border-white/5 rounded-xl p-5 hover:border-white/10 transition">

                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xl font-bold">
                          {master.handle[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{master.handle}</span>
                            {master.verified && <span className="text-green-400 text-xs">✓</span>}
                          </div>
                          <p className="text-white/40 text-xs">{master.tccId}</p>
                          <p className="text-white/30 text-xs">{master.specialty} specialist</p>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg border text-xs font-bold ${trustScoreBg(master.traderTrustScore)}`}>
                        <span className={trustScoreColor(master.traderTrustScore)}>
                          Trust: {master.traderTrustScore}/100
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[
                        { label: "Win Rate", value: `${master.winRate}%`, color: master.winRate >= 60 ? "text-green-400" : "text-amber-400" },
                        { label: "Monthly", value: `+${master.monthlyReturn}%`, color: "text-green-400" },
                        { label: "Drawdown", value: `${master.maxDrawdown}%`, color: master.maxDrawdown < 5 ? "text-green-400" : "text-amber-400" },
                        { label: "Followers", value: master.followers, color: "text-white" },
                      ].map(stat => (
                        <div key={stat.label} className="glass border border-white/5 rounded-lg p-2 text-center">
                          <p className="text-white/30 text-xs">{stat.label}</p>
                          <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-white/40 text-xs">Trader Trust Score</span>
                        <span className={`text-xs font-bold ${trustScoreColor(master.traderTrustScore)}`}>{master.traderTrustScore}/100</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${master.traderTrustScore >= 90 ? "bg-green-400" : master.traderTrustScore >= 75 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${master.traderTrustScore}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/10">
                          {master.broker}
                        </span>
                        <span className="text-xs text-white/30">{master.totalTrades} trades</span>
                      </div>
                      {isFollowing ? (
                        <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-lg">
                          ✓ Following
                        </span>
                      ) : (
                        <button
                          onClick={() => { setSelectedMaster(master); setShowSetupForm(true); }}
                          className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-4 py-1.5 rounded-lg text-xs font-semibold transition">
                          + Follow & Copy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Active Relationships */}
          {activeTab === "active" && (
            <div className="flex flex-col gap-4">
              {activeRelationships.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-5xl mb-3">📡</p>
                    <p className="text-white/40">No active copy relationships</p>
                    <p className="text-white/20 text-sm mt-1">Go to Discover to follow a master trader</p>
                  </div>
                </div>
              ) : (
                activeRelationships.map(rel => {
                  const master = masters.find(m => m.handle === rel.masterHandle);
                  const relTrades = copyTrades.filter(t => t.masterHandle === rel.masterHandle);
                  return (
                    <div key={rel.id} className="glass border border-white/5 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 font-bold">
                            {rel.masterHandle[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-semibold">{rel.masterHandle}</p>
                            <p className="text-white/40 text-xs">Since {new Date(rel.consentedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full border ${rel.status === "active" ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20"}`}>
                            {rel.status === "active" ? "🟢 Active" : "⏸ Paused"}
                          </span>
                          <button
                            onClick={() => updateRelationshipStatus(rel.id, rel.status === "active" ? "paused" : "active")}
                            className="bg-white/5 hover:bg-white/10 text-white/50 text-xs px-3 py-1 rounded-lg border border-white/10 transition">
                            {rel.status === "active" ? "Pause" : "Resume"}
                          </button>
                          <button
                            onClick={() => simulateCopyTrade(rel.masterHandle)}
                            className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-xs px-3 py-1 rounded-lg border border-indigo-500/20 transition">
                            🧪 Simulate Trade
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-6 gap-3 mb-4">
                        {[
                          { label: "Allocation", value: `$${rel.capitalAllocation}` },
                          { label: "Risk/Trade", value: `${rel.riskPercent}%` },
                          { label: "Max Lot", value: rel.maxLot },
                          { label: "Copy Mode", value: rel.copyMode },
                          { label: "Min R:R", value: rel.minRR },
                          { label: "Max Trades", value: rel.maxOpenTrades },
                        ].map(item => (
                          <div key={item.label} className="glass border border-white/5 rounded-lg p-2">
                            <p className="text-white/30 text-xs">{item.label}</p>
                            <p className="text-white text-sm font-semibold capitalize">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {relTrades.length > 0 && (
                        <div>
                          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Recent Copy Trades</p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-white/30">
                                <th className="text-left py-1">Symbol</th>
                                <th className="text-left py-1">Dir</th>
                                <th className="text-left py-1">Master Lot</th>
                                <th className="text-left py-1">Your Lot</th>
                                <th className="text-left py-1">R:R</th>
                                <th className="text-left py-1">Risk $</th>
                                <th className="text-left py-1">Status</th>
                                <th className="text-left py-1">P&L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {relTrades.map(t => (
                                <tr key={t.id} className="border-t border-white/5">
                                  <td className="py-2 text-white font-semibold">{t.symbol}</td>
                                  <td className={`py-2 font-semibold ${t.direction === "BUY" ? "text-green-400" : "text-red-400"}`}>{t.direction}</td>
                                  <td className="py-2 text-white/60">{t.masterLot}</td>
                                  <td className="py-2 text-white/60">{t.followerLot}</td>
                                  <td className="py-2 text-white/60">1:{t.rrRatio}</td>
                                  <td className="py-2 text-white/60">${t.riskAmount}</td>
                                  <td className="py-2">
                                    {t.status === "copied" ? (
                                      <span className="text-green-400">✓ Copied</span>
                                    ) : t.status === "blocked" ? (
                                      <span className="text-red-400" title={t.blockReason}>⛔ {t.blockReason}</span>
                                    ) : (
                                      <span className="text-amber-400">{t.status}</span>
                                    )}
                                  </td>
                                  <td className={`py-2 font-bold ${(t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {t.pnl !== undefined ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl}` : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* History */}
          {activeTab === "history" && (
            <div className="glass border border-white/5 rounded-xl overflow-hidden">
              {copyTrades.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <p className="text-white/20">No copy trade history yet</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2">
                      <th className="text-left px-4 py-3 text-white/40">Master</th>
                      <th className="text-left px-4 py-3 text-white/40">Symbol</th>
                      <th className="text-left px-4 py-3 text-white/40">Dir</th>
                      <th className="text-left px-4 py-3 text-white/40">Master Lot</th>
                      <th className="text-left px-4 py-3 text-white/40">Your Lot</th>
                      <th className="text-left px-4 py-3 text-white/40">R:R</th>
                      <th className="text-left px-4 py-3 text-white/40">Risk</th>
                      <th className="text-left px-4 py-3 text-white/40">Status</th>
                      <th className="text-left px-4 py-3 text-white/40">P&L</th>
                      <th className="text-left px-4 py-3 text-white/40">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {copyTrades.map(t => (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="px-4 py-3 text-white font-semibold">{t.masterHandle}</td>
                        <td className="px-4 py-3 text-white">{t.symbol}</td>
                        <td className={`px-4 py-3 font-semibold ${t.direction === "BUY" ? "text-green-400" : "text-red-400"}`}>{t.direction}</td>
                        <td className="px-4 py-3 text-white/60">{t.masterLot}</td>
                        <td className="px-4 py-3 text-white/60">{t.followerLot}</td>
                        <td className="px-4 py-3 text-white/60">1:{t.rrRatio}</td>
                        <td className="px-4 py-3 text-white/60">${t.riskAmount}</td>
                        <td className="px-4 py-3">
                          {t.status === "copied" ? <span className="text-green-400">✓ Copied</span>
                            : t.status === "blocked" ? <span className="text-red-400">⛔ Blocked</span>
                            : <span className="text-amber-400">{t.status}</span>}
                        </td>
                        <td className={`px-4 py-3 font-bold ${(t.pnl || 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {t.pnl !== undefined ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-white/30">{new Date(t.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Setup Form Modal */}
      {showSetupForm && selectedMaster && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-bold text-lg">Copy Setup — {selectedMaster.handle}</h2>
                <p className="text-white/40 text-xs mt-1">{selectedMaster.tccId}</p>
              </div>
              <button onClick={() => { setShowSetupForm(false); setSelectedMaster(null); }}
                className="text-white/30 hover:text-white text-xl">✕</button>
            </div>

            <div className="glass border border-white/5 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-white/30 text-xs">Win Rate</p><p className="text-green-400 font-bold">{selectedMaster.winRate}%</p></div>
                <div><p className="text-white/30 text-xs">Trust Score</p><p className={`font-bold ${trustScoreColor(selectedMaster.traderTrustScore)}`}>{selectedMaster.traderTrustScore}/100</p></div>
                <div><p className="text-white/30 text-xs">Max DD</p><p className="text-amber-400 font-bold">{selectedMaster.maxDrawdown}%</p></div>
              </div>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              <div>
                <p className="text-white/40 text-xs mb-1">Copy Mode</p>
                <div className="flex gap-2">
                  {(["auto", "manual", "notify"] as CopyMode[]).map(mode => (
                    <button key={mode} onClick={() => setForm({ ...form, copyMode: mode })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border capitalize transition ${form.copyMode === mode ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                      {mode === "auto" ? "⚡ Auto" : mode === "manual" ? "✋ Manual" : "🔔 Notify"}
                    </button>
                  ))}
                </div>
                <p className="text-white/20 text-xs mt-1">
                  {form.copyMode === "auto" ? "Trades copied instantly" : form.copyMode === "manual" ? "You approve each trade" : "Get notified, you decide"}
                </p>
              </div>

              {[
                { label: "Capital Allocation ($)", key: "capitalAllocation", min: 100, max: balance, step: 100 },
                { label: "Risk per Trade (%)", key: "riskPercent", min: 0.1, max: 5, step: 0.1 },
                { label: "Max Lot Size", key: "maxLot", min: 0.01, max: 1, step: 0.01 },
                { label: "Max Daily Loss (%)", key: "maxDailyLoss", min: 1, max: 10, step: 0.5 },
                { label: "Max Open Trades", key: "maxOpenTrades", min: 1, max: 10, step: 1 },
                { label: "Copy Multiplier", key: "copyMultiplier", min: 0.01, max: 2, step: 0.01 },
                { label: "Minimum R:R", key: "minRR", min: 0.5, max: 5, step: 0.5 },
              ].map(field => (
                <div key={field.key}>
                  <div className="flex justify-between mb-1">
                    <p className="text-white/40 text-xs">{field.label}</p>
                    <p className="text-white text-xs font-semibold">{(form as any)[field.key]}</p>
                  </div>
                  <input type="range" min={field.min} max={field.max} step={field.step}
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: parseFloat(e.target.value) })}
                    className="w-full accent-green-400" />
                </div>
              ))}
            </div>

            <div className="glass border border-amber-500/20 bg-amber-500/5 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)}
                  className="mt-1 accent-green-400" />
                <p className="text-white/60 text-xs leading-relaxed">
                  I understand that copy trading involves risk. Past performance of {selectedMaster.handle} does not guarantee future results.
                  I am using paper/demo trading. TCC is not responsible for any losses. I have read and agree to the copy trading terms.
                  My TCC ID <span className="text-green-400">{user?.tccId || "TCC-GL-TRD-XXXXXXXX"}</span> will be linked to this copy relationship.
                </p>
              </div>
            </div>

            <button onClick={() => { if (consentChecked) { setShowSetupForm(false); setShowConsentModal(true); } }}
              disabled={!consentChecked}
              className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40">
              Confirm & Start Copying
            </button>
          </div>
        </div>
      )}

      {/* Final Confirm Modal */}
      {showConsentModal && selectedMaster && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="glass border border-green-500/20 rounded-2xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-4">📡</p>
            <h2 className="text-white font-bold text-lg mb-2">Ready to Copy</h2>
            <p className="text-white/50 text-sm mb-4">
              You're about to start copying <span className="text-green-400 font-semibold">{selectedMaster.handle}</span> with ${form.capitalAllocation} allocation in {form.copyMode} mode.
            </p>
            <div className="glass border border-white/5 rounded-lg p-3 mb-4 text-left text-xs">
              <div className="flex justify-between mb-1"><span className="text-white/40">Lot method</span><span className="text-white">MIN(proportional, risk-based, multiplier)</span></div>
              <div className="flex justify-between mb-1"><span className="text-white/40">Risk/trade</span><span className="text-white">{form.riskPercent}% = ${(form.capitalAllocation * form.riskPercent / 100).toFixed(2)}</span></div>
              <div className="flex justify-between mb-1"><span className="text-white/40">Max lot</span><span className="text-white">{form.maxLot}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Min R:R</span><span className="text-white">1:{form.minRR}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowConsentModal(false); setShowSetupForm(true); }}
                className="flex-1 bg-white/5 text-white/50 py-2 rounded-lg text-sm border border-white/10">
                Back
              </button>
              <button onClick={handleSetup}
                className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-2 rounded-lg text-sm font-semibold">
                ✓ Start Copying
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}