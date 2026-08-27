"use client";
import { useState } from "react";
import { useReportStore, Report, ReportStatus } from "@/store/reportStore";
import { useAdminActionLogStore } from "@/store/adminActionLogStore";
import { useAuthStore } from "@/store/authStore";
import { getEffectiveRole } from "@/lib/auth/roles";

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  under_review: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  resolved_no_action: "text-white/30 bg-white/5 border-white/10",
  content_hidden: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  content_deleted: "text-red-400 bg-red-500/10 border-red-500/20",
  user_warned: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  user_suspended: "text-red-400 bg-red-500/10 border-red-500/20",
  rejected_false_report: "text-white/20 bg-white/2 border-white/5",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "⏳ Pending",
  under_review: "🔍 Under Review",
  resolved_no_action: "✓ No Action",
  content_hidden: "👁 Hidden",
  content_deleted: "🗑 Deleted",
  user_warned: "⚠ Warned",
  user_suspended: "🚫 Suspended",
  rejected_false_report: "❌ False Report",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low: "text-white/30 bg-white/5 border-white/10",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ReportsQueuePage() {
  const { reports, updateReportStatus } = useReportStore();
  const { addLog } = useAdminActionLogStore();
  const { user } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const effectiveRole = getEffectiveRole(user?.roles);

  const filtered = reports.filter(r => {
    if (statusFilter === "pending" && r.status !== "pending") return false;
    if (statusFilter === "under_review" && r.status !== "under_review") return false;
    if (statusFilter === "critical" && r.priority !== "critical") return false;
    if (statusFilter === "resolved" && ["pending", "under_review"].includes(r.status)) return false;
    if (typeFilter !== "all" && r.reportedItemType !== typeFilter) return false;
    if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
    return true;
  });

  const handleAction = (reportId: string, status: ReportStatus, actionLabel: string, actionType: any) => {
    updateReportStatus(reportId, status, adminNote || undefined, actionLabel, user?.handle || "admin");
    addLog({
      actorUserId: user?.id || "admin",
      actorHandle: user?.handle || "admin",
      actorRole: effectiveRole || "admin",
      actionType,
      targetType: "report",
      targetId: reportId,
      description: `${actionLabel} — Report ${reportId}${adminNote ? `: ${adminNote}` : ""}`,
    });
    setSelectedReport(null);
    setAdminNote("");
  };

  const types = [...new Set(reports.map(r => r.reportedItemType))];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">🚨 Reports Queue</h1>
          <p className="text-white/30 text-xs mt-1">{reports.length} total reports · {reports.filter(r => r.status === "pending").length} pending</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        <div className="flex gap-1 bg-white/3 rounded-lg p-1">
          {[
            { key: "all", label: `All (${reports.length})` },
            { key: "pending", label: `Pending (${reports.filter(r => r.status === "pending").length})` },
            { key: "under_review", label: `Reviewing (${reports.filter(r => r.status === "under_review").length})` },
            { key: "critical", label: `Critical (${reports.filter(r => r.priority === "critical").length})` },
            { key: "resolved", label: `Resolved (${reports.filter(r => !["pending", "under_review"].includes(r.status)).length})` },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${statusFilter === f.key ? "bg-red-500/20 text-red-400" : "text-white/30 hover:text-white/60"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
          <option value="all" className="bg-[#0a0a0f]">All types</option>
          {types.map(t => <option key={t} value={t} className="bg-[#0a0a0f]">{t.replace("_", " ")}</option>)}
        </select>

        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs">
          <option value="all" className="bg-[#0a0a0f]">All priorities</option>
          {["critical", "high", "medium", "low"].map(p => <option key={p} value={p} className="bg-[#0a0a0f]">{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-white/30 text-sm">No reports matching filters</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Report List */}
          <div className="flex-1 flex flex-col gap-2">
            {filtered.map(report => (
              <div key={report.id}
                onClick={() => { setSelectedReport(report); setAdminNote(report.adminNote || ""); }}
                className={`bg-white/2 border rounded-xl p-4 cursor-pointer transition hover:border-white/15 ${selectedReport?.id === report.id ? "border-red-500/30 bg-red-500/3" : "border-white/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[report.priority]}`}>{report.priority.toUpperCase()}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLORS[report.status]}`}>{STATUS_LABELS[report.status]}</span>
                      <span className="text-xs bg-white/5 text-white/30 px-1.5 py-0.5 rounded border border-white/10 capitalize">{report.reportedItemType.replace("_", " ")}</span>
                    </div>
                    <p className="text-white/80 text-sm font-semibold">{report.reason}</p>
                    {report.reportedItemTitle && <p className="text-white/30 text-xs mt-0.5 truncate">"{report.reportedItemTitle}"</p>}
                    <p className="text-white/20 text-xs mt-1">Reported by {report.reporterHandle} · {report.sourceFeature} · {timeAgo(report.createdAt)}</p>
                  </div>
                  <span className="text-xs text-white/20 shrink-0 font-mono">{report.id}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Report Detail */}
          {selectedReport && (
            <div className="w-80 shrink-0">
              <div className="bg-white/2 border border-white/10 rounded-xl p-5 sticky top-0">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-semibold text-sm">{selectedReport.id}</p>
                  <button onClick={() => setSelectedReport(null)} className="text-white/30 hover:text-white">✕</button>
                </div>

                <div className="flex flex-col gap-2 mb-4 text-xs">
                  <div className="flex justify-between"><span className="text-white/30">Type</span><span className="text-white capitalize">{selectedReport.reportedItemType.replace("_", " ")}</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Reason</span><span className="text-white text-right max-w-[160px]">{selectedReport.reason}</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Priority</span><span className={PRIORITY_COLORS[selectedReport.priority].split(" ")[0]}>{selectedReport.priority}</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Status</span><span className="text-white">{STATUS_LABELS[selectedReport.status]}</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Reporter</span><span className="text-white">{selectedReport.reporterHandle}</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Feature</span><span className="text-white">{selectedReport.sourceFeature}</span></div>
                  <div className="flex justify-between"><span className="text-white/30">Submitted</span><span className="text-white">{timeAgo(selectedReport.createdAt)}</span></div>
                  {selectedReport.resolvedBy && <div className="flex justify-between"><span className="text-white/30">Resolved by</span><span className="text-white">{selectedReport.resolvedBy}</span></div>}
                </div>

                {selectedReport.description && (
                  <div className="bg-white/3 border border-white/5 rounded-lg p-3 mb-4">
                    <p className="text-white/30 text-xs mb-1">Reporter description</p>
                    <p className="text-white/60 text-xs leading-relaxed">{selectedReport.description}</p>
                  </div>
                )}

                {selectedReport.adminNote && (
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3 mb-4">
                    <p className="text-indigo-400 text-xs mb-1">Admin note</p>
                    <p className="text-white/60 text-xs">{selectedReport.adminNote}</p>
                  </div>
                )}

                {["pending", "under_review"].includes(selectedReport.status) && (
                  <>
                    <textarea
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      placeholder="Admin note (optional)..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-xs resize-none h-16 mb-3"
                    />
                    <div className="flex flex-col gap-2">
                      {selectedReport.status === "pending" && (
                        <button onClick={() => handleAction(selectedReport.id, "under_review", "Started review", "report_reviewed")}
                          className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 rounded-lg text-xs font-semibold">
                          🔍 Start Review
                        </button>
                      )}
                      <button onClick={() => handleAction(selectedReport.id, "resolved_no_action", "Resolved — No Action", "report_resolved")}
                        className="w-full bg-white/5 text-white/50 border border-white/10 py-2 rounded-lg text-xs font-semibold">
                        ✓ Resolve — No Action
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "content_hidden", "Content Hidden", "content_hidden")}
                        className="w-full bg-orange-500/10 text-orange-400 border border-orange-500/20 py-2 rounded-lg text-xs font-semibold">
                        👁 Hide Content
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "content_deleted", "Content Deleted", "content_deleted")}
                        className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-2 rounded-lg text-xs font-semibold">
                        🗑 Delete Content
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "user_warned", "User Warned", "user_warned")}
                        className="w-full bg-amber-500/10 text-amber-400 border border-amber-500/20 py-2 rounded-lg text-xs font-semibold">
                        ⚠ Warn User
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "user_suspended", "User Suspended", "user_suspended")}
                        className="w-full bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-lg text-xs font-semibold">
                        🚫 Suspend User
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "rejected_false_report", "Rejected — False Report", "false_report_rejected")}
                        className="w-full bg-white/2 text-white/20 border border-white/5 py-2 rounded-lg text-xs font-semibold">
                        ❌ Reject — False Report
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}