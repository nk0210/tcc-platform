export default function CenterChart() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      
      <div className="glass flex items-center gap-4 px-4 py-2 border-b border-white/5">
        <span className="text-white font-semibold">XAUUSD</span>
        <span className="neon-green text-lg font-bold">2,345.50</span>
        <span className="neon-green text-xs">+12.30 (+0.53%)</span>
        <div className="flex gap-2 ml-4">
          {["1M","5M","15M","1H","4H","1D","1W"].map((tf) => (
            <button key={tf} className="text-xs px-2 py-1 rounded text-white/40 hover:text-green-400 hover:bg-green-400/10 transition">
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 glass m-2 rounded-lg flex items-center justify-center border border-white/5">
        <div className="text-center">
          <div className="text-6xl mb-4">📈</div>
          <p className="text-white/40 text-sm">Live chart loads here</p>
          <p className="text-white/20 text-xs mt-1">TradingView integration — Day 2</p>
        </div>
      </div>

      <div className="glass flex items-center gap-4 px-4 py-3 border-t border-white/5">
        <button className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
          BUY
        </button>
        <button className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
          SELL
        </button>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-white/40 text-xs">Lot Size</span>
          <input className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" defaultValue="0.01" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">SL</span>
          <input className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" defaultValue="2330.00" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">TP</span>
          <input className="bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm w-20 text-center" defaultValue="2365.00" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-white/40 text-xs">Risk</span>
          <span className="text-amber-400 text-sm font-semibold">1.2%</span>
        </div>
      </div>

    </div>
  );
}