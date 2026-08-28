/**
 * Notification Routes
 * Mounted at: /notifications
 */
import { Router } from "express";
import { z } from "zod";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { validate } from "../middleware/validate";
import { ok, internalError } from "../lib/response";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from "../server/notifications/notificationService";

const router: ReturnType<typeof Router> = Router();
router.use(authenticate);

const PaginationSchema = z.object({
  page:       z.coerce.number().int().positive().default(1),
  pageSize:   z.coerce.number().int().positive().max(50).default(20),
  unreadOnly: z.coerce.boolean().default(false),
});

// ── GET /notifications ─ List (paginated) ───────────────────────────────────

router.get(
  "/",
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const query   = req.query as unknown as z.infer<typeof PaginationSchema>;

    try {
      ok(res, await listNotifications(authReq.userId, {
        page:       query.page,
        pageSize:   query.pageSize,
        unreadOnly: query.unreadOnly,
      }));
    } catch (err) {
      console.error("[notifications GET /]", err);
      internalError(res);
    }
  }
);

// ── GET /notifications/unread-count ─ Unread count ──────────────────────────

router.get(
  "/unread-count",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, { count: await getUnreadCount(authReq.userId) });
    } catch (err) {
      console.error("[notifications GET /unread-count]", err);
      internalError(res);
    }
  }
);

// ── POST /notifications/read-all ─ Mark all as read ─────────────────────────

router.post(
  "/read-all",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      await markAllAsRead(authReq.userId);
      ok(res, null, "All marked as read");
    } catch (err) {
      console.error("[notifications POST /read-all]", err);
      internalError(res);
    }
  }
);

// ── POST /notifications/:id/read ─ Mark one as read ──────────────────────────

router.post(
  "/:id/read",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      await markAsRead(req.params.id, authReq.userId);
      ok(res, null, "Marked as read");
    } catch (err) {
      console.error("[notifications POST /:id/read]", err);
      internalError(res);
    }
  }
);

// ── DELETE /notifications/:id ─ Delete ───────────────────────────────────────

router.delete(
  "/:id",
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      await deleteNotification(req.params.id, authReq.userId);
      ok(res, null, "Deleted");
    } catch (err) {
      console.error("[notifications DELETE /:id]", err);
      internalError(res);
    }
  }
);

export default router;
