"use client";
/**
 * TCC Owner — Copy Trading Applications (/owner/copy-trading)
 *
 * Standalone owner panel for reviewing master trader applications.
 * Reads from useMasterRegistryStore (global shared store).
 * All actions go to global store and trigger notifications.
 */
import { useState } from "react";
import { useMasterRegistryStore } from "@/store/copyTradingStore";
import { useAdminActionLogStore } from "@/store/adminActionLogStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const statusColors: Record<string, string> = {
  draft:              "text-white/40 bg-white/5 border-white/10",
  submitted:          "text-blue-400 bg-blue-500/10 border-blue-500/20",
  under_review:       "text-amber-400 bg-amber-500/10 border-amber-500/20",
  approved:           "text-green-400 bg-green-500/10 border-green-500/20",
  rejected:           "text-red-400 bg-red-500/10 border-red-500/20",
  more_info_required: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  suspended:          "text-red-400 bg-red-500/15 border-red-500/30",
};

export default function OwnerCopyTradingPage() {
  const { user } = useAuthStore();
  const { allApplications, approvedMasters, approveApplication, rejectApplication, requestMoreInfo, suspendMaster, removeMaster, markUnderReview, addAdminNote } = useMasterRegistryStore();
  const { addLog } = useAdminActionLogStore();
  const { addNotification } = useNotificationStore();

  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [actionNote,   setActionNote]   = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const adminHandle = user?.handle ?? "admin";

  const filtered = filterStatus === "all"
    ? allApplications
    : allApplications.filter(a => a.status === filterStatus);

  const selected = allApplications.find(a => a.id === selectedId);

  const act = (
    fn: () => void,
    logType: "copy_trading_approved" | "copy_trading_rejected" | "report_reviewed" | "system_note",
    label: string,
    appId: string
  ) => {
    fn();
    addLog({
      actorUserId: user?.id ?? adminHandle, actorHandle: adminHandle, actorRole: "admin",
      actionType: logType,
      targetType: "copy_trading_application", targetId: appId,
      description: `${label}${actionNote ? `: ${actionNote}` : ""}`,
    });
    setSelectedId(null); setActionNote("");
  };

  const counts = {
    all:             allApplications.length,
    submitted:       allApplications.filter(a => a.status === "submitted").length,
    under_review:    allApplications.filter(a => a.status === "under_review").length,
    more_info:       allApplications.filter(a => a.status === "more_info_required").length,
    approved:        approvedMasters.filter(m => m.status === "active").length,
    rejected:        allApplications.filter(a => a.status === "rejected").length,
    suspended:       approvedMasters.filter(m => m.status === "suspended").length,
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">📡 Copy Trading Applications</h1>
        <p className="text-white/30 text-xs mt-1">
          Review master trader applications. No fake approvals. Approval labels applications as locally verified only.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Submitted",     count: counts.submitted,    color: "text-blue-400"   },
          { label: "Under Review",  count: counts.under_review, color: "text-amber-400"  },
          { label: "Active Masters",count: counts.approved,     color: "text-green-400"  },
          { label: "Rejected",      count: counts.rejected,     color: "text-red-400"    },
        ].map(item => (
          <div key={item.label} className="bg-white/2 border border-white/5 rounded-xl p-4">
            <p className="text-white/30 text-xs mb-1">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-5 overflow-x-auto">
        {[
          { key: "all",                label: `All (${counts.all})`           },
          { key: "submitted",          label: `Submitted (${counts.submitted})` },
          { key: "under_review",       label: `Reviewing (${counts.under_review})` },
          { key: "more_info_required", label: `Info Needed (${counts.more_info})` },
          { key: "approved",           label: `Approved (${counts.approved})`   },
          { key: "rejected",           label: `Rejected (${counts.rejected})`   },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${filterStatus === tab.key ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-5">
        {/* Application list */}
        <div className="flex-1 flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <p className="text-3xl mb-2">📡</p>
                <p className="text-white/20 text-sm">No applications in this category.</p>
              </div>
            </div>
          ) : (
            filtered.map(app => (
              <div key={app.id}
                onClick={() => { setSelectedId(app.id); setActionNote(""); }}
                className={`bg-white/2 border rounded-xl p-4 cursor-pointer transition hover:border-white/15 ${selectedId === app.id ? "border-green-500/30 bg-green-500/3" : "border-white/5"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold text-sm">{app.displayName}</p>
                    <p className="text-white/30 text-xs font-mono">{app.tccId}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${statusColors[app.status] ?? statusColors.draft}`}>
                    {app.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/30">
                  <span>{app.marketsTraded.join(", ") || "No markets listed"}</span>
                  {app.submittedAt && <span>{timeAgo(app.submittedAt)}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Active masters */}
        {counts.approved > 0 && (
          <div className="w-72 shrink-0 flex flex-col gap-2">
            <p className="text-white/40 text-xs uppercase tracking-wider">Active Master Traders ({counts.approved})</p>
            {approvedMasters.filter(m => m.status === "active").map(master => (
              <div key={master.id} className="bg-green-500/3 border border-green-500/10 rounded-xl p-4">
                <p className="text-white font-semibold text-sm">{master.displayName}</p>
                <p className="text-green-400/60 text-xs font-mono">{master.tccId}</p>
                <p className="text-white/30 text-xs mt-1">Approved {timeAgo(master.approvedAt)} by {master.approvedBy}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => {
                    const reason = prompt("Suspension reason:");
                    if (reason) {
                      suspendMaster(master.id, adminHandle, reason);
                      addLog({ actorUserId: user?.id ?? adminHandle, actorHandle: adminHandle, actorRole: "admin", actionType: "user_suspended", targetType: "master_trader", targetId: master.id, description: `Suspended: ${reason}` });
                    }
                  }}
                    className="text-xs text-red-400/60 hover:text-red-400 bg-red-500/5 border border-red-500/10 px-2 py-1 rounded-lg transition">
                    Suspend
                  </button>
                  <button onClick={() => removeMaster(master.id)}
                    className="text-xs text-white/20 hover:text-white/50 bg-white/3 border border-white/8 px-2 py-1 rounded-lg transition">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail panel */}
        {selected && (
          <div className="w-80 shrink-0">
            <div className="bg-white/2 border border-white/10 rounded-xl p-5 sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-semibold text-sm">{selected.displayName}</p>
                <button onClick={() => setSelectedId(null)} className="text-white/30 hover:text-white text-lg">✕</button>
              </div>

              <div className="flex flex-col gap-1.5 text-xs mb-4">
                {[
                  { l: "TCC ID",       v: selected.tccId },
                  { l: "Status",       v: selected.status.replace(/_/g," ") },
                  { l: "Submitted",    v: selected.submittedAt ? new Date(selected.submittedAt).toLocaleString() : "—" },
                  { l: "Markets",      v: selected.marketsTraded.join(", ") || "—" },
                  { l: "Strategies",   v: selected.strategiesUsed.join(", ") || "—" },
                  { l: "Risk disc.",   v: selected.hasAcceptedRiskDisclosure ? "✅ Yes" : "❌ No" },
                  { l: "Honesty pol.", v: selected.hasAcceptedPerformanceTruthPolicy ? "✅ Yes" : "❌ No" },
                  { l: "Copy terms",   v: selected.hasAcceptedCopyTradingTerms ? "✅ Yes" : "❌ No" },
                ].map(item => (
                  <div key={item.l} className="flex gap-2">
                    <span className="text-white/30 w-24 shrink-0">{item.l}</span>
                    <span className="text-white/60 capitalize">{item.v}</span>
                  </div>
                ))}
              </div>

              {selected.experienceSummary && (
                <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-2">
                  <p className="text-white/30 text-xs mb-1">Experience Summary</p>
                  <p className="text-white/50 text-xs leading-relaxed">{selected.experienceSummary}</p>
                </div>
              )}

              {selected.riskManagementSummary && (
                <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-2">
                  <p className="text-white/30 text-xs mb-1">Risk Management</p>
                  <p className="text-white/50 text-xs leading-relaxed">{selected.riskManagementSummary}</p>
                </div>
              )}

              {selected.reasonForApplying && (
                <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-3">
                  <p className="text-white/30 text-xs mb-1">Reason for Applying</p>
                  <p className="text-white/50 text-xs leading-relaxed">{selected.reasonForApplying}</p>
                </div>
              )}

              {selected.adminNotes && (
                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3 mb-3">
                  <p className="text-indigo-400 text-xs font-semibold mb-1">Admin Note</p>
                  <p className="text-white/50 text-xs">{selected.adminNotes}</p>
                </div>
              )}

              {selected.rejectionReason && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-3">
                  <p className="text-red-400 text-xs font-semibold mb-1">Rejection Reason</p>
                  <p className="text-white/50 text-xs">{selected.rejectionReason}</p>
                </div>
              )}

              {selected.moreInfoRequest && (
                <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 mb-3">
                  <p className="text-orange-400 text-xs font-semibold mb-1">Info Requested</p>
                  <p className="text-white/50 text-xs">{selected.moreInfoRequest}</p>
                </div>
              )}

              <textarea value={actionNote} onChange={e => setActionNote(e.target.value)}
                placeholder="Admin note / rejection reason / info request..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs resize-none focus:outline-none mb-3" />

              {(selected.status === "submitted" || selected.status === "under_review" || selected.status === "more_info_required") && (
                <div className="flex flex-col gap-2">
                  {selected.status !== "under_review" && (
                    <button onClick={() => act(() => markUnderReview(selected.id, adminHandle), "report_reviewed", "Marked under review", selected.id)}
                      className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 rounded-lg text-xs font-semibold transition">
                      🔍 Mark Under Review
                    </button>
                  )}
                  <button onClick={() => act(() => {
                    const m = approveApplication(selected.id, adminHandle);
                    if (m) addNotification({ type: "system", priority: "high", title: "✅ Master Trader Approved", message: `${selected.displayName} is now a master trader.` });
                  }, "copy_trading_approved", "Application approved", selected.id)}
                    className="w-full bg-green-500/20 text-green-400 border border-green-500/30 py-2 rounded-lg text-xs font-semibold transition">
                    ✅ Approve
                  </button>
                  <button onClick={() => {
                    if (!actionNote.trim()) { return; }
                    act(() => { rejectApplication(selected.id, adminHandle, actionNote); addNotification({ type: "system", priority: "medium", title: "❌ Application Rejected", message: `${selected.displayName}: ${actionNote}` }); }, "copy_trading_rejected", `Rejected: ${actionNote}`, selected.id);
                  }}
                    className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-2 rounded-lg text-xs font-semibold transition">
                    ❌ Reject (requires note)
                  </button>
                  <button onClick={() => {
                    if (!actionNote.trim()) return;
                    act(() => { requestMoreInfo(selected.id, adminHandle, actionNote); addNotification({ type: "system", priority: "medium", title: "❓ More Info Requested", message: `${selected.displayName}: ${actionNote}` }); }, "system_note", `More info: ${actionNote}`, selected.id);
                  }}
                    className="w-full bg-orange-500/10 text-orange-400 border border-orange-500/20 py-2 rounded-lg text-xs font-semibold transition">
                    ❓ Request More Info (requires note)
                  </button>
                  <button onClick={() => act(() => { if (actionNote.trim()) addAdminNote(selected.id, actionNote); }, "system_note", `Admin note added`, selected.id)}
                    className="w-full bg-white/5 text-white/40 border border-white/10 py-2 rounded-lg text-xs font-semibold transition">
                    📝 Save Admin Note
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}