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
        <h1 className="text-xl font-bold text-fg">👥 User Management</h1>
        <p className="text-fg-dim text-xs mt-1">
          User management will show all registered users once real backend auth is connected.
        </p>
      </div>

      <div className="bg-warning-soft border border-warning/30 rounded-xl p-4 mb-6">
        <p className="text-warning font-semibold text-sm mb-1">⚠ Backend Required</p>
        <p className="text-fg-muted text-xs leading-relaxed">
          Full user management requires PostgreSQL + Prisma backend with real auth.
          Currently TCC uses in-memory authentication. User list will populate here once backend is connected.
          <br /><br />
          Planned features: search by TCC ID, role assignment, suspend/ban, view activity, report history.
        </p>
      </div>

      {/* Current session user */}
      {user && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-fg-dim uppercase tracking-wider mb-3">Current Session User</p>
          <div className="bg-elevated border border-border rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success-soft border border-success/30 flex items-center justify-center text-success text-xl font-bold">
                {user.handle?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <p className="text-fg font-semibold">@{user.handle}</p>
                <p className="text-fg-dim text-xs">{user.email}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs bg-elevated text-fg-dim border border-border px-2 py-0.5 rounded-full">{user.experienceLevel || "BEGINNER"}</span>
                  {user.tccId && <span className="text-xs text-success/60 font-mono">{user.tccId}</span>}
                  {user.roles && user.roles.length > 0 && <span className="text-xs bg-danger-soft text-danger border border-danger/30 px-2 py-0.5 rounded-full">{user.roles.join(", ")}</span>}
                </div>
              </div>
              <div className="text-right text-xs text-fg-dim">
                <p>Journal entries: {entries.length}</p>
                <p>Reports submitted: {userReports.filter(r => r.reporterUserId === user.id).length}</p>
                <p>Reports against: {userReports.filter(r => r.reportedUserId === user.id).length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-elevated border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">Roadmap for User Management</p>
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
              <p className="text-fg-muted text-xs">{r.item}</p>
              <p className={`text-xs ${r.status.startsWith("✓") ? "text-success" : "text-warning"}`}>{r.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}