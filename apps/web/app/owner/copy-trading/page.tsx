"use client";
/**
 * TCC Owner Panel — Copy Trading Applications
 * Route: /owner/copy-trading
 *
 * Full admin review queue for master trader applications.
 * API-backed via adminCopyTradingApi (/copy-trading/admin/*).
 * All actions logged with correct AdminActionType values.
 */
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api/client";
import { adminCopyTradingApi } from "@/lib/api/adminCopyTrading";
import { useAdminActionLogStore } from "@/store/adminActionLogStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";

// ── Types (match backend MasterTraderApplication / MasterTrader shapes) ────

type ApplicationStatus =
  | "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED"
  | "MORE_INFO_REQUIRED" | "SUSPENDED";

type MasterStatus = "ACTIVE" | "SUSPENDED" | "REMOVED";

interface Application {
  id:                                 string;
  userId:                             string;
  tccId:                              string;
  displayName:                        string;
  status:                             ApplicationStatus;
  marketsTraded:                      string[];
  strategiesUsed:                     string[];
  experienceSummary:                  string;
  riskManagementSummary:              string;
  reasonForApplying:                  string;
  hasAcceptedRiskDisclosure:          boolean;
  hasAcceptedPerformanceTruthPolicy:  boolean;
  hasAcceptedCopyTradingTerms:        boolean;
  adminNotes:                         string | null;
  rejectionReason:                    string | null;
  moreInfoRequest:                    string | null;
  submittedAt:                        string | null;
  createdAt:                          string;
}

interface Master {
  id:                string;
  displayName:        string;
  tccId:              string;
  status:              MasterStatus;
  approvedAt:          string;
  approvedBy:          string;
  trustScoreStatus:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  draft:              "text-white/40 bg-white/5 border-white/10",
  submitted:          "text-blue-400 bg-blue-500/10 border-blue-500/20",
  under_review:       "text-amber-400 bg-amber-500/10 border-amber-500/20",
  approved:           "text-green-400 bg-green-500/10 border-green-500/20",
  rejected:           "text-red-400 bg-red-500/10 border-red-500/20",
  more_info_required: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  suspended:          "text-red-400 bg-red-500/15 border-red-500/30",
};

const STATUS_ICONS: Record<string, string> = {
  draft: "📝", submitted: "📬", under_review: "🔍",
  approved: "✅", rejected: "❌", more_info_required: "❓", suspended: "🚫",
};

// ── Page ──────────────────────────────────────────────────────────────────

