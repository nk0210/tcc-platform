export default function RightPanel() {
  return (
    <div className="glass flex flex-col w-72 border-l border-white/5 overflow-y-auto">

      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Risk Score</span>
          <span className="text-xs text-red-400 font-bold">EXTREME</span>
        </div>
        <div className="w-full bg-white/5 rounded-full h-2 mb-2">
          <div className="bg-gradient-to-r from-green-400 via-amber-400 to-red-500 h-2 rounded-full" style={{width: "82%"}}></div>
        </div>
        <div className="flex justify-between">
          <span className="text-white/30 text-xs">0</span>
          <span className="text-red-400 text-sm font-bold">82/100</span>
          <span className="text-white/30 text-xs">100</span>
        </div>
        <p className="text-white/40 text-xs mt-2">Trading before CPI + 3 correlated positions open</p>
      </div>

      <div className="p-4 border-b border-white/5">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Sentiment</span>
        <div className="mt-3 flex flex-col gap-2">
          {[
            { asset: "XAUUSD", bias: "Bullish", pct: 68, color: "green" },
            { asset: "EURUSD", bias: "Bearish", pct: 42, color: "red" },
            { asset: "GBPUSD", bias: "Neutral", pct: 51, color: "amber" },
          ].map((item) => (
            <div key={item.asset} className="flex items-center gap-2">
              <span className="text-white/60 text-xs w-16">{item.asset}</span>
              <div className="flex-1 bg-white/5 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${item.color === "green" ? "bg-green-400" : item.color === "red" ? "bg-red-400" : "bg-amber-400"}`}
                  style={{width: `${item.pct}%`}}
                ></div>
              </div>
              <span className={`text-xs font-semibold ${item.color === "green" ? "text-green-400" : item.color === "red" ? "text-red-400" : "text-amber-400"}`}>
                {item.bias}
              </span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-xs mt-3 italic">"Gold bullish — weak dollar + geopolitical risk"</p>
      </div>

      <div className="p-4 border-b border-white/5">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">News</span>
        <div className="mt-3 flex flex-col gap-3">
          {[
            { time: "14:30", event: "US CPI Data Release", impact: "HIGH" },
            { time: "16:00", event: "Fed Chair Speech", impact: "HIGH" },
            { time: "18:00", event: "Crude Oil Inventories", impact: "MED" },
          ].map((item) => (
            <div key={item.event} className="flex items-start gap-2">
              <span className="text-white/30 text-xs w-10 mt-0.5">{item.time}</span>
              <div className="flex-1">
                <p className="text-white/70 text-xs">{item.event}</p>
                <span className={`text-xs font-bold ${item.impact === "HIGH" ? "text-red-400" : "text-amber-400"}`}>
                  {item.impact}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">AI Assistant</span>
        <div className="mt-3 bg-green-400/5 border border-green-400/10 rounded-lg p-3">
          <p className="text-white/70 text-xs leading-relaxed">
            "Your last 3 losses occurred after 3PM. Current time is 2:45PM — consider waiting for tomorrow's London session."
          </p>
        </div>
      </div>

    </div>
  );
}