"use client";
import { useState } from "react";
import { useReportStore, Report, ReportStatus } from "@/store/reportStore";
import { useAdminActionLogStore } from "@/store/adminActionLogStore";
import { useAuthStore } from "@/store/authStore";
import { getEffectiveRole } from "@/lib/auth/roles";

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "text-warning bg-warning-soft border-warning/30",
  under_review: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  resolved_no_action: "text-fg-dim bg-elevated border-border",
  content_hidden: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  content_deleted: "text-danger bg-danger-soft border-danger/30",
  user_warned: "text-warning bg-warning-soft border-warning/30",
  user_suspended: "text-danger bg-danger-soft border-danger/30",
  rejected_false_report: "text-fg-dim bg-elevated border-border",
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
  critical: "text-danger bg-danger-soft border-danger/30",
  high: "text-warning bg-warning-soft border-warning/30",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low: "text-fg-dim bg-elevated border-border",
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
          <h1 className="text-xl font-bold text-fg">🚨 Reports Queue</h1>
          <p className="text-fg-dim text-xs mt-1">{reports.length} total reports · {reports.filter(r => r.status === "pending").length} pending</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-5">
        <div className="flex gap-1 bg-elevated rounded-lg p-1">
          {[
            { key: "all", label: `All (${reports.length})` },
            { key: "pending", label: `Pending (${reports.filter(r => r.status === "pending").length})` },
            { key: "under_review", label: `Reviewing (${reports.filter(r => r.status === "under_review").length})` },
            { key: "critical", label: `Critical (${reports.filter(r => r.priority === "critical").length})` },
            { key: "resolved", label: `Resolved (${reports.filter(r => !["pending", "under_review"].includes(r.status)).length})` },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${statusFilter === f.key ? "bg-danger-soft text-danger" : "text-fg-dim hover:text-fg-muted"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs">
          <option value="all" className="bg-[#0a0a0f]">All types</option>
          {types.map(t => <option key={t} value={t} className="bg-[#0a0a0f]">{t.replace("_", " ")}</option>)}
        </select>

        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="bg-elevated border border-border rounded-lg px-2 py-1.5 text-fg text-xs">
          <option value="all" className="bg-[#0a0a0f]">All priorities</option>
          {["critical", "high", "medium", "low"].map(p => <option key={p} value={p} className="bg-[#0a0a0f]">{p}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-fg-dim text-sm">No reports matching filters</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Report List */}
          <div className="flex-1 flex flex-col gap-2">
            {filtered.map(report => (
              <div key={report.id}
                onClick={() => { setSelectedReport(report); setAdminNote(report.adminNote || ""); }}
                className={`bg-elevated border rounded-xl p-4 cursor-pointer transition hover:border-border ${selectedReport?.id === report.id ? "border-danger/30 bg-danger-soft" : "border-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[report.priority]}`}>{report.priority.toUpperCase()}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLORS[report.status]}`}>{STATUS_LABELS[report.status]}</span>
                      <span className="text-xs bg-elevated text-fg-dim px-1.5 py-0.5 rounded border border-border capitalize">{report.reportedItemType.replace("_", " ")}</span>
                    </div>
                    <p className="text-fg-muted text-sm font-semibold">{report.reason}</p>
                    {report.reportedItemTitle && <p className="text-fg-dim text-xs mt-0.5 truncate">"{report.reportedItemTitle}"</p>}
                    <p className="text-fg-dim text-xs mt-1">Reported by {report.reporterHandle} · {report.sourceFeature} · {timeAgo(report.createdAt)}</p>
                  </div>
                  <span className="text-xs text-fg-dim shrink-0 font-mono">{report.id}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Report Detail */}
          {selectedReport && (
            <div className="w-80 shrink-0">
              <div className="bg-elevated border border-border rounded-xl p-5 sticky top-0">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-fg font-semibold text-sm">{selectedReport.id}</p>
                  <button onClick={() => setSelectedReport(null)} className="text-fg-dim hover:text-fg">✕</button>
                </div>

                <div className="flex flex-col gap-2 mb-4 text-xs">
                  <div className="flex justify-between"><span className="text-fg-dim">Type</span><span className="text-fg capitalize">{selectedReport.reportedItemType.replace("_", " ")}</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Reason</span><span className="text-fg text-right max-w-[160px]">{selectedReport.reason}</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Priority</span><span className={PRIORITY_COLORS[selectedReport.priority].split(" ")[0]}>{selectedReport.priority}</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Status</span><span className="text-fg">{STATUS_LABELS[selectedReport.status]}</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Reporter</span><span className="text-fg">{selectedReport.reporterHandle}</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Feature</span><span className="text-fg">{selectedReport.sourceFeature}</span></div>
                  <div className="flex justify-between"><span className="text-fg-dim">Submitted</span><span className="text-fg">{timeAgo(selectedReport.createdAt)}</span></div>
                  {selectedReport.resolvedBy && <div className="flex justify-between"><span className="text-fg-dim">Resolved by</span><span className="text-fg">{selectedReport.resolvedBy}</span></div>}
                </div>

                {selectedReport.description && (
                  <div className="bg-elevated border border-border rounded-lg p-3 mb-4">
                    <p className="text-fg-dim text-xs mb-1">Reporter description</p>
                    <p className="text-fg-muted text-xs leading-relaxed">{selectedReport.description}</p>
                  </div>
                )}

                {selectedReport.adminNote && (
                  <div className="bg-accent/5 border border-accent/30 rounded-lg p-3 mb-4">
                    <p className="text-accent-hover text-xs mb-1">Admin note</p>
                    <p className="text-fg-muted text-xs">{selectedReport.adminNote}</p>
                  </div>
                )}

                {["pending", "under_review"].includes(selectedReport.status) && (
                  <>
                    <textarea
                      value={adminNote}
                      onChange={e => setAdminNote(e.target.value)}
                      placeholder="Admin note (optional)..."
                      className="w-full bg-elevated border border-border rounded-lg px-2 py-2 text-fg text-xs resize-none h-16 mb-3"
                    />
                    <div className="flex flex-col gap-2">
                      {selectedReport.status === "pending" && (
                        <button onClick={() => handleAction(selectedReport.id, "under_review", "Started review", "report_reviewed")}
                          className="w-full bg-blue-500/20 text-blue-400 border border-blue-500/30 py-2 rounded-lg text-xs font-semibold">
                          🔍 Start Review
                        </button>
                      )}
                      <button onClick={() => handleAction(selectedReport.id, "resolved_no_action", "Resolved — No Action", "report_resolved")}
                        className="w-full bg-elevated text-fg-muted border border-border py-2 rounded-lg text-xs font-semibold">
                        ✓ Resolve — No Action
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "content_hidden", "Content Hidden", "content_hidden")}
                        className="w-full bg-orange-500/10 text-orange-400 border border-orange-500/20 py-2 rounded-lg text-xs font-semibold">
                        👁 Hide Content
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "content_deleted", "Content Deleted", "content_deleted")}
                        className="w-full bg-danger-soft text-danger border border-danger/30 py-2 rounded-lg text-xs font-semibold">
                        🗑 Delete Content
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "user_warned", "User Warned", "user_warned")}
                        className="w-full bg-warning-soft text-warning border border-warning/30 py-2 rounded-lg text-xs font-semibold">
                        ⚠ Warn User
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "user_suspended", "User Suspended", "user_suspended")}
                        className="w-full bg-danger-soft text-danger border border-danger/30 py-2 rounded-lg text-xs font-semibold">
                        🚫 Suspend User
                      </button>
                      <button onClick={() => handleAction(selectedReport.id, "rejected_false_report", "Rejected — False Report", "false_report_rejected")}
                        className="w-full bg-elevated text-fg-dim border border-border py-2 rounded-lg text-xs font-semibold">
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