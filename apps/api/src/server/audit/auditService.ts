/**
 * TCC Audit Service — universal audit logging engine.
 *
 * Every admin/owner action that mutates platform state MUST call
 * createAuditLog(). This is the single entry point — do not write
 * directly to the AdminActionLog table from routes or other services.
 *
 * Examples this powers (per Phase Alpha spec):
 *   - Ban User
 *   - Suspend User
 *   - Approve Master Trader
 *   - Reject Master Trader
 *   - Delete Post
 *   - Delete Comment
 *   - Send Admin Notification
 *   - Remove Strategy
 */
import { auditRepository, type AuditLogInput } from "../repositories/auditRepository";

export async function createAuditLog(input: AuditLogInput) {
  return auditRepository.create(input);
}

export async function getAuditLogs(params: {
  page: number;
  pageSize: number;
  actionType?: string;
  targetUserId?: string;
}) {
  return auditRepository.list(params);
}