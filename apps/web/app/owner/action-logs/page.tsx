"use client";
import { useState } from "react";
import { useAdminActionLogStore, AdminActionType } from "@/store/adminActionLogStore";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const actionColors: Record<string, string> = {
  report_reviewed: "text-blue-400",
  report_resolved: "text-success",
  content_hidden: "text-orange-400",
  content_deleted: "text-danger",
  user_warned: "text-warning",
  user_suspended: "text-danger",
  user_reinstated: "text-success",
  false_report_rejected: "text-fg-dim",
  system_note: "text-fg-muted",
};

export default function ActionLogsPage() {
  const { logs, clearLogs } = useAdminActionLogStore();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const types = [...new Set(logs.map(l => l.actionType))];
  const filtered = logs.filter(l => typeFilter === "all" || l.actionType === typeFilter);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-fg">📋 Action Logs</h1>
          <p className="text-fg-dim text-xs mt-1">{logs.length} admin actions recorded</p>
        </div>
        {logs.length > 0 && (
          <div>
            {showClearConfirm ? (
              <div className="flex gap-2">
                <button onClick={() => { clearLogs(); setShowClearConfirm(false); }}
                  className="bg-danger-soft text-danger border border-danger/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  Confirm Clear
                </button>
                <button onClick={() => setShowClearConfirm(false)}
                  className="bg-elevated text-fg-dim px-3 py-1.5 rounded-lg text-xs">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowClearConfirm(true)}
                className="bg-elevated text-fg-dim border border-border px-3 py-1.5 rounded-lg text-xs hover:text-fg-muted transition">
                Clear Logs
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      {types.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setTypeFilter("all")}
            className={`text-xs px-3 py-1 rounded-full border transition ${typeFilter === "all" ? "bg-elevated text-fg border-border-strong" : "text-fg-dim border-border hover:border-border-strong"}`}>
            All
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`text-xs px-3 py-1 rounded-full border capitalize transition ${typeFilter === t ? "bg-elevated text-fg border-border-strong" : "text-fg-dim border-border hover:border-border-strong"}`}>
              {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-fg-dim text-sm">No admin actions yet</p>
            <p className="text-fg-dim text-xs mt-1">Actions from the Reports Queue will appear here</p>
          </div>
        </div>
      ) : (
        <div className="bg-elevated border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-elevated">
                <th className="text-left px-4 py-3 text-fg-dim">Time</th>
                <th className="text-left px-4 py-3 text-fg-dim">Actor</th>
                <th className="text-left px-4 py-3 text-fg-dim">Role</th>
                <th className="text-left px-4 py-3 text-fg-dim">Action</th>
                <th className="text-left px-4 py-3 text-fg-dim">Description</th>
                <th className="text-left px-4 py-3 text-fg-dim">Target</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b border-border hover:bg-elevated">
                  <td className="px-4 py-3 text-fg-dim">{timeAgo(log.createdAt)}</td>
                  <td className="px-4 py-3 text-fg-muted font-semibold">{log.actorHandle}</td>
                  <td className="px-4 py-3 text-fg-dim capitalize">{log.actorRole}</td>
                  <td className={`px-4 py-3 font-semibold capitalize ${actionColors[log.actionType] || "text-fg-muted"}`}>
                    {log.actionType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-fg-muted max-w-xs truncate">{log.description}</td>
                  <td className="px-4 py-3 text-fg-dim font-mono text-xs">{log.targetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}