/**
 * Admin Copy Trading API
 * Thin wrapper around the /copy-trading/admin/* routes. Used only by
 * owner/copy-trading/page.tsx — admin moderation is not part of the
 * follower-facing copyTradingStore.
 */
import { api } from "@/lib/api/client";

export const adminCopyTradingApi = {
  getApplications: (page = 1, status?: string) =>
    api.get(`/copy-trading/admin/applications?page=${page}${status ? `&status=${status}` : ""}`),

  reviewApplication: (id: string) =>
    api.post(`/copy-trading/admin/applications/${id}/review`),

  approveApplication: (id: string) =>
    api.post(`/copy-trading/admin/applications/${id}/approve`),

  rejectApplication: (id: string, reason: string) =>
    api.post(`/copy-trading/admin/applications/${id}/reject`, { reason }),

  requestMoreInfo: (id: string, message: string) =>
    api.post(`/copy-trading/admin/applications/${id}/more-info`, { message }),

  suspendMaster: (masterId: string, reason: string) =>
    api.post(`/copy-trading/admin/masters/${masterId}/suspend`, { reason }),

  removeMaster: (masterId: string, reason: string) =>
    api.post(`/copy-trading/admin/masters/${masterId}/remove`, { reason }),
};
