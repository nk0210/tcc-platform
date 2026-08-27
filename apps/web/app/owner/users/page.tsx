"use client";
import { useAuthStore } from "@/store/authStore";
import { useReportStore } from "@/store/reportStore";
import { useJournalStore } from "@/store/journalStore";

export default function UserManagementPage() {
  const { user } = useAuthStore();
  const { reports } = useReportStore();
  const { entries } = useJournalStore();

  const userReports = reports.filter(r => r.reportedUserId === user?.id || r.reporterUserId === user?.id);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">👥 User Management</h1>
        <p className="text-white/30 text-xs mt-1">
          User management will show all registered users once real backend auth is connected.
        </p>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6">
        <p className="text-amber-400 font-semibold text-sm mb-1">⚠ Backend Required</p>
        <p className="text-white/50 text-xs leading-relaxed">
          Full user management requires PostgreSQL + Prisma backend with real auth.
          Currently TCC uses in-memory authentication. User list will populate here once backend is connected.
          <br /><br />
          Planned features: search by TCC ID, role assignment, suspend/ban, view activity, report history.
        </p>
      </div>

      {/* Current session user */}
      {user && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Current Session User</p>
          <div className="bg-white/2 border border-white/5 rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-xl font-bold">
                {user.handle?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold">@{user.handle}</p>
                <p className="text-white/30 text-xs">{user.email}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-white/5 text-white/30 border border-white/10 px-2 py-0.5 rounded-full">{user.experienceLevel || "BEGINNER"}</span>
                  {user.tccId && <span className="text-xs text-green-400/60 font-mono">{user.tccId}</span>}
                  {user.roles && user.roles.length > 0 && <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">{user.roles.join(", ")}</span>}
                </div>
              </div>
              <div className="text-right text-xs text-white/30">
                <p>Journal entries: {entries.length}</p>
                <p>Reports submitted: {userReports.filter(r => r.reporterUserId === user.id).length}</p>
                <p>Reports against: {userReports.filter(r => r.reportedUserId === user.id).length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/2 border border-white/5 rounded-xl p-5">
        <p className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Roadmap for User Management</p>
        <div className="flex flex-col gap-2">
          {[
            { item: "Search users by TCC ID or handle", status: "⏳ Requires backend" },
            { item: "View user trade history and journal", status: "⏳ Requires backend" },
            { item: "Assign roles (moderator, risk_reviewer)", status: "⏳ Requires backend" },
            { item: "Suspend / ban users", status: "⏳ Requires backend" },
            { item: "View report history per user", status: "✓ Ready when users exist" },
            { item: "TCC ID management", status: "✓ Generated on register" },
          ].map(r => (
            <div key={r.item} className="flex items-center justify-between">
              <p className="text-white/50 text-xs">{r.item}</p>
              <p className={`text-xs ${r.status.startsWith("✓") ? "text-green-400" : "text-amber-400"}`}>{r.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}