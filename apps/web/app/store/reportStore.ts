import { create } from "zustand";

export type ReportedItemType =
  | "user" | "post" | "comment" | "strategy" | "course"
  | "mentor" | "master_trader" | "competition" | "copy_trade"
  | "message" | "other";

export type ReportPriority = "low" | "medium" | "high" | "critical";

export type ReportStatus =
  | "pending" | "under_review" | "resolved_no_action"
  | "content_hidden" | "content_deleted" | "user_warned"
  | "user_suspended" | "rejected_false_report";

export interface Report {
  id: string;
  reportedItemType: ReportedItemType;
  reportedItemId: string;
  reportedItemTitle?: string;
  reportedUserId?: string;
  reporterUserId: string;
  reporterHandle: string;
  reason: string;
  description?: string;
  priority: ReportPriority;
  status: ReportStatus;
  sourceFeature: string;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  adminNote?: string;
  actionTaken?: string;
}

export const REPORT_REASONS: Record<ReportedItemType, string[]> = {
  user: ["Spam", "Impersonation", "Abusive behavior", "Scam", "Fake performance", "Other"],
  post: ["Spam", "Scam", "Abuse/harassment", "Impersonation", "Fake profit screenshot", "Inappropriate content", "Other"],
  comment: ["Spam", "Abuse/harassment", "Scam", "Inappropriate content", "Other"],
  strategy: ["Fake performance", "Misleading backtest", "Dangerous risk rules", "Scam/promotion", "Copied/stolen strategy", "Wrong category", "Other"],
  course: ["Misleading content", "Copied content", "Scam pricing", "Low-quality content", "Other"],
  mentor: ["Fake mentor claim", "Misleading advice", "Scam behavior", "Unprofessional conduct", "Other"],
  master_trader: ["Fake performance", "Too risky", "No stop loss", "Misleading trust score", "Scam behavior", "Broker mismatch", "Other"],
  competition: ["Cheating", "Multiple accounts", "Leaderboard manipulation", "Rule violation", "Abusive behavior", "Other"],
  copy_trade: ["Unauthorized trade", "Excessive risk", "Missing stop loss", "Broker mismatch", "Other"],
  message: ["Spam", "Harassment", "Scam", "Inappropriate content", "Other"],
  other: ["Spam", "Scam", "Policy violation", "Other"],
};

function getPriority(type: ReportedItemType, reason: string): ReportPriority {
  if (type === "master_trader" && reason.includes("Fake")) return "high";
  if (type === "competition" && reason.includes("Cheating")) return "high";
  if (reason.toLowerCase().includes("scam")) return "high";
  if (type === "strategy" && reason.includes("Dangerous")) return "high";
  if (type === "post" && reason.includes("Fake profit")) return "medium";
  return "medium";
}

interface ReportStore {
  reports: Report[];
  submitReport: (params: {
    reportedItemType: ReportedItemType;
    reportedItemId: string;
    reportedItemTitle?: string;
    reportedUserId?: string;
    reporterUserId: string;
    reporterHandle: string;
    reason: string;
    description?: string;
    sourceFeature: string;
  }) => string;
  updateReportStatus: (
    id: string,
    status: ReportStatus,
    adminNote?: string,
    actionTaken?: string,
    resolvedBy?: string
  ) => void;
  getReportById: (id: string) => Report | undefined;
}

export const useReportStore = create<ReportStore>((set, get) => ({
  reports: [],

  submitReport: (params) => {
    const id = `RPT-${Date.now()}`;
    const priority = getPriority(params.reportedItemType, params.reason);
    const newReport: Report = {
      ...params,
      id,
      priority,
      status: "pending",
      createdAt: Date.now(),
    };
    set((state) => ({ reports: [newReport, ...state.reports] }));

    // Notify admin
    try {
      import("@/store/notificationStore").then(({ useNotificationStore }) => {
        useNotificationStore.getState().addNotification({
          type: "report_update",
          priority: priority === "critical" || priority === "high" ? "high" : "medium",
          title: `🚨 New Report Submitted`,
          message: `${params.reportedItemType.replace("_", " ")} reported: "${params.reason}" by ${params.reporterHandle}`,
          actionLabel: "Review in Owner Panel",
          actionPath: "/owner/reports",
        });
      });
    } catch {}

    return id;
  },

  updateReportStatus: (id, status, adminNote, actionTaken, resolvedBy) => {
    set((state) => ({
      reports: state.reports.map(r =>
        r.id !== id ? r : {
          ...r,
          status,
          adminNote: adminNote !== undefined ? adminNote : r.adminNote,
          actionTaken: actionTaken !== undefined ? actionTaken : r.actionTaken,
          resolvedBy: resolvedBy !== undefined ? resolvedBy : r.resolvedBy,
          resolvedAt: ["resolved_no_action", "content_hidden", "content_deleted", "user_warned", "user_suspended", "rejected_false_report"].includes(status)
            ? Date.now() : r.resolvedAt,
        }
      ),
    }));
  },

  getReportById: (id) => get().reports.find(r => r.id === id),
}));