"use client";
import { useState } from "react";
import { useMentoringStore, MentorProfile } from "@/store/mentoringStore";
import { useAuthStore } from "@/store/authStore";
import { useJournalStore } from "@/store/journalStore";
import ReportButton from "@/components/ReportButton";

export default function MentoringPage() {
  const { mentors, sessions, tradeReviews, pods, bookSession, joinPod, leavePod, requestReview } = useMentoringStore();
  const { user } = useAuthStore();
  const { entries } = useJournalStore();
  const [activeTab, setActiveTab] = useState<"discover" | "sessions" | "reviews" | "pods">("discover");
  const [selectedMentor, setSelectedMentor] = useState<MentorProfile | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [showReviewRequest, setShowReviewRequest] = useState(false);
  const [bookingForm, setBookingForm] = useState({ topic: "", date: "", duration: 60, price: 0 });
  const [reviewForm, setReviewForm] = useState({ mentorHandle: "", tradeId: "" });

  const handleBook = () => {
    if (!selectedMentor || !bookingForm.topic || !bookingForm.date) return;
    bookSession({
      mentorId: selectedMentor.id,
      mentorHandle: selectedMentor.handle,
      studentHandle: user?.handle || "guest",
      topic: bookingForm.topic,
      scheduledAt: new Date(bookingForm.date),
      duration: bookingForm.duration,
      status: "upcoming",
      notes: "",
      price: bookingForm.price,
    });
    setShowBooking(false);
    setSelectedMentor(null);
    setActiveTab("sessions");
  };

  const handleReviewRequest = () => {
    if (!reviewForm.mentorHandle || !reviewForm.tradeId) return;
    const trade = entries.find(e => e.id === reviewForm.tradeId);
    if (!trade) return;
    requestReview({
      mentorHandle: reviewForm.mentorHandle,
      studentHandle: user?.handle || "guest",
      tradeSymbol: trade.symbol,
      tradeDirection: trade.side,
      entryPrice: trade.entryPrice,
    });
    setShowReviewRequest(false);
    setActiveTab("reviews");
  };

  return (
    <>
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-fg">👨‍🏫 Mentoring</h1>
              <p className="text-fg-dim text-sm mt-1">Learn 1:1 from verified pro traders. Book sessions, get trade reviews, join pods.</p>
            </div>
            <button onClick={() => setShowReviewRequest(true)}
              className="bg-accent-soft text-accent-hover border border-accent/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-accent/22 transition">
              📝 Request Trade Review
            </button>
          </div>

          <div className="flex gap-1 bg-elevated rounded-lg p-1 mb-6">
            {(["discover", "sessions", "reviews", "pods"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-success-soft text-success" : "text-fg-dim"}`}>
                {tab === "discover" ? "🔍 Find Mentor" : tab === "sessions" ? `📅 Sessions (${sessions.length})` : tab === "reviews" ? `📝 Reviews (${tradeReviews.length})` : "👥 Pods"}
              </button>
            ))}
          </div>

          {/* Discover */}
          {activeTab === "discover" && (
            <div className="grid grid-cols-2 gap-4">
              {mentors.map((mentor) => (
                <div key={mentor.id} className="glass border border-border rounded-xl p-5 hover:border-border transition">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-success-soft border border-success/30 flex items-center justify-center text-success text-2xl font-bold shrink-0">
                      {mentor.handle[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-fg font-bold">{mentor.handle}</span>
                        <span className="text-success text-xs">✓ Verified</span>
                      </div>
                      <p className="text-fg-dim text-xs">{mentor.tccId}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {mentor.specialty.slice(0, 3).map(s => (
                          <span key={s} className="text-xs bg-elevated text-fg-dim px-1.5 py-0.5 rounded-full border border-border">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-success font-bold text-lg">${mentor.hourlyRate}/hr</p>
                        <p className="text-fg-dim text-xs">{mentor.students} students</p>
                      </div>
                      <ReportButton
                        reportedItemType="mentor"
                        reportedItemId={mentor.id}
                        reportedItemTitle={`${mentor.handle} — Mentor`}
                        reportedUserId={mentor.handle}
                        sourceFeature="Mentoring Discovery"
                        compact
                      />
                    </div>
                  </div>

                  <p className="text-fg-muted text-xs leading-relaxed mb-4 line-clamp-2">{mentor.bio}</p>

                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: "Win Rate", value: `${mentor.winRate}%`, color: "text-success" },
                      { label: "Rating", value: `⭐ ${mentor.rating}`, color: "text-warning" },
                      { label: "Completion", value: `${mentor.completionRate}%`, color: "text-blue-400" },
                      { label: "Reviews", value: mentor.totalReviews, color: "text-fg" },
                    ].map(stat => (
                      <div key={stat.label} className="glass border border-border rounded-lg p-2 text-center">
                        <p className="text-fg-dim text-xs">{stat.label}</p>
                        <p className={`text-xs font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {mentor.badges.map(badge => (
                      <span key={badge} className="text-xs bg-warning-soft text-warning border border-warning/30 px-2 py-0.5 rounded-full">{badge}</span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-fg-dim">🕐 {mentor.availability}</div>
                    <button
                      onClick={() => { setSelectedMentor(mentor); setBookingForm({ ...bookingForm, price: mentor.hourlyRate }); setShowBooking(true); }}
                      className="bg-success-soft hover:bg-success/22 text-success border border-success/30 px-4 py-1.5 rounded-lg text-xs font-semibold transition">
                      📅 Book Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sessions */}
          {activeTab === "sessions" && (
            <div className="flex flex-col gap-4">
              {sessions.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-5xl mb-3">📅</p>
                    <p className="text-fg-dim">No sessions booked yet</p>
                    <p className="text-fg-dim text-sm mt-1">Go to Find Mentor to book your first 1:1 session</p>
                  </div>
                </div>
              ) : (
                sessions.map(session => (
                  <div key={session.id} className="glass border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-success-soft border border-success/30 flex items-center justify-center text-success font-bold">
                          {session.mentorHandle[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-fg font-semibold">{session.mentorHandle}</p>
                          <p className="text-fg-dim text-xs">{session.topic}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full border ${session.status === "upcoming" ? "text-success bg-success-soft border-success/30" : "text-fg-dim bg-elevated border-border"}`}>
                          {session.status === "upcoming" ? "⏰ Upcoming" : session.status === "completed" ? "✓ Completed" : "✕ Cancelled"}
                        </span>
                        <ReportButton
                          reportedItemType="mentor"
                          reportedItemId={session.mentorId}
                          reportedItemTitle={`Session with ${session.mentorHandle}: ${session.topic}`}
                          reportedUserId={session.mentorHandle}
                          sourceFeature="Mentoring Sessions"
                          compact
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs text-fg-dim">
                      <span>📅 {new Date(session.scheduledAt).toLocaleDateString()}</span>
                      <span>⏱ {session.duration} min</span>
                      <span>💰 ${session.price}</span>
                    </div>
                    {session.status === "upcoming" && (
                      <div className="mt-3 flex gap-2">
                        <a href={session.meetingUrl} target="_blank" rel="noreferrer"
                          className="bg-success-soft text-success border border-success/30 px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-success/22 transition">
                          🎥 Join Session
                        </a>
                        <button className="bg-elevated text-fg-dim border border-border px-3 py-1.5 rounded-lg text-xs transition hover:bg-elevated">
                          Reschedule
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Trade Reviews */}
          {activeTab === "reviews" && (
            <div className="flex flex-col gap-4">
              {tradeReviews.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-5xl mb-3">📝</p>
                    <p className="text-fg-dim">No trade reviews yet</p>
                    <button onClick={() => setShowReviewRequest(true)}
                      className="mt-3 bg-accent-soft text-accent-hover border border-accent/30 px-4 py-2 rounded-lg text-sm font-semibold">
                      Request your first review
                    </button>
                  </div>
                </div>
              ) : (
                tradeReviews.map(review => (
                  <div key={review.id} className="glass border border-border rounded-xl p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent/30 flex items-center justify-center text-accent-hover font-bold">
                          {review.mentorHandle[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-fg font-semibold">{review.mentorHandle}</p>
                          <p className="text-fg-dim text-xs">
                            {review.tradeDirection} {review.tradeSymbol} @ ${review.entryPrice.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.status === "reviewed" && review.rating > 0 && (
                          <span className="text-warning font-bold">{review.rating}/10</span>
                        )}
                        <span className={`text-xs px-2 py-1 rounded-full border ${review.status === "reviewed" ? "text-success bg-success-soft border-success/30" : "text-warning bg-warning-soft border-warning/30"}`}>
                          {review.status === "reviewed" ? "✓ Reviewed" : "⏳ Pending"}
                        </span>
                        <ReportButton
                          reportedItemType="mentor"
                          reportedItemId={review.id}
                          reportedItemTitle={`Trade review by ${review.mentorHandle}`}
                          reportedUserId={review.mentorHandle}
                          sourceFeature="Mentoring Trade Reviews"
                          compact
                        />
                      </div>
                    </div>

                    <div className="glass border border-border rounded-lg p-4 mb-3">
                      <p className="text-accent-hover text-xs font-semibold mb-1">💬 Mentor Feedback</p>
                      <p className="text-fg-muted text-sm leading-relaxed">{review.mentorComment}</p>
                    </div>

                    {review.strengths.length > 0 && (
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <p className="text-success text-xs font-semibold mb-2">✅ Strengths</p>
                          {review.strengths.map((s, i) => <p key={i} className="text-fg-muted text-xs">• {s}</p>)}
                        </div>
                        <div className="flex-1">
                          <p className="text-warning text-xs font-semibold mb-2">⚡ Improvements</p>
                          {review.improvements.map((imp, i) => <p key={i} className="text-fg-muted text-xs">• {imp}</p>)}
                        </div>
                      </div>
                    )}
                    <p className="text-fg-dim text-xs mt-3">{new Date(review.timestamp).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pods */}
          {activeTab === "pods" && (
            <div className="grid grid-cols-2 gap-4">
              {pods.map(pod => (
                <div key={pod.id} className="glass border border-border rounded-xl p-5 hover:border-border transition">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-fg font-semibold">{pod.name}</p>
                        {pod.isPrivate && <span className="text-xs text-warning bg-warning-soft border border-warning/30 px-1.5 py-0.5 rounded-full">🔒 Private</span>}
                      </div>
                      <p className="text-fg-dim text-xs">by {pod.mentorHandle}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-success font-bold">${pod.price}/mo</p>
                        <p className="text-fg-dim text-xs">{pod.members}/{pod.maxMembers} members</p>
                      </div>
                      <ReportButton
                        reportedItemType="mentor"
                        reportedItemId={pod.id}
                        reportedItemTitle={`Pod: ${pod.name} by ${pod.mentorHandle}`}
                        reportedUserId={pod.mentorHandle}
                        sourceFeature="Mentoring Pods"
                        compact
                      />
                    </div>
                  </div>

                  <p className="text-fg-muted text-xs leading-relaxed mb-3">{pod.description}</p>

                  <div className="mb-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-fg-dim text-xs">Capacity</span>
                      <span className="text-fg-dim text-xs">{Math.round((pod.members / pod.maxMembers) * 100)}%</span>
                    </div>
                    <div className="w-full bg-elevated rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${pod.members / pod.maxMembers > 0.8 ? "bg-danger" : "bg-success"}`}
                        style={{ width: `${(pod.members / pod.maxMembers) * 100}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-4">
                    {pod.tags.map(tag => (
                      <span key={tag} className="text-xs bg-elevated text-fg-dim px-1.5 py-0.5 rounded-full border border-border">{tag}</span>
                    ))}
                  </div>

                  <button
                    onClick={() => pod.joined ? leavePod(pod.id) : joinPod(pod.id)}
                    className={`w-full py-2 rounded-lg text-xs font-semibold border transition ${pod.joined ? "bg-danger-soft text-danger border-danger/30 hover:bg-danger/22" : "bg-success-soft text-success border-success/30 hover:bg-success/22"}`}>
                    {pod.joined ? "Leave Pod" : `Join Pod — $${pod.price}/mo`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Booking Modal */}
      {showBooking && selectedMentor && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-fg font-bold text-lg">Book Session</h2>
                <p className="text-fg-dim text-xs mt-0.5">with {selectedMentor.handle} · ${selectedMentor.hourlyRate}/hr</p>
              </div>
              <button onClick={() => { setShowBooking(false); setSelectedMentor(null); }}
                className="text-fg-dim hover:text-fg text-xl">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-fg-dim text-xs mb-1">Session Topic</p>
                <input value={bookingForm.topic}
                  onChange={e => setBookingForm({ ...bookingForm, topic: e.target.value })}
                  placeholder="e.g. Trade review, SMC concepts, Risk management"
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm" />
              </div>
              <div>
                <p className="text-fg-dim text-xs mb-1">Date & Time</p>
                <input type="datetime-local" value={bookingForm.date}
                  onChange={e => setBookingForm({ ...bookingForm, date: e.target.value })}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm" />
              </div>
              <div>
                <p className="text-fg-dim text-xs mb-1">Duration</p>
                <div className="flex gap-2">
                  {[30, 60, 90].map(d => (
                    <button key={d} onClick={() => setBookingForm({ ...bookingForm, duration: d, price: Math.round(selectedMentor.hourlyRate * d / 60) })}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition ${bookingForm.duration === d ? "bg-success-soft text-success border-success/30" : "bg-elevated text-fg-dim border-border"}`}>
                      {d} min — ${Math.round(selectedMentor.hourlyRate * d / 60)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="glass border border-border rounded-lg p-3">
                <div className="flex justify-between text-xs">
                  <span className="text-fg-dim">Total</span>
                  <span className="text-fg font-bold">${bookingForm.price} (Paper/Demo)</span>
                </div>
              </div>
              <button onClick={handleBook}
                disabled={!bookingForm.topic || !bookingForm.date}
                className="w-full bg-success-soft text-success border border-success/30 py-3 rounded-xl text-sm font-semibold hover:bg-success/22 transition disabled:opacity-40">
                ✓ Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Request Modal */}
      {showReviewRequest && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass border border-border rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-fg font-bold text-lg">Request Trade Review</h2>
              <button onClick={() => setShowReviewRequest(false)} className="text-fg-dim hover:text-fg text-xl">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-fg-dim text-xs mb-1">Select Mentor</p>
                <select value={reviewForm.mentorHandle}
                  onChange={e => setReviewForm({ ...reviewForm, mentorHandle: e.target.value })}
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm">
                  <option value="">Choose a mentor...</option>
                  {mentors.map(m => (
                    <option key={m.id} value={m.handle} className="bg-[#0a0a0f]">{m.handle} — {m.specialty.slice(0, 2).join(", ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-fg-dim text-xs mb-1">Select Trade to Review</p>
                {entries.length === 0 ? (
                  <p className="text-fg-dim text-xs">No trades in journal yet. Place and close a trade first.</p>
                ) : (
                  <select value={reviewForm.tradeId}
                    onChange={e => setReviewForm({ ...reviewForm, tradeId: e.target.value })}
                    className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm">
                    <option value="">Choose a trade...</option>
                    {entries.map(e => (
                      <option key={e.id} value={e.id} className="bg-[#0a0a0f]">
                        {e.side} {e.symbol} @ ${e.entryPrice.toFixed(2)} — {e.emotion}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button onClick={handleReviewRequest}
                disabled={!reviewForm.mentorHandle || !reviewForm.tradeId}
                className="w-full bg-accent-soft text-accent-hover border border-accent/30 py-3 rounded-xl text-sm font-semibold hover:bg-accent/22 transition disabled:opacity-40">
                📝 Submit for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}