"use client";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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

function ReportModal({
  reportedItemType,
  reportedItemId,
  reportedItemTitle,
  reportedUserId,
  sourceFeature,
  onClose,
}: ReportButtonProps & { onClose: () => void }) {
  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { submitReport } = useReportStore();
  const { user } = useAuthStore();

  const reasons = REPORT_REASONS[reportedItemType] || REPORT_REASONS.other;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
    setTimeout(() => { onClose(); }, 1800);
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const typeLabel = reportedItemType.replace(/_/g, " ");

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog">
      <div
        className="relative w-full max-w-md bg-[#111217] border border-white/10 rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-base capitalize">Report {typeLabel}</h2>
            {reportedItemTitle && (
              <p className="text-white/30 text-xs mt-0.5 truncate max-w-[300px]" title={reportedItemTitle}>
                "{reportedItemTitle}"
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition text-sm shrink-0 ml-3">
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-2xl">✅</div>
            <p className="text-green-400 font-semibold">Report submitted</p>
            <p className="text-white/40 text-xs text-center">
              Our moderation team will review this. Thank you for helping keep TCC safe.
            </p>
          </div>
        ) : (
          <>
            {/* Reason selection */}
            <p className="text-white/50 text-xs mb-3 font-medium uppercase tracking-wider">Select a reason</p>
            <div className="flex flex-col gap-2 mb-5 max-h-[220px] overflow-y-auto pr-1">
              {reasons.map(reason => (
                <button
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  className={`text-left px-4 py-2.5 rounded-xl text-sm border transition ${
                    selectedReason === reason
                      ? "bg-red-500/15 text-red-400 border-red-500/40 font-medium"
                      : "bg-white/3 text-white/60 border-white/8 hover:bg-white/7 hover:border-white/15 hover:text-white/80"
                  }`}>
                  {reason}
                </button>
              ))}
            </div>

            {/* Optional description */}
            <p className="text-white/50 text-xs mb-2 font-medium uppercase tracking-wider">Additional details <span className="text-white/20 normal-case">(optional)</span></p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide any additional context that would help our team review this..."
              maxLength={500}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-white/25 placeholder-white/20 mb-5"
            />

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 py-2.5 rounded-xl text-sm font-medium transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selectedReason || submitting}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed">
                {submitting ? "Submitting..." : "🚩 Submit Report"}
              </button>
            </div>

            <p className="text-white/20 text-xs text-center mt-3">
              False reports may result in account warnings.
            </p>
          </>
        )}
      </div>
    </div>
  );
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowModal(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <>
      <button
        onClick={handleOpen}
        title={`Report this ${reportedItemType.replace(/_/g, " ")}`}
        className={`transition shrink-0 ${
          compact
            ? "text-white/20 hover:text-red-400 text-base leading-none"
            : "flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-white/8 bg-white/2 text-white/30 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5"
        }`}>
        {compact ? "🚩" : "🚩 Report"}
      </button>

      {/* Portal — renders outside component tree at document.body level */}
      {mounted && showModal && createPortal(
        <ReportModal
          reportedItemType={reportedItemType}
          reportedItemId={reportedItemId}
          reportedItemTitle={reportedItemTitle}
          reportedUserId={reportedUserId}
          sourceFeature={sourceFeature}
          onClose={handleClose}
        />,
        document.body
      )}
    </>
  );
}