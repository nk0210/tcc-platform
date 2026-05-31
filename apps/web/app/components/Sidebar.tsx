"use client";
import { useRouter, usePathname } from "next/navigation";

const navItems = [
  { icon: "📊", label: "Markets", path: "/markets" },
  { icon: "👁", label: "Watchlist", path: "/watchlist" },
  { icon: "📡", label: "Copy", path: "/copy-trading" },
  { icon: "📰", label: "News", path: "/news" },
  { icon: "📓", label: "Journal", path: "/journal" },
  { icon: "🎯", label: "Playbook", path: "/playbook" },
  { icon: "🏪", label: "Market", path: "/marketplace" },
  { icon: "🏆", label: "League", path: "/competition" },
  { icon: "🎓", label: "Academy", path: "/academy" },
  { icon: "👨‍🏫", label: "Mentor", path: "/mentoring" },
  { icon: "👥", label: "Community", path: "/community" },
  { icon: "📈", label: "Analytics", path: "/analytics" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="glass flex flex-col w-20 border-r border-white/5 py-2 items-center gap-0.5 overflow-y-auto">
      {/* Home/Dashboard */}
      <button
        onClick={() => router.push("/")}
        className={`flex flex-col items-center gap-0.5 w-full py-2.5 px-2 cursor-pointer transition-all hover:bg-white/5 ${
          pathname === "/" ? "border-l-2 border-green-400 bg-green-400/5" : "border-l-2 border-transparent"
        }`}>
        <span className="text-lg">🏠</span>
        <span className={`text-[9px] ${pathname === "/" ? "text-green-400" : "text-white/40"}`}>Dashboard</span>
      </button>

      <div className="w-12 h-px bg-white/5 my-1" />

      {navItems.map((item) => {
        const isActive = pathname === item.path;
        return (
          <button key={item.label} onClick={() => router.push(item.path)}
            className={`flex flex-col items-center gap-0.5 w-full py-2.5 px-2 cursor-pointer transition-all hover:bg-white/5 ${
              isActive ? "border-l-2 border-green-400 bg-green-400/5" : "border-l-2 border-transparent"
            }`}>
            <span className="text-lg">{item.icon}</span>
            <span className={`text-[9px] ${isActive ? "text-green-400" : "text-white/40"}`}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}