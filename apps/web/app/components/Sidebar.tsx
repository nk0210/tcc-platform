"use client";
import { useState } from "react";

const navItems = [
  { icon: "📊", label: "Markets" },
  { icon: "👁", label: "Watchlist" },
  { icon: "📓", label: "Journal" },
  { icon: "🎯", label: "Playbook" },
  { icon: "🏆", label: "Competition" },
  { icon: "🎓", label: "Academy" },
  { icon: "👥", label: "Community" },
  { icon: "📈", label: "Analytics" },
];

export default function Sidebar() {
  const [active, setActive] = useState("Markets");

  return (
    <div className="glass flex flex-col w-20 border-r border-white/5 py-4 items-center gap-2">
      {navItems.map((item) => (
        <button
          key={item.label}
          onClick={() => setActive(item.label)}
          className={`flex flex-col items-center gap-1 w-full py-3 px-2 cursor-pointer transition-all hover:bg-white/5 ${
            active === item.label
              ? "border-l-2 border-green-400 bg-green-400/5"
              : "border-l-2 border-transparent"
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span className={`text-[10px] ${active === item.label ? "text-green-400" : "text-white/40"}`}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}