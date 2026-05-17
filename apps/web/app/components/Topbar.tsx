export default function Topbar() {
  return (
    <div className="glass flex items-center justify-between px-6 py-3 border-b border-white/5 z-10">
      
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold neon-green tracking-widest">TCC</span>
        <span className="text-xs text-white/30 tracking-widest uppercase">Trader's Command Center</span>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Equity</span>
          <span className="text-sm font-semibold text-white">$10,000.00</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">P&L Today</span>
          <span className="text-sm font-semibold neon-green">+$240.50</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Margin Used</span>
          <span className="text-sm font-semibold text-amber-400">12.4%</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-white/40">Mode</span>
          <span className="text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">Paper</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <span className="text-white/50 text-lg cursor-pointer hover:text-white transition">🔔</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></span>
        </div>
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 text-sm font-bold">N</div>
          <span className="text-sm text-white/70">nk0210</span>
        </div>
      </div>

    </div>
  );
}