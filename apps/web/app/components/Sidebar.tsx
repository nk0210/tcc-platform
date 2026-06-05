"use client";
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

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <aside className="w-52 shrink-0 glass border-r border-white/5 flex flex-col overflow-hidden">

      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/5 shrink-0">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/")}>
          <span className="text-lg font-black neon-green tracking-widest">TCC</span>
        </div>
        <p className="text-white/20 text-xs mt-0.5">The Cane & Co.</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-2" : ""}>
            {group.title && (
              <p className="text-white/20 text-xs uppercase tracking-widest px-2 py-1.5 font-semibold">
                {group.title}
              </p>
            )}
            {group.items.map(item => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition text-left ${
                    active
                      ? "bg-green-500/15 text-green-400 border border-green-500/20"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent"
                  }`}>
                  <span className="text-base leading-none shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400/60 text-xs">Paper Mode</span>
        </div>
        <p className="text-white/15 text-xs mt-0.5">Beta v0.7 · Local only</p>
      </div>
    </aside>
  );
}