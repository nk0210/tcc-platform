import { Router } from "express";
import { z }      from "zod";
import db          from "../lib/prisma";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { requirePermission }              from "../middleware/requirePermission";
import { validate }                       from "../middleware/validate";
import { userRepository }                 from "../server/repositories/userRepository";
import { createAuditLog }                 from "../server/audit/auditService";
import { createBroadcastNotification }    from "../server/notifications/notificationService";
import * as userService                   from "../server/services/userService";
import { getAuditLogs }                   from "../server/audit/auditService";
import { ok, notFound, badRequest, internalError } from "../lib/response";

const router = Router();
router.use(authenticate, requirePermission("admin.dashboard.access"));

const actor = (r: AuthRequest) => ({ actorId: r.userId, actorHandle: r.handle, actorRole: r.roles[0] ?? "ADMIN" });

// GET /owner/users
router.get("/users", async (req, res) => {
  const page = Math.max(1, parseInt((req.query["page"] as string) ?? "1"));
  const pageSize = Math.min(100, parseInt((req.query["pageSize"] as string) ?? "25"));
  const search = (req.query["search"] as string) || undefined;
  try {
    const { items, total } = await userRepository.list({ page, pageSize, search });
    ok(res, { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasNext: page * pageSize < total, hasPrev: page > 1 });
  } catch (e) { internalError(res); }
});

const ReasonSchema = z.object({ reason: z.string().min(3) });
const RolesSchema  = z.object({ roles: z.array(z.enum(["NORMAL_USER","FOLLOWER_TRADER","VERIFIED_TRADER","MASTER_TRADER","MENTOR","ADMIN","OWNER"])).min(1) });

router.post("/users/:id/suspend",   requirePermission("user.suspend"),    validate(ReasonSchema), async (req, res) => { const a = req as AuthRequest; try { ok(res, await userService.suspendUser(actor(a), req.params.id, req.body.reason), "Suspended"); } catch (e: any) { if (e.statusCode === 404) { notFound(res); return; } internalError(res); } });
router.post("/users/:id/ban",       requirePermission("user.ban"),         validate(ReasonSchema), async (req, res) => { const a = req as AuthRequest; try { ok(res, await userService.banUser(actor(a), req.params.id, req.body.reason), "Banned"); } catch (e: any) { if (e.statusCode === 404) { notFound(res); return; } internalError(res); } });
router.post("/users/:id/reinstate", requirePermission("user.reinstate"),                          async (req, res) => { const a = req as AuthRequest; try { ok(res, await userService.reinstateUser(actor(a), req.params.id), "Reinstated"); } catch (e: any) { if (e.statusCode === 404) { notFound(res); return; } internalError(res); } });
router.post("/users/:id/verify",    requirePermission("user.verify"),                             async (req, res) => { const a = req as AuthRequest; try { ok(res, await userService.verifyUser(actor(a), req.params.id), "Verified"); } catch (e: any) { if (e.statusCode === 404) { notFound(res); return; } internalError(res); } });
router.put( "/users/:id/roles",     requirePermission("user.changeRole"), validate(RolesSchema),  async (req, res) => { const a = req as AuthRequest; try { ok(res, await userService.changeUserRoles(actor(a), req.params.id, req.body.roles), "Roles updated"); } catch (e: any) { if (e.statusCode === 404) { notFound(res); return; } internalError(res); } });

// GET /owner/audit-logs
router.get("/audit-logs", requirePermission("user.viewAuditLog"), async (req, res) => {
  const page = Math.max(1, parseInt((req.query["page"] as string) ?? "1"));
  const pageSize = Math.min(100, parseInt((req.query["pageSize"] as string) ?? "50"));
  const actionType   = (req.query["actionType"]   as string) || undefined;
  const targetUserId = (req.query["targetUserId"] as string) || undefined;
  try { const { items, total } = await getAuditLogs({ page, pageSize, actionType, targetUserId }); ok(res, { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }); }
  catch (e) { internalError(res); }
});

// POST /owner/notifications/broadcast
const BroadcastSchema = z.object({ userIds: z.array(z.string()).min(1), title: z.string().min(1).max(100), message: z.string().min(1).max(500), priority: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]).default("MEDIUM") });
router.post("/notifications/broadcast", requirePermission("admin.notification.broadcast"), validate(BroadcastSchema), async (req, res) => {
  const a = req as AuthRequest; const { userIds, title, message, priority } = req.body as z.infer<typeof BroadcastSchema>;
  try {
    await createBroadcastNotification(userIds, { type: "ADMIN", priority, title, message });
    await createAuditLog({ ...actor(a), actionType: "admin_notification_broadcast", targetType: "broadcast", targetId: userIds.join(","), description: `Broadcast to ${userIds.length} users: "${title}"`, metadata: { userIds, title, message } as any });
    ok(res, { sentTo: userIds.length }, "Sent");
  } catch (e) { internalError(res); }
});

// GET/PUT /owner/settings/:key
router.get("/settings/:key",  requirePermission("admin.settings.view"), async (req, res) => {
  try { const s = await db.systemSetting.findUnique({ where: { key: req.params.key } }); if (!s) { notFound(res); return; } ok(res, s); }
  catch (e) { internalError(res); }
});
const SettingSchema = z.object({ value: z.unknown() });
router.put("/settings/:key",  requirePermission("admin.settings.edit"), validate(SettingSchema), async (req, res) => {
  const a = req as AuthRequest;
  try {
    const s = await db.systemSetting.update({ where: { key: req.params.key }, data: { value: req.body.value as any, updatedBy: a.userId } });
    await createAuditLog({ ...actor(a), actionType: "system_setting_updated", targetType: "system_setting", targetId: req.params.key, description: `Updated setting "${req.params.key}"`, metadata: { newValue: req.body.value } as any });
    ok(res, s, "Updated");
  } catch (e) { badRequest(res, "Setting not found"); }
});

export default router;