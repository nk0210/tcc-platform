"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const navItems = [
  { icon: "📊", label: "Markets", path: "/" },
  { icon: "👁", label: "Watchlist", path: "/" },
  { icon: "📡", label: "Copy", path: "/copy-trading" },
  { icon: "📓", label: "Journal", path: "/journal" },
  { icon: "🎯", label: "Playbook", path: "/" },
  { icon: "🏆", label: "Competition", path: "/competition" },
  { icon: "🎓", label: "Academy", path: "/" },
  { icon: "👥", label: "Community", path: "/community" },
  { icon: "📈", label: "Analytics", path: "/analytics" },
];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="glass flex flex-col w-20 border-r border-white/5 py-4 items-center gap-2">
      {navItems.map((item) => (
        <button
          key={item.label}
          onClick={() => router.push(item.path)}
          className={`flex flex-col items-center gap-1 w-full py-3 px-2 cursor-pointer transition-all hover:bg-white/5 ${
            pathname === item.path && item.path !== "/"
              ? "border-l-2 border-green-400 bg-green-400/5"
              : pathname === "/" && item.label === "Markets"
              ? "border-l-2 border-green-400 bg-green-400/5"
              : "border-l-2 border-transparent"
          }`}
        >
          <span className="text-xl">{item.icon}</span>
          <span className={`text-[10px] ${
            pathname === item.path && item.path !== "/"
              ? "text-green-400"
              : pathname === "/" && item.label === "Markets"
              ? "text-green-400"
              : "text-white/40"
          }`}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}