"use client";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useWatchlistStore } from "@/store/watchlistStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import { useSymbolStore, SYMBOLS } from "@/store/symbolStore";
import { useRouter } from "next/navigation";

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  return `$${vol.toFixed(0)}`;
}

const symbolMeta: Record<string, { name: string; emoji: string }> = {
  BTCUSDT: { name: "Bitcoin", emoji: "₿" },
  ETHUSDT: { name: "Ethereum", emoji: "Ξ" },
  SOLUSDT: { name: "Solana", emoji: "◎" },
  BNBUSDT: { name: "BNB", emoji: "🔶" },
  XRPUSDT: { name: "Ripple", emoji: "✕" },
  DOGEUSDT: { name: "Dogecoin", emoji: "🐕" },
  ADAUSDT: { name: "Cardano", emoji: "₳" },
  AVAXUSDT: { name: "Avalanche", emoji: "🔺" },
  DOTUSDT: { name: "Polkadot", emoji: "●" },
  LINKUSDT: { name: "Chainlink", emoji: "⬡" },
  MATICUSDT: { name: "Polygon", emoji: "Ⓟ" },
  LTCUSDT: { name: "Litecoin", emoji: "Ł" },
  ATOMUSDT: { name: "Cosmos", emoji: "⚛" },
  UNIUSDT: { name: "Uniswap", emoji: "🦄" },
  AAVEUSDT: { name: "Aave", emoji: "👻" },
};

