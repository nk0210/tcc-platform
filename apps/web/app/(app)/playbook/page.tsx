"use client";
import { useState } from "react";
import { usePlaybookStore, PlaybookRule } from "@/store/playbookStore";

const categoryColors: Record<string, string> = {
  entry: "text-success bg-success-soft border-success/30",
  exit: "text-danger bg-danger-soft border-danger/30",
  risk: "text-warning bg-warning-soft border-warning/30",
  psychology: "text-accent-hover bg-accent/10 border-accent/30",
};

export default function PlaybookPage() {
  const { playbooks, activePlaybookId, toggleChecklistItem, resetChecklist, addRule, deleteRule, addChecklistItem, updatePlaybook } = usePlaybookStore();
  const [activeTab, setActiveTab] = useState<"checklist" | "rules" | "limits" | "stats">("checklist");
  const [newRule, setNewRule] = useState({ category: "entry" as PlaybookRule["category"], text: "" });
  const [newCheckItem, setNewCheckItem] = useState({ text: "", required: true });
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddCheck, setShowAddCheck] = useState(false);

  const playbook = playbooks.find(pb => pb.id === activePlaybookId)!;
  const checkedCount = playbook.checklist.filter(i => i.checked).length;
  const totalCount = playbook.checklist.length;
  const requiredCount = playbook.checklist.filter(i => i.required).length;
  const requiredChecked = playbook.checklist.filter(i => i.required && i.checked).length;
  const readyToTrade = requiredChecked === requiredCount;
  const checklistPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const allRules = [
    ...playbook.entryRules,
    ...playbook.exitRules,
    ...playbook.riskRules,
    ...playbook.psychologyRules,
  ];

  return (
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-fg">🎯 Playbook</h1>
              <p className="text-fg-dim text-sm mt-1">Your personal trading rulebook. Follow it. Every. Single. Trade.</p>
            </div>
            <div className={`px-4 py-2 rounded-xl border text-sm font-bold ${readyToTrade ? "bg-success-soft border-success/30 text-success" : "bg-danger-soft border-danger/30 text-danger"}`}>
              {readyToTrade ? "✅ Ready to Trade" : `❌ ${requiredCount - requiredChecked} required items unchecked`}
            </div>
          </div>

          {/* Playbook Header */}
          <div className="glass border border-border rounded-xl p-5 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-fg font-bold text-lg">{playbook.name}</h2>
                <p className="text-fg-dim text-sm mt-0.5">{playbook.description}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-elevated text-fg-dim border border-border px-2 py-0.5 rounded-full">{playbook.asset}</span>
                  <span className="text-xs bg-elevated text-fg-dim border border-border px-2 py-0.5 rounded-full">{playbook.timeframe}</span>
                  <span className="text-xs bg-elevated text-fg-dim border border-border px-2 py-0.5 rounded-full">{playbook.strategy}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-fg-dim text-xs">Adherence Score</p>
                <p className={`text-2xl font-bold ${playbook.adherenceScore >= 80 ? "text-success" : playbook.adherenceScore >= 60 ? "text-warning" : "text-danger"}`}>
                  {playbook.adherenceScore}%
                </p>
                <p className="text-fg-dim text-xs">{playbook.passedChecks}/{playbook.totalChecks} checks passed</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-elevated rounded-lg p-1 mb-6">
            {(["checklist", "rules", "limits", "stats"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-success-soft text-success" : "text-fg-dim"}`}>
                {tab === "checklist" ? `✅ Pre-Trade Checklist (${checkedCount}/${totalCount})` : tab === "rules" ? `📋 Rules (${allRules.length})` : tab === "limits" ? "🛡 Risk Limits" : "📊 Stats"}
              </button>
            ))}
          </div>

          {/* Checklist */}
          {activeTab === "checklist" && (
            <div className="max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 mr-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-fg-dim text-xs">Checklist Progress</span>
                    <span className={`text-xs font-bold ${readyToTrade ? "text-success" : "text-warning"}`}>{checklistPct}%</span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${readyToTrade ? "bg-success" : "bg-warning"}`} style={{ width: `${checklistPct}%` }} />
                  </div>
                </div>
                <button onClick={() => resetChecklist(playbook.id)}
                  className="bg-elevated text-fg-dim border border-border px-3 py-1.5 rounded-lg text-xs hover:bg-elevated transition">
                  Reset All
                </button>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                {playbook.checklist.map(item => (
                  <div key={item.id}
                    onClick={() => toggleChecklistItem(playbook.id, item.id)}
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${item.checked ? "bg-success-soft border-success/30" : "glass border-border hover:border-border"}`}>
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition ${item.checked ? "bg-success border-success" : "border-border-strong"}`}>
                      {item.checked && <span className="text-black text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${item.checked ? "text-fg-dim line-through" : "text-fg-muted"}`}>{item.text}</p>
                    </div>
                    {item.required && (
                      <span className="text-xs text-danger bg-danger-soft border border-danger/30 px-1.5 py-0.5 rounded-full shrink-0">Required</span>
                    )}
                  </div>
                ))}
              </div>

              {showAddCheck ? (
                <div className="glass border border-border rounded-xl p-4">
                  <input value={newCheckItem.text}
                    onChange={e => setNewCheckItem({ ...newCheckItem, text: e.target.value })}
                    placeholder="New checklist item..."
                    className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm mb-3" />
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 text-fg-dim text-xs cursor-pointer">
                      <input type="checkbox" checked={newCheckItem.required}
                        onChange={e => setNewCheckItem({ ...newCheckItem, required: e.target.checked })}
                        className="accent-green-400" />
                      Required
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { addChecklistItem(playbook.id, newCheckItem.text, newCheckItem.required); setNewCheckItem({ text: "", required: true }); setShowAddCheck(false); }}
                      className="bg-success-soft text-success border border-success/30 px-3 py-1.5 rounded-lg text-xs font-semibold">Add</button>
                    <button onClick={() => setShowAddCheck(false)} className="bg-elevated text-fg-dim px-3 py-1.5 rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddCheck(true)}
                  className="text-fg-dim text-xs hover:text-fg-muted transition">+ Add checklist item</button>
              )}
            </div>
          )}

          {/* Rules */}
          {activeTab === "rules" && (
            <div className="max-w-3xl">
              {(["entry", "exit", "risk", "psychology"] as const).map(category => {
                const rules = category === "entry" ? playbook.entryRules : category === "exit" ? playbook.exitRules : category === "risk" ? playbook.riskRules : playbook.psychologyRules;
                const labels = { entry: "🎯 Entry Rules", exit: "🚪 Exit Rules", risk: "🛡 Risk Rules", psychology: "🧠 Psychology Rules" };
                return (
                  <div key={category} className="glass border border-border rounded-xl p-5 mb-4">
                    <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">{labels[category]}</p>
                    <div className="flex flex-col gap-2 mb-3">
                      {rules.map(rule => (
                        <div key={rule.id} className="flex items-center gap-3 group">
                          <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${categoryColors[category]}`}>{category}</span>
                          <p className="text-fg-muted text-sm flex-1">{rule.rule}</p>
                          <button onClick={() => deleteRule(playbook.id, rule.id)}
                            className="text-fg-dim hover:text-danger text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
                        </div>
                      ))}
                    </div>
                    {showAddRule && newRule.category === category ? (
                      <div className="flex gap-2">
                        <input value={newRule.text}
                          onChange={e => setNewRule({ ...newRule, text: e.target.value })}
                          placeholder={`New ${category} rule...`}
                          className="flex-1 bg-elevated border border-border rounded-lg px-3 py-1.5 text-fg text-xs" />
                        <button onClick={() => { addRule(playbook.id, category, newRule.text); setNewRule({ category, text: "" }); setShowAddRule(false); }}
                          className="bg-success-soft text-success border border-success/30 px-3 py-1.5 rounded-lg text-xs">Add</button>
                        <button onClick={() => setShowAddRule(false)} className="bg-elevated text-fg-dim px-2 py-1.5 rounded-lg text-xs">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setShowAddRule(true); setNewRule({ category, text: "" }); }}
                        className="text-fg-dim text-xs hover:text-fg-muted transition">+ Add {category} rule</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Risk Limits */}
          {activeTab === "limits" && (
            <div className="max-w-2xl">
              <div className="glass border border-border rounded-xl p-6">
                <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-6">Risk Parameters</p>
                <div className="flex flex-col gap-6">
                  {[
                    { label: "Max Daily Loss (%)", key: "maxDailyLoss", min: 0.5, max: 10, step: 0.5, color: "accent-red-400", suffix: "%" },
                    { label: "Max Trades Per Day", key: "maxTradesPerDay", min: 1, max: 20, step: 1, color: "accent-amber-400", suffix: "" },
                    { label: "Max Lot Size", key: "maxLotSize", min: 0.01, max: 5, step: 0.01, color: "accent-amber-400", suffix: "" },
                    { label: "Minimum R:R Ratio", key: "minRR", min: 0.5, max: 5, step: 0.5, color: "accent-green-400", suffix: "" },
                  ].map(field => (
                    <div key={field.key}>
                      <div className="flex justify-between mb-2">
                        <p className="text-fg-muted text-sm">{field.label}</p>
                        <p className="text-fg font-bold">{(playbook as any)[field.key]}{field.suffix}</p>
                      </div>
                      <input type="range" min={field.min} max={field.max} step={field.step}
                        value={(playbook as any)[field.key]}
                        onChange={e => updatePlaybook(playbook.id, { [field.key]: parseFloat(e.target.value) })}
                        className={`w-full ${field.color}`} />
                      <div className="flex justify-between text-fg-dim text-xs mt-1">
                        <span>{field.min}{field.suffix}</span>
                        <span>{field.max}{field.suffix}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 glass border border-warning/30 bg-warning-soft rounded-lg p-4">
                  <p className="text-warning text-xs font-semibold mb-2">⚠ Current Limits Summary</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-fg-dim">Stop trading after</span><span className="text-danger font-bold">{playbook.maxDailyLoss}% loss/day</span></div>
                    <div className="flex justify-between"><span className="text-fg-dim">Max trades today</span><span className="text-warning font-bold">{playbook.maxTradesPerDay} trades</span></div>
                    <div className="flex justify-between"><span className="text-fg-dim">Max position size</span><span className="text-warning font-bold">{playbook.maxLotSize} lots</span></div>
                    <div className="flex justify-between"><span className="text-fg-dim">Reject trades below</span><span className="text-success font-bold">1:{playbook.minRR} RR</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {activeTab === "stats" && (
            <div className="max-w-2xl">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Adherence Score", value: `${playbook.adherenceScore}%`, color: playbook.adherenceScore >= 80 ? "text-success" : "text-warning", desc: "How often you follow your rules" },
                  { label: "Checks Passed", value: `${playbook.passedChecks}/${playbook.totalChecks}`, color: "text-fg", desc: "Pre-trade checklist completion" },
                  { label: "Rules Count", value: allRules.length, color: "text-fg", desc: "Total rules in playbook" },
                ].map(stat => (
                  <div key={stat.label} className="glass border border-border rounded-xl p-4">
                    <p className="text-fg-dim text-xs mb-1">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-fg-dim text-xs mt-1">{stat.desc}</p>
                  </div>
                ))}
              </div>

              <div className="glass border border-border rounded-xl p-5">
                <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-4">Rule Breakdown</p>
                {[
                  { label: "Entry Rules", count: playbook.entryRules.length, color: "bg-success" },
                  { label: "Exit Rules", count: playbook.exitRules.length, color: "bg-danger" },
                  { label: "Risk Rules", count: playbook.riskRules.length, color: "bg-warning" },
                  { label: "Psychology Rules", count: playbook.psychologyRules.length, color: "bg-accent" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 mb-3">
                    <span className="text-fg-muted text-xs w-32">{item.label}</span>
                    <div className="flex-1 bg-elevated rounded-full h-2">
                      <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${(item.count / allRules.length) * 100}%` }} />
                    </div>
                    <span className="text-fg-muted text-xs w-6 text-right">{item.count}</span>
                  </div>
                ))}
              </div>

              <div className="glass border border-border rounded-xl p-5 mt-4">
                <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">AI Insight</p>
                <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                  <p className="text-fg-muted text-xs leading-relaxed">
                    "Your playbook has {allRules.length} rules across 4 categories. Adherence at {playbook.adherenceScore}% is
                    {playbook.adherenceScore >= 80 ? " excellent — keep it up." : playbook.adherenceScore >= 60 ? " moderate — focus on following risk rules consistently." : " low — review your rules and simplify where needed."}
                    {" "}Your strongest category is {playbook.riskRules.length >= playbook.entryRules.length ? "risk management" : "entry discipline"} with {Math.max(playbook.entryRules.length, playbook.riskRules.length)} rules defined."
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
  );
}