"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { getEffectiveRole, isAdmin } from "@/lib/auth/roles";
import { useReportStore } from "@/store/reportStore";

const ownerNavItems = [
  { icon: "🏠", label: "Dashboard",     path: "/owner"                 },
  { icon: "🚨", label: "Reports",       path: "/owner/reports"         },
  { icon: "📡", label: "Copy Trading",  path: "/owner/copy-trading"    },
  { icon: "👥", label: "Users",         path: "/owner/users"           },
  { icon: "📋", label: "Action Logs",   path: "/owner/action-logs"     },
  { icon: "🖥",  label: "System Health", path: "/owner/system-health"  },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router   = useRouter();
  const pathname = usePathname();
  const { reports } = useReportStore();

  const [accessChecked, setAccessChecked] = useState(false);
  const [hasAccess,     setHasAccess]     = useState(false);

  // FIX: user.roles (plural array) — not user.role (singular, never existed
  // on AuthUser since the Phase Alpha authStore rewrite). This was silently
  // broken since Phase Alpha Day 1.
  const effectiveRole = getEffectiveRole(user?.roles);

  useEffect(() => {
    const access = isAdmin(user?.roles);
    setHasAccess(access);
    setAccessChecked(true);
    if (!access) setTimeout(() => router.push("/"), 2000);
  }, [user?.roles, router]);

  const pendingReports  = reports.filter((r) => r.status === "pending").length;
  const criticalReports = reports.filter((r) => r.priority === "critical" && r.status === "pending").length;
  // TODO(Phase Alpha follow-up): wire this to GET /copy-trading/admin/applications
  // (status=SUBMITTED) — the copyTradingStore migration only covers the
  // follower-facing surface, not admin moderation counts.
  const pendingApps     = 0;

  if (!accessChecked) {
    return (
      <div className="min-h-screen bg-[#070710] flex items-center justify-center">
        <p className="text-white/30 text-sm">Checking access...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#070710] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-2xl font-bold mb-2">🔒 Access Denied</p>
          <p className="text-white/40 text-sm mb-4">Owner/Admin access required</p>
          <p className="text-white/20 text-xs mb-4">
            To test locally (dev only):{" "}
            <code className="bg-white/5 px-2 py-0.5 rounded">
              localStorage.setItem('tcc:dev:role', 'OWNER')
            </code>
          </p>
          <button onClick={() => router.push("/")} className="bg-white/5 text-white/40 px-4 py-2 rounded-lg text-sm border border-white/10">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070710]">
      <div className="w-56 shrink-0 bg-black/60 border-r border-red-500/10 flex flex-col">
        <div className="p-4 border-b border-red-500/10">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            <p className="text-red-400 font-bold text-xs tracking-widest uppercase">TCC Owner</p>
          </div>
          <p className="text-white/20 text-xs">Internal Control Center</p>
          <div className="mt-2 text-xs text-white/30">
            {user?.handle || "Admin"} ·{" "}
            <span className="text-red-400/70 capitalize">{effectiveRole.replace(/_/g, " ")}</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
          {ownerNavItems.map((item) => {
            const isActive = pathname === item.path;
            const badge =
              item.path === "/owner/reports"      ? pendingReports
              : item.path === "/owner/copy-trading" ? pendingApps
              : 0;
            const isCritical = item.path === "/owner/reports" && criticalReports > 0;

            return (
              <button key={item.path} onClick={() => router.push(item.path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition relative ${
                  isActive
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/5"
                }`}>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className={`text-xs font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 ${isCritical ? "bg-red-500 text-white" : "bg-amber-500 text-black"}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/5">
          <button onClick={() => router.push("/")} className="w-full text-white/20 text-xs hover:text-white/50 transition text-left">
            ← Back to TCC App
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}