"use client";
import { useState } from "react";
import { useNewsStore, CalendarEvent, NewsImpact } from "@/store/newsStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

const impactColors: Record<NewsImpact, string> = {
  HIGH: "text-red-400 bg-red-500/10 border-red-500/20",
  MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  LOW: "text-green-400 bg-green-500/10 border-green-500/20",
};

const sentimentColors: Record<string, string> = {
  bullish: "text-green-400 bg-green-500/10 border-green-500/20",
  bearish: "text-red-400 bg-red-500/10 border-red-500/20",
  neutral: "text-white/40 bg-white/5 border-white/10",
};

function timeUntil(date: Date): string {
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return "Released";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function NewsPage() {
  const { news, calendarEvents, selectedAssetFilter, setAssetFilter } = useNewsStore();
  const [activeTab, setActiveTab] = useState<"news" | "calendar">("calendar");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [impactFilter, setImpactFilter] = useState<string>("ALL");

  const filteredNews = news.filter(n =>
    selectedAssetFilter === "ALL" || n.asset === selectedAssetFilter
  );

  const filteredEvents = calendarEvents
    .filter(e => impactFilter === "ALL" || e.impact === impactFilter)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const todayEvents = filteredEvents.filter(e => {
    const d = new Date(e.scheduledAt);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });

  const upcomingEvents = filteredEvents.filter(e => {
    const d = new Date(e.scheduledAt);
    const today = new Date();
    return d.getDate() !== today.getDate() || d.getMonth() !== today.getMonth();
  });

  const assets = ["ALL", "XAUUSD", "EURUSD", "GBPUSD", "BTCUSDT", "ETHUSDT", "USOIL", "USDJPY"];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-hidden flex">

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">📰 News & Calendar</h1>
                <p className="text-white/40 text-sm mt-1">Live market news, economic events, and AI explanations.</p>
              </div>
              <div className="glass border border-red-500/20 bg-red-500/5 px-4 py-2 rounded-xl">
                <p className="text-red-400 text-xs font-semibold">
                  🔴 {calendarEvents.filter(e => e.impact === "HIGH" && e.status === "upcoming" && new Date(e.scheduledAt).getDate() === new Date().getDate()).length} HIGH IMPACT events today
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-6">
              {(["calendar", "news"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                  {tab === "calendar" ? "📅 Economic Calendar" : "📰 Market News"}
                </button>
              ))}
            </div>

            {/* Calendar */}
            {activeTab === "calendar" && (
              <div>
                <div className="flex gap-2 mb-4">
                  {["ALL", "HIGH", "MEDIUM", "LOW"].map(impact => (
                    <button key={impact} onClick={() => setImpactFilter(impact)}
                      className={`text-xs px-3 py-1 rounded-full border transition ${impactFilter === impact ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                      {impact}
                    </button>
                  ))}
                </div>

                {/* Today */}
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Today — {new Date().toDateString()}</p>
                <div className="flex flex-col gap-2 mb-6">
                  {todayEvents.map(event => (
                    <div key={event.id}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                      className={`glass border rounded-xl p-4 cursor-pointer transition ${selectedEvent?.id === event.id ? "border-green-500/20 bg-green-500/5" : "border-white/5 hover:border-white/10"}`}>
                      <div className="flex items-center gap-4">
                        <div className="text-center w-16 shrink-0">
                          <p className="text-white text-sm font-bold">{formatTime(event.scheduledAt)}</p>
                          <p className={`text-xs font-semibold ${event.status === "released" ? "text-white/30" : "text-amber-400"}`}>
                            {event.status === "released" ? "Released" : timeUntil(event.scheduledAt)}
                          </p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <span className="text-xl shrink-0">{event.countryFlag}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-white text-sm font-semibold">{event.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${impactColors[event.impact]}`}>{event.impact}</span>
                          </div>
                          <p className="text-white/30 text-xs">{event.country} · {event.category}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {event.forecast && <p className="text-xs text-white/40">Forecast: <span className="text-white">{event.forecast}</span></p>}
                          {event.previous && <p className="text-xs text-white/40">Previous: <span className="text-white/60">{event.previous}</span></p>}
                          {event.actual && <p className="text-xs text-white/40">Actual: <span className={parseFloat(event.actual) >= parseFloat(event.forecast || "0") ? "text-green-400" : "text-red-400"}>{event.actual}</span></p>}
                        </div>
                      </div>

                      {selectedEvent?.id === event.id && (
                        <div className="mt-4 border-t border-white/5 pt-4">
                          <div className="flex gap-2 flex-wrap mb-3">
                            {event.affectedAssets.map(asset => (
                              <span key={asset} className="text-xs bg-white/5 text-white/50 border border-white/10 px-2 py-0.5 rounded-full">{asset}</span>
                            ))}
                          </div>
                          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
                            <p className="text-indigo-400 text-xs font-semibold mb-1">🤖 AI Explanation</p>
                            <p className="text-white/60 text-xs leading-relaxed">{event.aiExplanation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Upcoming */}
                {upcomingEvents.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Upcoming</p>
                    <div className="flex flex-col gap-2">
                      {upcomingEvents.map(event => (
                        <div key={event.id}
                          onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                          className={`glass border rounded-xl p-4 cursor-pointer transition ${selectedEvent?.id === event.id ? "border-green-500/20 bg-green-500/5" : "border-white/5 hover:border-white/10"}`}>
                          <div className="flex items-center gap-4">
                            <div className="text-center w-16 shrink-0">
                              <p className="text-white/60 text-xs">{new Date(event.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })}</p>
                              <p className="text-white text-sm font-bold">{formatTime(event.scheduledAt)}</p>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <span className="text-xl shrink-0">{event.countryFlag}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-white/70 text-sm font-semibold">{event.title}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${impactColors[event.impact]}`}>{event.impact}</span>
                              </div>
                              <p className="text-white/30 text-xs">{event.country} · {event.category}</p>
                            </div>
                            <div className="text-right shrink-0">
                              {event.forecast && <p className="text-xs text-white/40">Forecast: <span className="text-white/60">{event.forecast}</span></p>}
                              {event.previous && <p className="text-xs text-white/40">Previous: <span className="text-white/40">{event.previous}</span></p>}
                            </div>
                          </div>

                          {selectedEvent?.id === event.id && (
                            <div className="mt-4 border-t border-white/5 pt-4">
                              <div className="flex gap-2 flex-wrap mb-3">
                                {event.affectedAssets.map(asset => (
                                  <span key={asset} className="text-xs bg-white/5 text-white/50 border border-white/10 px-2 py-0.5 rounded-full">{asset}</span>
                                ))}
                              </div>
                              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
                                <p className="text-indigo-400 text-xs font-semibold mb-1">🤖 AI Explanation</p>
                                <p className="text-white/60 text-xs leading-relaxed">{event.aiExplanation}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* News */}
            {activeTab === "news" && (
              <div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {assets.map(asset => (
                    <button key={asset} onClick={() => setAssetFilter(asset)}
                      className={`text-xs px-3 py-1 rounded-full border transition ${selectedAssetFilter === asset ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10"}`}>
                      {asset}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {filteredNews.map(item => (
                    <div key={item.id} className="glass border border-white/5 rounded-xl p-5 hover:border-white/10 transition">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">{item.asset}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${sentimentColors[item.sentiment]}`}>
                              {item.sentiment === "bullish" ? "📈" : item.sentiment === "bearish" ? "📉" : "➡"} {item.sentiment}
                            </span>
                            <span className="text-white/20 text-xs">{item.source}</span>
                            <span className="text-white/20 text-xs ml-auto">
                              {Math.floor((Date.now() - new Date(item.timestamp).getTime()) / 3600000)}h ago
                            </span>
                          </div>
                          <h3 className="text-white font-semibold text-sm mb-2">{item.title}</h3>
                          <p className="text-white/50 text-xs leading-relaxed mb-3">{item.summary}</p>
                          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
                            <p className="text-indigo-400 text-xs font-semibold mb-1">🤖 What this means for traders</p>
                            <p className="text-white/60 text-xs leading-relaxed">{item.aiExplanation}</p>
                          </div>
                        </div>
                        <div className="text-center shrink-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border ${item.sentimentScore >= 60 ? "bg-green-500/10 border-green-500/20 text-green-400" : item.sentimentScore <= 40 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-white/5 border-white/10 text-white/40"}`}>
                            {item.sentimentScore}
                          </div>
                          <p className="text-white/20 text-xs mt-1">Sentiment</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — Today's Risk Panel */}
          <div className="w-64 shrink-0 glass border-l border-white/5 overflow-y-auto p-4">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-4">Today's Risk Events</p>
            {todayEvents.filter(e => e.impact === "HIGH").map(event => (
              <div key={event.id} className="mb-3 glass border border-red-500/20 bg-red-500/5 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>{event.countryFlag}</span>
                  <span className="text-red-400 text-xs font-semibold">HIGH</span>
                </div>
                <p className="text-white/70 text-xs font-semibold">{event.title}</p>
                <p className="text-red-400 text-xs mt-1">{formatTime(event.scheduledAt)} · {timeUntil(event.scheduledAt)}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {event.affectedAssets.slice(0, 3).map(a => (
                    <span key={a} className="text-xs text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Sentiment Heatmap</p>
              {[
                { asset: "XAUUSD", bias: "Bullish", pct: 72 },
                { asset: "EURUSD", bias: "Bearish", pct: 35 },
                { asset: "GBPUSD", bias: "Bullish", pct: 65 },
                { asset: "BTCUSDT", bias: "Neutral", pct: 52 },
                { asset: "ETHUSDT", bias: "Bullish", pct: 68 },
              ].map(item => (
                <div key={item.asset} className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-white/50 text-xs">{item.asset}</span>
                    <span className={`text-xs font-semibold ${item.pct >= 60 ? "text-green-400" : item.pct <= 40 ? "text-red-400" : "text-amber-400"}`}>{item.bias}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${item.pct >= 60 ? "bg-green-400" : item.pct <= 40 ? "bg-red-400" : "bg-amber-400"}`}
                      style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}