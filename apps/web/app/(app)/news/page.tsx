"use client";
import { useState } from "react";
import { useNewsStore, CalendarEvent, NewsImpact } from "@/store/newsStore";

const impactColors: Record<NewsImpact, string> = {
  HIGH: "text-danger bg-danger-soft border-danger/30",
  MEDIUM: "text-warning bg-warning-soft border-warning/30",
  LOW: "text-success bg-success-soft border-success/30",
};

const sentimentColors: Record<string, string> = {
  bullish: "text-success bg-success-soft border-success/30",
  bearish: "text-danger bg-danger-soft border-danger/30",
  neutral: "text-fg-dim bg-elevated border-border",
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
        <div className="flex-1 overflow-hidden flex">

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-fg">📰 News & Calendar</h1>
                <p className="text-fg-dim text-sm mt-1">Live market news, economic events, and AI explanations.</p>
              </div>
              <div className="glass border border-danger/30 bg-danger-soft px-4 py-2 rounded-xl">
                <p className="text-danger text-xs font-semibold">
                  🔴 {calendarEvents.filter(e => e.impact === "HIGH" && e.status === "upcoming" && new Date(e.scheduledAt).getDate() === new Date().getDate()).length} HIGH IMPACT events today
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-elevated rounded-lg p-1 mb-6">
              {(["calendar", "news"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-success-soft text-success" : "text-fg-dim"}`}>
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
                      className={`text-xs px-3 py-1 rounded-full border transition ${impactFilter === impact ? "bg-success-soft text-success border-success/30" : "bg-elevated text-fg-dim border-border"}`}>
                      {impact}
                    </button>
                  ))}
                </div>

                {/* Today */}
                <p className="text-xs font-semibold text-fg-dim uppercase tracking-wider mb-3">Today — {new Date().toDateString()}</p>
                <div className="flex flex-col gap-2 mb-6">
                  {todayEvents.map(event => (
                    <div key={event.id}
                      onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                      className={`glass border rounded-xl p-4 cursor-pointer transition ${selectedEvent?.id === event.id ? "border-success/30 bg-success-soft" : "border-border hover:border-border"}`}>
                      <div className="flex items-center gap-4">
                        <div className="text-center w-16 shrink-0">
                          <p className="text-fg text-sm font-bold">{formatTime(event.scheduledAt)}</p>
                          <p className={`text-xs font-semibold ${event.status === "released" ? "text-fg-dim" : "text-warning"}`}>
                            {event.status === "released" ? "Released" : timeUntil(event.scheduledAt)}
                          </p>
                        </div>
                        <div className="w-px h-8 bg-elevated" />
                        <span className="text-xl shrink-0">{event.countryFlag}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-fg text-sm font-semibold">{event.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${impactColors[event.impact]}`}>{event.impact}</span>
                          </div>
                          <p className="text-fg-dim text-xs">{event.country} · {event.category}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {event.forecast && <p className="text-xs text-fg-dim">Forecast: <span className="text-fg">{event.forecast}</span></p>}
                          {event.previous && <p className="text-xs text-fg-dim">Previous: <span className="text-fg-muted">{event.previous}</span></p>}
                          {event.actual && <p className="text-xs text-fg-dim">Actual: <span className={parseFloat(event.actual) >= parseFloat(event.forecast || "0") ? "text-success" : "text-danger"}>{event.actual}</span></p>}
                        </div>
                      </div>

                      {selectedEvent?.id === event.id && (
                        <div className="mt-4 border-t border-border pt-4">
                          <div className="flex gap-2 flex-wrap mb-3">
                            {event.affectedAssets.map(asset => (
                              <span key={asset} className="text-xs bg-elevated text-fg-muted border border-border px-2 py-0.5 rounded-full">{asset}</span>
                            ))}
                          </div>
                          <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                            <p className="text-accent-hover text-xs font-semibold mb-1">🤖 AI Explanation</p>
                            <p className="text-fg-muted text-xs leading-relaxed">{event.aiExplanation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Upcoming */}
                {upcomingEvents.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-fg-dim uppercase tracking-wider mb-3">Upcoming</p>
                    <div className="flex flex-col gap-2">
                      {upcomingEvents.map(event => (
                        <div key={event.id}
                          onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                          className={`glass border rounded-xl p-4 cursor-pointer transition ${selectedEvent?.id === event.id ? "border-success/30 bg-success-soft" : "border-border hover:border-border"}`}>
                          <div className="flex items-center gap-4">
                            <div className="text-center w-16 shrink-0">
                              <p className="text-fg-muted text-xs">{new Date(event.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })}</p>
                              <p className="text-fg text-sm font-bold">{formatTime(event.scheduledAt)}</p>
                            </div>
                            <div className="w-px h-8 bg-elevated" />
                            <span className="text-xl shrink-0">{event.countryFlag}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-fg-muted text-sm font-semibold">{event.title}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${impactColors[event.impact]}`}>{event.impact}</span>
                              </div>
                              <p className="text-fg-dim text-xs">{event.country} · {event.category}</p>
                            </div>
                            <div className="text-right shrink-0">
                              {event.forecast && <p className="text-xs text-fg-dim">Forecast: <span className="text-fg-muted">{event.forecast}</span></p>}
                              {event.previous && <p className="text-xs text-fg-dim">Previous: <span className="text-fg-dim">{event.previous}</span></p>}
                            </div>
                          </div>

                          {selectedEvent?.id === event.id && (
                            <div className="mt-4 border-t border-border pt-4">
                              <div className="flex gap-2 flex-wrap mb-3">
                                {event.affectedAssets.map(asset => (
                                  <span key={asset} className="text-xs bg-elevated text-fg-muted border border-border px-2 py-0.5 rounded-full">{asset}</span>
                                ))}
                              </div>
                              <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                                <p className="text-accent-hover text-xs font-semibold mb-1">🤖 AI Explanation</p>
                                <p className="text-fg-muted text-xs leading-relaxed">{event.aiExplanation}</p>
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
                      className={`text-xs px-3 py-1 rounded-full border transition ${selectedAssetFilter === asset ? "bg-success-soft text-success border-success/30" : "bg-elevated text-fg-dim border-border"}`}>
                      {asset}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  {filteredNews.map(item => (
                    <div key={item.id} className="glass border border-border rounded-xl p-5 hover:border-border transition">
                      <div className="flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs bg-elevated text-fg-dim border border-border px-2 py-0.5 rounded-full">{item.asset}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${sentimentColors[item.sentiment]}`}>
                              {item.sentiment === "bullish" ? "📈" : item.sentiment === "bearish" ? "📉" : "➡"} {item.sentiment}
                            </span>
                            <span className="text-fg-dim text-xs">{item.source}</span>
                            <span className="text-fg-dim text-xs ml-auto">
                              {Math.floor((Date.now() - new Date(item.timestamp).getTime()) / 3600000)}h ago
                            </span>
                          </div>
                          <h3 className="text-fg font-semibold text-sm mb-2">{item.title}</h3>
                          <p className="text-fg-muted text-xs leading-relaxed mb-3">{item.summary}</p>
                          <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                            <p className="text-accent-hover text-xs font-semibold mb-1">🤖 What this means for traders</p>
                            <p className="text-fg-muted text-xs leading-relaxed">{item.aiExplanation}</p>
                          </div>
                        </div>
                        <div className="text-center shrink-0">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border ${item.sentimentScore >= 60 ? "bg-success-soft border-success/30 text-success" : item.sentimentScore <= 40 ? "bg-danger-soft border-danger/30 text-danger" : "bg-elevated border-border text-fg-dim"}`}>
                            {item.sentimentScore}
                          </div>
                          <p className="text-fg-dim text-xs mt-1">Sentiment</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — Today's Risk Panel */}
          <div className="w-64 shrink-0 glass border-l border-border overflow-y-auto p-4">
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-4">Today's Risk Events</p>
            {todayEvents.filter(e => e.impact === "HIGH").map(event => (
              <div key={event.id} className="mb-3 glass border border-danger/30 bg-danger-soft rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>{event.countryFlag}</span>
                  <span className="text-danger text-xs font-semibold">HIGH</span>
                </div>
                <p className="text-fg-muted text-xs font-semibold">{event.title}</p>
                <p className="text-danger text-xs mt-1">{formatTime(event.scheduledAt)} · {timeUntil(event.scheduledAt)}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {event.affectedAssets.slice(0, 3).map(a => (
                    <span key={a} className="text-xs text-fg-dim bg-elevated px-1.5 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Sentiment Heatmap</p>
              {[
                { asset: "XAUUSD", bias: "Bullish", pct: 72 },
                { asset: "EURUSD", bias: "Bearish", pct: 35 },
                { asset: "GBPUSD", bias: "Bullish", pct: 65 },
                { asset: "BTCUSDT", bias: "Neutral", pct: 52 },
                { asset: "ETHUSDT", bias: "Bullish", pct: 68 },
              ].map(item => (
                <div key={item.asset} className="mb-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-fg-muted text-xs">{item.asset}</span>
                    <span className={`text-xs font-semibold ${item.pct >= 60 ? "text-success" : item.pct <= 40 ? "text-danger" : "text-warning"}`}>{item.bias}</span>
                  </div>
                  <div className="w-full bg-elevated rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${item.pct >= 60 ? "bg-success" : item.pct <= 40 ? "bg-danger" : "bg-warning"}`}
                      style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
  );
}