export default function OwnerCopyTradingPage() {
  const { user } = useAuthStore();
  const { addLog }          = useAdminActionLogStore();
  const { addNotification } = useNotificationStore();

  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [approvedMasters, setApprovedMasters] = useState<Master[]>([]);
  const [isLoading, setIsLoading]             = useState(true);

  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [actionNote,   setActionNote]   = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const adminHandle = user?.handle ?? "admin";
  const adminUserId = user?.id ?? adminHandle;

  // ── Data loading ─────────────────────────────────────────────────────

  const refetchApplications = useCallback(async () => {
    const res = await adminCopyTradingApi.getApplications(1);
    if (res.success) setAllApplications((res.data as { items: Application[] }).items);
  }, []);

  const refetchMasters = useCallback(async () => {
    const res = await api.get<{ items: Master[] }>("/copy-trading/masters?page=1&pageSize=50");
    if (res.success) setApprovedMasters(res.data.items);
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([refetchApplications(), refetchMasters()]);
      setIsLoading(false);
    })();
  }, [refetchApplications, refetchMasters]);

  const filtered = filterStatus === "all"
    ? allApplications
    : allApplications.filter(a => a.status.toLowerCase() === filterStatus);

  const selected = allApplications.find(a => a.id === selectedId);

  const counts = {
    all:          allApplications.length,
    submitted:    allApplications.filter(a => a.status === "SUBMITTED").length,
    under_review: allApplications.filter(a => a.status === "UNDER_REVIEW").length,
    more_info:    allApplications.filter(a => a.status === "MORE_INFO_REQUIRED").length,
    approved:     approvedMasters.filter(m => m.status === "ACTIVE").length,
    rejected:     allApplications.filter(a => a.status === "REJECTED").length,
    suspended:    approvedMasters.filter(m => m.status === "SUSPENDED").length,
  };

  // ── Action helpers — each uses the correct AdminActionType ────────────

  const handleMarkUnderReview = async () => {
    if (!selected) return;
    const res = await adminCopyTradingApi.reviewApplication(selected.id);
    if (!res.success) { addNotification({ type: "system", priority: "high", title: "Failed", message: res.error }); return; }

    addNotification({
      type: "system", priority: "low",
      title: "🔍 Marked Under Review",
      message: `${selected.displayName}'s application is under review.`,
    });
    // "report_reviewed" is the closest existing type for "review started"
    addLog({
      actorUserId: adminUserId, actorHandle: adminHandle, actorRole: "admin",
      actionType: "report_reviewed",
      targetType: "copy_trading_application", targetId: selected.id,
      description: `Marked under review: ${selected.displayName}`,
    });
    await refetchApplications();
  };

  const handleApprove = async () => {
    if (!selected) return;
    const res = await adminCopyTradingApi.approveApplication(selected.id);
    if (!res.success) { addNotification({ type: "system", priority: "high", title: "Failed", message: res.error }); return; }

    addLog({
      actorUserId: adminUserId, actorHandle: adminHandle, actorRole: "admin",
      actionType: "copy_trading_approved",
      targetType: "copy_trading_application", targetId: selected.id,
      description: `Approved master trader application for ${selected.displayName}`,
    });
    addNotification({
      type: "system", priority: "high",
      title: "✅ Master Trader Approved",
      message: `${selected.displayName} is now an approved master trader.`,
    });
    setSelectedId(null);
    setActionNote("");
    await Promise.all([refetchApplications(), refetchMasters()]);
  };

  const handleReject = async () => {
    if (!selected || !actionNote.trim()) return;
    const res = await adminCopyTradingApi.rejectApplication(selected.id, actionNote);
    if (!res.success) { addNotification({ type: "system", priority: "high", title: "Failed", message: res.error }); return; }

    addLog({
      actorUserId: adminUserId, actorHandle: adminHandle, actorRole: "admin",
      actionType: "copy_trading_rejected",
      targetType: "copy_trading_application", targetId: selected.id,
      description: `Rejected: ${actionNote}`,
    });
    addNotification({
      type: "system", priority: "medium",
      title: "❌ Application Rejected",
      message: `${selected.displayName}: ${actionNote}`,
    });
    setSelectedId(null);
    setActionNote("");
    await refetchApplications();
  };

  const handleMoreInfo = async () => {
    if (!selected || !actionNote.trim()) return;
    const res = await adminCopyTradingApi.requestMoreInfo(selected.id, actionNote);
    if (!res.success) { addNotification({ type: "system", priority: "high", title: "Failed", message: res.error }); return; }

    // Use "system_note" — requesting info is an internal admin note action
    addLog({
      actorUserId: adminUserId, actorHandle: adminHandle, actorRole: "admin",
      actionType: "system_note",
      targetType: "copy_trading_application", targetId: selected.id,
      description: `More info requested: ${actionNote}`,
    });
    addNotification({
      type: "system", priority: "medium",
      title: "❓ More Info Requested",
      message: `${selected.displayName}: ${actionNote}`,
    });
    setSelectedId(null);
    setActionNote("");
    await refetchApplications();
  };

  const handleSuspendMaster = async (masterId: string, masterDisplayName: string) => {
    const reason = prompt("Suspension reason:");
    if (!reason) return;
    const res = await adminCopyTradingApi.suspendMaster(masterId, reason);
    if (!res.success) { addNotification({ type: "system", priority: "high", title: "Failed", message: res.error }); return; }

    addLog({
      actorUserId: adminUserId, actorHandle: adminHandle, actorRole: "admin",
      actionType: "user_suspended",
      targetType: "master_trader", targetId: masterId,
      description: `Suspended master trader ${masterDisplayName}: ${reason}`,
    });
    addNotification({
      type: "system", priority: "high",
      title: "🚫 Master Trader Suspended",
      message: `${masterDisplayName} has been suspended. Reason: ${reason}`,
    });
    await refetchMasters();
  };

  const handleRemoveMaster = async (masterId: string, masterDisplayName: string) => {
    if (!confirm(`Remove ${masterDisplayName} permanently from approved masters?`)) return;
    const res = await adminCopyTradingApi.removeMaster(masterId, "Removed by admin");
    if (!res.success) { addNotification({ type: "system", priority: "high", title: "Failed", message: res.error }); return; }

    // "user_suspended" is the correct type for a disabling/removal action in this store
    addLog({
      actorUserId: adminUserId, actorHandle: adminHandle, actorRole: "admin",
      actionType: "user_suspended",
      targetType: "master_trader", targetId: masterId,
      description: `Permanently removed master trader: ${masterDisplayName}`,
    });
    addNotification({
      type: "system", priority: "high",
      title: "🗑 Master Trader Removed",
      message: `${masterDisplayName} has been removed from the approved master traders list.`,
    });
    await refetchMasters();
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <p className="text-white/30 text-sm">Loading applications...</p>
      </div>
    );
  }

  return (
    <div className="p-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">📡 Copy Trading Applications</h1>
        <p className="text-white/30 text-xs mt-1">
          Review master trader applications. Approval labels accounts as locally verified only.
          Phase Alpha requires broker-verified performance data.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Submitted",      count: counts.submitted,    color: "text-blue-400"  },
          { label: "Under Review",   count: counts.under_review, color: "text-amber-400" },
          { label: "Active Masters", count: counts.approved,     color: "text-green-400" },
          { label: "Rejected",       count: counts.rejected,     color: "text-red-400"   },
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
          { key: "all",                 label: `All (${counts.all})`              },
          { key: "submitted",           label: `Submitted (${counts.submitted})`  },
          { key: "under_review",        label: `Reviewing (${counts.under_review})` },
          { key: "more_info_required",  label: `Info (${counts.more_info})`       },
          { key: "approved",            label: `Approved (${counts.approved})`    },
          { key: "rejected",            label: `Rejected (${counts.rejected})`    },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
              filterStatus === tab.key ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Three-column layout */}
      <div className="flex gap-5">

        {/* Application list */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
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
                className={`bg-white/2 border rounded-xl p-4 cursor-pointer transition hover:border-white/15 ${
                  selectedId === app.id ? "border-green-500/30 bg-green-500/3" : "border-white/5"
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-semibold text-sm">{app.displayName}</p>
                    <p className="text-white/30 text-xs font-mono">{app.tccId}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                    STATUS_COLORS[app.status.toLowerCase()] ?? STATUS_COLORS.draft
                  }`}>
                    {STATUS_ICONS[app.status.toLowerCase()] ?? "📝"} {app.status.toLowerCase().replace(/_/g, " ")}
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

        {/* Application detail panel */}
        {selected && (
          <div className="w-80 shrink-0">
            <div className="bg-white/2 border border-white/10 rounded-xl p-5 sticky top-0 max-h-[calc(100vh-12rem)] overflow-y-auto">

              <div className="flex items-center justify-between mb-4">
                <p className="text-white font-semibold text-sm">{selected.displayName}</p>
                <button
                  onClick={() => setSelectedId(null)}
                  className="text-white/30 hover:text-white text-lg leading-none">
                  ✕
                </button>
              </div>

              {/* Application fields */}
              <div className="flex flex-col gap-1.5 text-xs mb-4">
                {[
                  { l: "TCC ID",       v: selected.tccId                             },
                  { l: "Status",       v: selected.status.toLowerCase().replace(/_/g, " ") },
                  { l: "User ID",      v: selected.userId                            },
                  { l: "Submitted",    v: selected.submittedAt
                      ? new Date(selected.submittedAt).toLocaleString()
                      : "—"                                                           },
                  { l: "Markets",      v: selected.marketsTraded.join(", ") || "—"  },
                  { l: "Strategies",   v: selected.strategiesUsed.join(", ") || "—" },
                  { l: "Risk disc.",   v: selected.hasAcceptedRiskDisclosure         ? "✅ Yes" : "❌ No" },
                  { l: "Honesty pol.", v: selected.hasAcceptedPerformanceTruthPolicy ? "✅ Yes" : "❌ No" },
                  { l: "Copy terms",   v: selected.hasAcceptedCopyTradingTerms       ? "✅ Yes" : "❌ No" },
                ].map(item => (
                  <div key={item.l} className="flex gap-2">
                    <span className="text-white/30 w-24 shrink-0">{item.l}</span>
                    <span className="text-white/60 capitalize break-all">{item.v}</span>
                  </div>
                ))}
              </div>

              {/* Experience summary */}
              {selected.experienceSummary && (
                <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-2">
                  <p className="text-white/30 text-xs mb-1">Experience Summary</p>
                  <p className="text-white/50 text-xs leading-relaxed">{selected.experienceSummary}</p>
                </div>
              )}

              {/* Risk management */}
              {selected.riskManagementSummary && (
                <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-2">
                  <p className="text-white/30 text-xs mb-1">Risk Management</p>
                  <p className="text-white/50 text-xs leading-relaxed">{selected.riskManagementSummary}</p>
                </div>
              )}

              {/* Reason for applying */}
              {selected.reasonForApplying && (
                <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-3">
                  <p className="text-white/30 text-xs mb-1">Reason for Applying</p>
                  <p className="text-white/50 text-xs leading-relaxed">{selected.reasonForApplying}</p>
                </div>
              )}

              {/* Admin note (existing) */}
              {selected.adminNotes && (
                <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3 mb-2">
                  <p className="text-indigo-400 text-xs font-semibold mb-1">Admin Note</p>
                  <p className="text-white/50 text-xs">{selected.adminNotes}</p>
                </div>
              )}

              {/* Rejection reason (existing) */}
              {selected.rejectionReason && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 mb-2">
                  <p className="text-red-400 text-xs font-semibold mb-1">Rejection Reason</p>
                  <p className="text-white/50 text-xs">{selected.rejectionReason}</p>
                </div>
              )}

              {/* More info request (existing) */}
              {selected.moreInfoRequest && (
                <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 mb-3">
                  <p className="text-orange-400 text-xs font-semibold mb-1">Info Requested</p>
                  <p className="text-white/50 text-xs">{selected.moreInfoRequest}</p>
                </div>
              )}

              {/* Action note input */}
              <textarea
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                placeholder="Rejection reason / info request..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs resize-none focus:outline-none mb-3"
              />

              {/* Action buttons — only for actionable statuses */}
              {(selected.status === "SUBMITTED"          ||
                selected.status === "UNDER_REVIEW"       ||
                selected.status === "MORE_INFO_REQUIRED") && (
                <div className="flex flex-col gap-2">
                  {selected.status !== "UNDER_REVIEW" && (
                    <button
                      onClick={handleMarkUnderReview}
                      className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 rounded-lg text-xs font-semibold transition hover:bg-blue-500/30">
                      🔍 Mark Under Review
                    </button>
                  )}
                  <button
                    onClick={handleApprove}
                    className="w-full bg-green-500/20 text-green-400 border border-green-500/30 py-2 rounded-lg text-xs font-semibold transition hover:bg-green-500/30">
                    ✅ Approve
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={!actionNote.trim()}
                    className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40 hover:bg-red-500/20">
                    ❌ Reject (requires note)
                  </button>
                  <button
                    onClick={handleMoreInfo}
                    disabled={!actionNote.trim()}
                    className="w-full bg-orange-500/10 text-orange-400 border border-orange-500/20 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-40 hover:bg-orange-500/20">
                    ❓ Request More Info (requires note)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active masters panel */}
        {counts.approved > 0 && (
          <div className="w-64 shrink-0 flex flex-col gap-2">
            <p className="text-white/40 text-xs uppercase tracking-wider">
              Active Masters ({counts.approved})
            </p>
            {approvedMasters.filter(m => m.status === "ACTIVE").map(master => (
              <div key={master.id} className="bg-green-500/3 border border-green-500/10 rounded-xl p-4">
                <p className="text-white font-semibold text-sm">{master.displayName}</p>
                <p className="text-green-400/60 text-xs font-mono">{master.tccId}</p>
                <p className="text-white/30 text-xs mt-1">
                  Approved {timeAgo(master.approvedAt)} by {master.approvedBy}
                </p>
                <p className="text-white/20 text-xs mt-0.5">
                  Trust: {master.trustScoreStatus.replace(/_/g, " ")}
                </p>
                <div className="flex gap-1.5 mt-3">
                  <button
                    onClick={() => handleSuspendMaster(master.id, master.displayName)}
                    className="flex-1 text-xs text-red-400/60 hover:text-red-400 bg-red-500/5 border border-red-500/10 px-2 py-1 rounded-lg transition">
                    Suspend
                  </button>
                  <button
                    onClick={() => handleRemoveMaster(master.id, master.displayName)}
                    className="flex-1 text-xs text-white/20 hover:text-white/50 bg-white/3 border border-white/8 px-2 py-1 rounded-lg transition">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
