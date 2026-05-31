"use client";
import { useReportStore } from "@/store/reportStore";
import { useAdminActionLogStore } from "@/store/adminActionLogStore";
import { useCopyTradingStore } from "@/store/copyTradingStore";
import { useJournalStore } from "@/store/journalStore";
import { useRouter } from "next/navigation";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const priorityColor: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  medium: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low: "text-white/40 bg-white/5 border-white/10",
};

export default function OwnerDashboard() {
  const { reports } = useReportStore();
  const { logs } = useAdminActionLogStore();
  const { relationships } = useCopyTradingStore();
  const { entries } = useJournalStore();
  const router = useRouter();

  const pending = reports.filter(r => r.status === "pending");
  const critical = reports.filter(r => r.priority === "critical" && r.status === "pending");
  const underReview = reports.filter(r => r.status === "under_review");
  const resolved = reports.filter(r => !["pending", "under_review"].includes(r.status));

  const statsByType = reports.reduce((acc: Record<string, number>, r) => {
    acc[r.reportedItemType] = (acc[r.reportedItemType] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          🏠 Owner Dashboard
          {critical.length > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
              {critical.length} CRITICAL
            </span>
          )}
        </h1>
        <p className="text-white/30 text-xs mt-1">
          TCC Internal Control Center — only real data from active stores is shown here
        </p>
      </div>

      {/* Critical alert */}
      {critical.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-red-400 font-bold">🚨 {critical.length} critical report{critical.length > 1 ? "s" : ""} pending immediate review</p>
            <p className="text-red-400/60 text-xs mt-0.5">
              {critical.map(r => r.reason).join(", ")}
            </p>
          </div>
          <button onClick={() => router.push("/owner/reports")}
            className="bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-semibold">
            Review Now →
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Pending", value: pending.length, color: pending.length > 0 ? "text-amber-400" : "text-white/20", path: "/owner/reports" },
          { label: "Under Review", value: underReview.length, color: underReview.length > 0 ? "text-blue-400" : "text-white/20", path: "/owner/reports" },
          { label: "Resolved", value: resolved.length, color: "text-green-400", path: "/owner/reports" },
          { label: "Total Reports", value: reports.length, color: "text-white", path: "/owner/reports" },
          { label: "Admin Actions", value: logs.length, color: "text-indigo-400", path: "/owner/action-logs" },
        ].map(s => (
          <div key={s.label}
            onClick={() => router.push(s.path)}
            className="bg-white/2 border border-white/5 rounded-xl p-4 cursor-pointer hover:border-white/10 transition">
            <p className="text-white/30 text-xs mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Recent Pending Reports */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white/60 uppercase tracking-wider">Pending Reports</p>
            <button onClick={() => router.push("/owner/reports")} className="text-xs text-white/30 hover:text-white/60">View all →</button>
          </div>
          {pending.length === 0 ? (
            <p className="text-white/20 text-sm">No pending reports ✓</p>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.slice(0, 6).map(report => (
                <div key={report.id} className="flex items-start gap-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${priorityColor[report.priority]}`}>
                    {report.priority.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs truncate">{report.reason}</p>
                    <p className="text-white/30 text-xs">{report.reportedItemType.replace("_", " ")} · {report.reporterHandle}</p>
                  </div>
                  <p className="text-white/20 text-xs shrink-0">{timeAgo(report.createdAt)}</p>
                </div>
              ))}
              {pending.length > 6 && (
                <p className="text-white/20 text-xs">+{pending.length - 6} more pending</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Admin Actions */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-white/60 uppercase tracking-wider">Recent Actions</p>
            <button onClick={() => router.push("/owner/action-logs")} className="text-xs text-white/30 hover:text-white/60">View all →</button>
          </div>
          {logs.length === 0 ? (
            <p className="text-white/20 text-sm">No admin actions yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {logs.slice(0, 6).map(log => (
                <div key={log.id} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs truncate">{log.description}</p>
                    <p className="text-white/30 text-xs">by {log.actorHandle} · {log.actorRole}</p>
                  </div>
                  <p className="text-white/20 text-xs shrink-0">{timeAgo(log.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Reports by Type */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-5">
          <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Reports by Type</p>
          {Object.keys(statsByType).length === 0 ? (
            <p className="text-white/20 text-sm">No reports submitted yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(statsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-white/50 text-xs w-32 capitalize">{type.replace("_", " ")}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5">
                    <div className="bg-red-400 h-1.5 rounded-full"
                      style={{ width: `${(count / reports.length) * 100}%` }} />
                  </div>
                  <span className="text-white/40 text-xs w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform Activity */}
        <div className="bg-white/2 border border-white/5 rounded-xl p-5">
          <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Platform Activity</p>
          <div className="flex flex-col gap-3">
            {[
              { label: "Copy Trading Relationships", value: relationships.length, color: relationships.length > 0 ? "text-green-400" : "text-white/20" },
              { label: "Total Trade Journal Entries", value: entries.length, color: entries.length > 0 ? "text-blue-400" : "text-white/20" },
              { label: "Community Reports", value: reports.filter(r => ["post", "comment"].includes(r.reportedItemType)).length, color: "text-amber-400" },
              { label: "Strategy Reports", value: reports.filter(r => r.reportedItemType === "strategy").length, color: "text-purple-400" },
              { label: "Competition Reports", value: reports.filter(r => r.reportedItemType === "competition").length, color: "text-red-400" },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-white/40 text-xs">{item.label}</span>
                <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}