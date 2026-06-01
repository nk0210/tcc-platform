"use client";
import { useState } from "react";
import { useReportStore, ReportedItemType, REPORT_REASONS } from "@/store/reportStore";
import { useAuthStore } from "@/store/authStore";

interface ReportButtonProps {
  reportedItemType: ReportedItemType;
  reportedItemId: string;
  reportedItemTitle?: string;
  reportedUserId?: string;
  sourceFeature: string;
  compact?: boolean;
}

export default function ReportButton({
  reportedItemType,
  reportedItemId,
  reportedItemTitle,
  reportedUserId,
  sourceFeature,
  compact = false,
}: ReportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { submitReport } = useReportStore();
  const { user } = useAuthStore();

  const reasons = REPORT_REASONS[reportedItemType] || REPORT_REASONS.other;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    submitReport({
      reportedItemType,
      reportedItemId,
      reportedItemTitle,
      reportedUserId,
      reporterUserId: user?.id || "guest",
      reporterHandle: user?.handle || "guest",
      reason: selectedReason,
      description: description.trim() || undefined,
      sourceFeature,
    });
    setSubmitted(true);
    setSubmitting(false);
    setTimeout(() => {
      setShowModal(false);
      setSubmitted(false);
      setSelectedReason("");
      setDescription("");
    }, 2000);
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
        className={`text-white/20 hover:text-red-400 transition ${compact ? "text-xs" : "text-xs px-2 py-1 rounded border border-white/10 hover:border-red-500/20 bg-white/2 hover:bg-red-500/5"}`}
        title="Report this content">
        {compact ? "🚩" : "🚩 Report"}
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-[#0e0e1a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-bold">Report {reportedItemType.replace("_", " ")}</h2>
                {reportedItemTitle && <p className="text-white/30 text-xs mt-0.5 truncate max-w-xs">{reportedItemTitle}</p>}
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>

            {submitted ? (
              <div className="text-center py-4">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-green-400 font-semibold">Report submitted</p>
                <p className="text-white/40 text-xs mt-1">Our moderation team will review this</p>
              </div>
            ) : (
              <>
                <p className="text-white/40 text-xs mb-3">Why are you reporting this?</p>
                <div className="flex flex-col gap-2 mb-4">
                  {reasons.map(reason => (
                    <button key={reason}
                      onClick={() => setSelectedReason(reason)}
                      className={`text-left px-3 py-2 rounded-lg text-sm border transition ${selectedReason === reason ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-white/2 text-white/60 border-white/5 hover:border-white/20"}`}>
                      {reason}
                    </button>
                  ))}
                </div>

                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Additional details (optional)..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none h-20 mb-4"
                />

                <div className="flex gap-3">
                  <button onClick={() => setShowModal(false)}
                    className="flex-1 bg-white/5 text-white/40 py-2 rounded-lg text-sm border border-white/10">
                    Cancel
                  </button>
                  <button onClick={handleSubmit}
                    disabled={!selectedReason || submitting}
                    className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
                    {submitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}