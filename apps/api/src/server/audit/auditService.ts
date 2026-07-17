import { auditRepository, type AuditLogInput } from "../repositories/auditRepository";

export async function createAuditLog(input: AuditLogInput): Promise<void> {
  await auditRepository.create(input);
}

export async function getAuditLogs(params: {
  page:          number;
  pageSize:      number;
  actionType?:   string;
  targetUserId?: string;
}) {
  return auditRepository.list(params);
}