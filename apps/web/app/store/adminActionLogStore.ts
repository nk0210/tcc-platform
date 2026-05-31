import { create } from "zustand";

export type AdminActionType =
  | "report_reviewed" | "report_resolved" | "content_hidden"
  | "content_deleted" | "user_warned" | "user_suspended"
  | "user_reinstated" | "false_report_rejected" | "strategy_removed"
  | "competition_dispute_resolved" | "copy_trading_approved"
  | "copy_trading_rejected" | "verified_badge_granted"
  | "verified_badge_revoked" | "system_note";

export interface AdminActionLog {
  id: string;
  actorUserId: string;
  actorHandle: string;
  actorRole: string;
  actionType: AdminActionType;
  targetType: string;
  targetId: string;
  description: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

interface AdminActionLogStore {
  logs: AdminActionLog[];
  addLog: (log: Omit<AdminActionLog, "id" | "createdAt">) => void;
  clearLogs: () => void;
}

export const useAdminActionLogStore = create<AdminActionLogStore>((set) => ({
  logs: [],

  addLog: (log) => {
    const newLog: AdminActionLog = { ...log, id: `LOG-${Date.now()}`, createdAt: Date.now() };
    set((state) => ({ logs: [newLog, ...state.logs] }));
  },

  clearLogs: () => set({ logs: [] }),
}));