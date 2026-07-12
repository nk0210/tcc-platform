/**
 * TCC Owner Platform — backend foundation routes.
 *
 * Every route here is gated by authenticate + requirePermission.
 * Per Phase Alpha spec, this is BACKEND architecture only — full
 * admin UI screens are a later Alpha day.
 */
import { Router } from "express";
import { z }      from "zod";
import db          from "../lib/prisma";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { requirePermission }              from "../middleware/requirePermission";
import { validate }                       from "../middleware/validate";
import { userRepository }                 from "../server/repositories/userRepository";
import * as userService                   from "../server/services/userService";
import { getAuditLogs }                   from "../server/audit/auditService";
import { createBroadcastNotification }    from "../server/notifications/notificationService";
import { ok, notFound, internalError, badRequest } from "../lib/response";

const router = Router();
router.use(authenticate, requirePermission("admin.dashboard.access"));

function actorFrom(req: AuthRequest) {
  return { actorId: req.userId, actorHandle: req.handle, actorRole: req.roles[0] ?? "ADMIN" };
}

// ── GET /owner/users ────────────────────────────────────────────────────────

router.get("/users", async (req, res) => {
  const page     = Math.max(1, parseInt((req.query["page"] as string) ?? "1"));
  const pageSize = Math.min(100, parseInt((req.query["pageSize"] as string) ?? "25"));
  const search   = (req.query["search"] as string) || undefined;

  try {
    const { items, total } = await userRepository.list({ page, pageSize, search });
    ok(res, {
      items, total, page, pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1,
    });
  } catch (err) {
    console.error("[owner/users]", err);
    internalError(res);
  }
});

// ── POST /owner/users/:id/suspend ──────────────────────────────────────────

const ReasonSchema = z.object({ reason: z.string().min(3, "Reason is required") });

router.post("/users/:id/suspend", requirePermission("user.suspend"), validate(ReasonSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const updated = await userService.suspendUser(actorFrom(authReq), req.params.id, req.body.reason);
    ok(res, updated, "User suspended");
  } catch (err: any) {
    if (err.statusCode === 404) { notFound(res, err.message); return; }
    console.error("[owner/suspend]", err);
    internalError(res);
  }
});

// ── POST /owner/users/:id/ban ───────────────────────────────────────────────

router.post("/users/:id/ban", requirePermission("user.ban"), validate(ReasonSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const updated = await userService.banUser(actorFrom(authReq), req.params.id, req.body.reason);
    ok(res, updated, "User banned");
  } catch (err: any) {
    if (err.statusCode === 404) { notFound(res, err.message); return; }
    console.error("[owner/ban]", err);
    internalError(res);
  }
});

// ── POST /owner/users/:id/reinstate ────────────────────────────────────────

router.post("/users/:id/reinstate", requirePermission("user.reinstate"), async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const updated = await userService.reinstateUser(actorFrom(authReq), req.params.id);
    ok(res, updated, "User reinstated");
  } catch (err: any) {
    if (err.statusCode === 404) { notFound(res, err.message); return; }
    console.error("[owner/reinstate]", err);
    internalError(res);
  }
});

// ── POST /owner/users/:id/verify ───────────────────────────────────────────

router.post("/users/:id/verify", requirePermission("user.verify"), async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const updated = await userService.verifyUser(actorFrom(authReq), req.params.id);
    ok(res, updated, "User verified");
  } catch (err: any) {
    if (err.statusCode === 404) { notFound(res, err.message); return; }
    console.error("[owner/verify]", err);
    internalError(res);
  }
});

// ── PUT /owner/users/:id/roles ──────────────────────────────────────────────

const RolesSchema = z.object({
  roles: z.array(z.enum([
    "NORMAL_USER", "FOLLOWER_TRADER", "VERIFIED_TRADER",
    "MASTER_TRADER", "MENTOR", "ADMIN", "OWNER",
  ])).min(1, "At least one role is required"),
});

router.put("/users/:id/roles", requirePermission("user.changeRole"), validate(RolesSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const updated = await userService.changeUserRoles(actorFrom(authReq), req.params.id, req.body.roles);
    ok(res, updated, "Roles updated");
  } catch (err: any) {
    if (err.statusCode === 404) { notFound(res, err.message); return; }
    console.error("[owner/roles]", err);
    internalError(res);
  }
});

// ── GET /owner/audit-logs ───────────────────────────────────────────────────

router.get("/audit-logs", requirePermission("user.viewAuditLog"), async (req, res) => {
  const page     = Math.max(1, parseInt((req.query["page"] as string) ?? "1"));
  const pageSize = Math.min(100, parseInt((req.query["pageSize"] as string) ?? "50"));
  const actionType   = (req.query["actionType"]   as string) || undefined;
  const targetUserId = (req.query["targetUserId"] as string) || undefined;

  try {
    const { items, total } = await getAuditLogs({ page, pageSize, actionType, targetUserId });
    ok(res, { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error("[owner/audit-logs]", err);
    internalError(res);
  }
});

// ── POST /owner/notifications/broadcast ────────────────────────────────────

const BroadcastSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one target user is required"),
  title:   z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
});

router.post("/notifications/broadcast", requirePermission("admin.notification.broadcast"), validate(BroadcastSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const { userIds, title, message, priority } = req.body as z.infer<typeof BroadcastSchema>;

  try {
    await createBroadcastNotification(userIds, { type: "ADMIN", priority, title, message });

    const { createAuditLog } = await import("../server/audit/auditService");
    await createAuditLog({
      ...actorFrom(authReq),
      actionType:  "admin_notification_broadcast",
      targetType:  "notification_broadcast",
      targetId:    userIds.join(","),
      description: `Broadcast notification to ${userIds.length} user(s): "${title}"`,
      metadata:    { userIds, title, message, priority },
    });

    ok(res, { sentTo: userIds.length }, "Notification sent");
  } catch (err) {
    console.error("[owner/broadcast]", err);
    internalError(res);
  }
});

// ── GET /owner/settings/:key — read a system setting ───────────────────────

router.get("/settings/:key", requirePermission("admin.settings.view"), async (req, res) => {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: req.params.key } });
    if (!setting) { notFound(res, "Setting not found"); return; }
    ok(res, setting);
  } catch (err) {
    console.error("[owner/settings/get]", err);
    internalError(res);
  }
});

// ── PUT /owner/settings/:key — update a system setting ─────────────────────

const SettingValueSchema = z.object({ value: z.any() });

router.put("/settings/:key", requirePermission("admin.settings.edit"), validate(SettingValueSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const setting = await db.systemSetting.update({
      where: { key: req.params.key },
      data:  { value: req.body.value, updatedBy: authReq.userId },
    });

    const { createAuditLog } = await import("../server/audit/auditService");
    await createAuditLog({
      ...actorFrom(authReq),
      actionType:  "system_setting_updated",
      targetType:  "system_setting",
      targetId:    req.params.key,
      description: `Updated system setting "${req.params.key}"`,
      metadata:    { newValue: req.body.value },
    });

    ok(res, setting, "Setting updated");
  } catch (err) {
    console.error("[owner/settings/put]", err);
    badRequest(res, "Setting key not found or update failed");
  }
});

export default router;