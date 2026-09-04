"use client";
import { memo } from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavItem {
  label: string;
  path:  string;
  icon:  string;
}

const NAV_GROUPS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard",    path: "/",              icon: "📊" },
      { label: "Markets",      path: "/markets",       icon: "🌐" },
      { label: "Watchlist",    path: "/watchlist",     icon: "👁" },
    ],
  },
  {
    title: "Trading",
    items: [
      { label: "Journal",      path: "/journal",       icon: "📓" },
      { label: "Analytics",    path: "/analytics",     icon: "📈" },
      { label: "Playbook",     path: "/playbook",      icon: "📋" },
    ],
  },
  {
    title: "Social",
    items: [
      { label: "Community",    path: "/community",     icon: "👥" },
      { label: "Profile",      path: "/profile",       icon: "👤" },
      { label: "Competition",  path: "/competition",   icon: "🏆" },
      { label: "Copy Trading", path: "/copy-trading",  icon: "📡" },
      { label: "Mentoring",    path: "/mentoring",     icon: "👨‍🏫" },
    ],
  },
  {
    title: "Learn",
    items: [
      { label: "Academy",      path: "/academy",       icon: "🎓" },
      { label: "Marketplace",  path: "/marketplace",   icon: "🏪" },
    ],
  },
  {
    title: "Tools",
    items: [
      { label: "News",         path: "/news",          icon: "📰" },
      { label: "Notifications",path: "/notifications", icon: "🔔" },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <aside className="w-52 shrink-0 glass !border-y-0 !border-l-0 rounded-none flex flex-col overflow-hidden">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-border shrink-0">
        <div
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => router.push("/")}>
          <span className="text-lg font-black text-fg tracking-widest group-hover:text-accent-hover transition">TCC</span>
        </div>
        <p className="text-fg-dim text-xs mt-0.5">The Cane & Co.</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-2" : ""}>
            {group.title && (
              <p className="text-fg-dim text-xs uppercase tracking-widest px-2 py-1.5 font-semibold">
                {group.title}
              </p>
            )}
            {group.items.map(item => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition text-left ${
                    active
                      ? "bg-accent-soft text-accent-hover"
                      : "text-fg-muted hover:text-fg hover:bg-elevated"
                  }`}>
                  {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />}
                  <span className="text-base leading-none shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <span className="badge badge-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Paper Mode
        </span>
        <p className="text-fg-dim text-xs mt-1.5 opacity-60">Beta v0.7 · Local only</p>
      </div>
    </aside>
  );
}

// Sidebar takes no props — its only re-render triggers are its own hooks
// (usePathname), so memo() fully insulates it from parent re-renders.
export default memo(Sidebar);