export default function MarketsPage() {
  const { tickers, loading } = useMarketPrices();
  const { items: watchlist, addSymbol, removeSymbol } = useWatchlistStore();
  const { setActiveSymbol } = useSymbolStore();
  const router = useRouter();

  const tickerList = Object.values(tickers).sort((a, b) => b.quoteVolume - a.quoteVolume);
  const gainers = [...tickerList].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...tickerList].sort((a, b) => a.changePct - b.changePct).slice(0, 5);

  const totalVolume = tickerList.reduce((sum, t) => sum + t.quoteVolume, 0);
  const bullishCount = tickerList.filter(t => t.changePct > 0).length;
  const bearishCount = tickerList.filter(t => t.changePct < 0).length;

  const isWatchlisted = (symbol: string) => watchlist.some(w => w.symbol === symbol);

  const handleTradeSymbol = (symbol: string) => {
    const found = SYMBOLS.find(s => s.id === symbol);
    if (found) {
      setActiveSymbol(found);
      router.push("/");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">📊 Markets</h1>
              <p className="text-white/40 text-sm mt-1">Live crypto market overview — prices refresh every 15 seconds</p>
            </div>
            {!loading && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs">Live</span>
              </div>
            )}
          </div>

          {/* Market Overview Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="glass border border-white/5 rounded-xl p-4">
              <p className="text-white/40 text-xs mb-1">Total Volume (24h)</p>
              <p className="text-white text-xl font-bold">{formatVolume(totalVolume)}</p>
              <p className="text-white/30 text-xs mt-1">{tickerList.length} pairs tracked</p>
            </div>
            <div className="glass border border-white/5 rounded-xl p-4">
              <p className="text-white/40 text-xs mb-1">Market Sentiment</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-white/5 rounded-full h-2">
                  <div className="bg-green-400 h-2 rounded-full" style={{ width: `${(bullishCount / tickerList.length) * 100}%` }} />
                </div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-green-400 text-xs">{bullishCount} bullish</span>
                <span className="text-red-400 text-xs">{bearishCount} bearish</span>
              </div>
            </div>
            <div className="glass border border-green-500/10 border rounded-xl p-4">
              <p className="text-white/40 text-xs mb-1">Top Gainer</p>
              {gainers[0] && (
                <>
                  <p className="text-white font-bold">{gainers[0].symbol.replace("USDT", "")}</p>
                  <p className="text-green-400 text-xl font-bold">+{gainers[0].changePct.toFixed(2)}%</p>
                </>
              )}
            </div>
            <div className="glass border border-red-500/10 border rounded-xl p-4">
              <p className="text-white/40 text-xs mb-1">Top Loser</p>
              {losers[0] && (
                <>
                  <p className="text-white font-bold">{losers[0].symbol.replace("USDT", "")}</p>
                  <p className="text-red-400 text-xl font-bold">{losers[0].changePct.toFixed(2)}%</p>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-6">

            {/* Main Table */}
            <div className="flex-1">
              <div className="glass border border-white/5 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2">
                      <th className="text-left px-4 py-3 text-white/40">#</th>
                      <th className="text-left px-4 py-3 text-white/40">Asset</th>
                      <th className="text-right px-4 py-3 text-white/40">Price</th>
                      <th className="text-right px-4 py-3 text-white/40">24h Change</th>
                      <th className="text-right px-4 py-3 text-white/40">24h High</th>
                      <th className="text-right px-4 py-3 text-white/40">24h Low</th>
                      <th className="text-right px-4 py-3 text-white/40">Volume</th>
                      <th className="text-right px-4 py-3 text-white/40">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="h-4 bg-white/5 rounded animate-pulse" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      tickerList.map((ticker, i) => {
                        const meta = symbolMeta[ticker.symbol] || { name: ticker.symbol, emoji: "●" };
                        const watchlisted = isWatchlisted(ticker.symbol);
                        return (
                          <tr key={ticker.symbol} className="border-b border-white/5 hover:bg-white/2 transition">
                            <td className="px-4 py-3 text-white/30">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm">
                                  {meta.emoji}
                                </div>
                                <div>
                                  <p className="text-white font-semibold">{ticker.symbol.replace("USDT", "")}</p>
                                  <p className="text-white/30 text-xs">{meta.name}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-white font-semibold">
                              ${ticker.price.toLocaleString(undefined, { maximumFractionDigits: ticker.price > 100 ? 2 : 4 })}
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${ticker.changePct >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {ticker.changePct >= 0 ? "+" : ""}{ticker.changePct.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-right text-white/60">
                              ${ticker.high.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right text-white/60">
                              ${ticker.low.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right text-white/60">
                              {formatVolume(ticker.quoteVolume)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <button
                                  onClick={() => watchlisted ? removeSymbol(ticker.symbol) : addSymbol(ticker.symbol, ticker.symbol.replace("USDT", "/USDT"))}
                                  className={`text-xs px-2 py-1 rounded border transition ${watchlisted ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-white/30 bg-white/5 border-white/10 hover:border-white/20"}`}>
                                  {watchlisted ? "★" : "☆"}
                                </button>
                                <button
                                  onClick={() => handleTradeSymbol(ticker.symbol)}
                                  className="text-xs px-2 py-1 rounded border text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20 transition">
                                  Trade
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Side Panels */}
            <div className="w-56 shrink-0 flex flex-col gap-4">
              <div className="glass border border-green-500/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">🔥 Top Gainers</p>
                {gainers.map(t => (
                  <div key={t.symbol} className="flex items-center justify-between mb-2">
                    <span className="text-white/70 text-xs">{t.symbol.replace("USDT", "")}</span>
                    <span className="text-green-400 text-xs font-bold">+{t.changePct.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
              <div className="glass border border-red-500/10 rounded-xl p-4">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">📉 Top Losers</p>
                {losers.map(t => (
                  <div key={t.symbol} className="flex items-center justify-between mb-2">
                    <span className="text-white/70 text-xs">{t.symbol.replace("USDT", "")}</span>
                    <span className="text-red-400 text-xs font-bold">{t.changePct.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
              <div className="glass border border-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">💎 Watchlisted</p>
                {watchlist.slice(0, 5).map(w => (
                  <div key={w.symbol} className="flex items-center justify-between mb-2">
                    <span className="text-white/70 text-xs">{w.label}</span>
                    <span className={`text-xs font-bold ${w.changePct24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {w.changePct24h >= 0 ? "+" : ""}{w.changePct24h.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}