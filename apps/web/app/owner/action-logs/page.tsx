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
  report_resolved: "text-green-400",
  content_hidden: "text-orange-400",
  content_deleted: "text-red-400",
  user_warned: "text-amber-400",
  user_suspended: "text-red-400",
  user_reinstated: "text-green-400",
  false_report_rejected: "text-white/40",
  system_note: "text-white/60",
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
          <h1 className="text-xl font-bold text-white">📋 Action Logs</h1>
          <p className="text-white/30 text-xs mt-1">{logs.length} admin actions recorded</p>
        </div>
        {logs.length > 0 && (
          <div>
            {showClearConfirm ? (
              <div className="flex gap-2">
                <button onClick={() => { clearLogs(); setShowClearConfirm(false); }}
                  className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold">
                  Confirm Clear
                </button>
                <button onClick={() => setShowClearConfirm(false)}
                  className="bg-white/5 text-white/40 px-3 py-1.5 rounded-lg text-xs">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowClearConfirm(true)}
                className="bg-white/5 text-white/30 border border-white/10 px-3 py-1.5 rounded-lg text-xs hover:text-white/60 transition">
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
            className={`text-xs px-3 py-1 rounded-full border transition ${typeFilter === "all" ? "bg-white/10 text-white border-white/20" : "text-white/30 border-white/10 hover:border-white/20"}`}>
            All
          </button>
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`text-xs px-3 py-1 rounded-full border capitalize transition ${typeFilter === t ? "bg-white/10 text-white border-white/20" : "text-white/30 border-white/10 hover:border-white/20"}`}>
              {t.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-white/30 text-sm">No admin actions yet</p>
            <p className="text-white/20 text-xs mt-1">Actions from the Reports Queue will appear here</p>
          </div>
        </div>
      ) : (
        <div className="bg-white/2 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/2">
                <th className="text-left px-4 py-3 text-white/40">Time</th>
                <th className="text-left px-4 py-3 text-white/40">Actor</th>
                <th className="text-left px-4 py-3 text-white/40">Role</th>
                <th className="text-left px-4 py-3 text-white/40">Action</th>
                <th className="text-left px-4 py-3 text-white/40">Description</th>
                <th className="text-left px-4 py-3 text-white/40">Target</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/2">
                  <td className="px-4 py-3 text-white/30">{timeAgo(log.createdAt)}</td>
                  <td className="px-4 py-3 text-white/70 font-semibold">{log.actorHandle}</td>
                  <td className="px-4 py-3 text-white/40 capitalize">{log.actorRole}</td>
                  <td className={`px-4 py-3 font-semibold capitalize ${actionColors[log.actionType] || "text-white/50"}`}>
                    {log.actionType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-white/60 max-w-xs truncate">{log.description}</td>
                  <td className="px-4 py-3 text-white/30 font-mono text-xs">{log.targetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}