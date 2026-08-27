/**
 * Community Comment Routes
 * Mounted at: /community/comments
 *
 * Covers: replies, edit, delete, hide (admin), toggle comment like.
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../../middleware/authenticate";
import { requirePermission }           from "../../middleware/requirePermission";
import { validate }                    from "../../middleware/validate";
import { communityCommentService }     from "../../server/services/communityCommentService";
import { communityInteractionService } from "../../server/services/communityInteractionService";
import { communityCommentRepository }  from "../../server/repositories/communityCommentRepository";
import { ok, created, notFound, forbidden, internalError } from "../../lib/response";

const router: ReturnType<typeof Router> = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const ReplySchema = z.object({
  content: z.string().min(1, "Reply cannot be empty").max(2000),
});

const EditSchema = z.object({
  content: z.string().min(1, "Content cannot be empty").max(2000),
});

const HideSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

// ── GET /comments/:commentId/replies ─ List replies ───────────────────────

router.get(
  "/:commentId/replies",
  optionalAuthenticate,
  validate(PaginationSchema, "query"),
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const query    = req.query as unknown as z.infer<typeof PaginationSchema>;
    const viewerId = authReq.userId ?? undefined;

    try {
      const result = await communityCommentService.getReplies(
        req.params.commentId,
        query.page,
        query.pageSize,
        viewerId
      );
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "COMMENT_NOT_FOUND") {
        notFound(res, "Comment not found");
        return;
      }
      console.error("[community/comments GET /:commentId/replies]", err);
      internalError(res);
    }
  }
);

// ── POST /comments/:commentId/replies ─ Add reply ─────────────────────────

router.post(
  "/:commentId/replies",
  authenticate,
  validate(ReplySchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof ReplySchema>;

    try {
      // First, look up the parent comment to get the postId
      const parent = await communityCommentRepository.findById(req.params.commentId);

      if (!parent) {
        notFound(res, "Comment not found");
        return;
      }

      const reply = await communityCommentService.addComment(
        parent.postId,
        authReq.userId,
        body.content,
        req.params.commentId
      );
      created(res, reply, "Reply added");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "POST_NOT_FOUND")    { notFound(res, "Post not found");    return; }
        if (err.message === "COMMENT_NOT_FOUND") { notFound(res, "Comment not found"); return; }
      }
      console.error("[community/comments POST /:commentId/replies]", err);
      internalError(res);
    }
  }
);

// ── PUT /comments/:commentId ─ Edit comment ───────────────────────────────

router.put(
  "/:commentId",
  authenticate,
  validate(EditSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof EditSchema>;

    try {
      const comment = await communityCommentService.editComment(
        req.params.commentId,
        authReq.userId,
        body.content
      );
      ok(res, comment, "Comment updated");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "COMMENT_NOT_FOUND") { notFound(res,   "Comment not found");              return; }
        if (err.message === "NOT_COMMENT_AUTHOR") { forbidden(res, "You can only edit your own comments"); return; }
      }
      console.error("[community/comments PUT /:commentId]", err);
      internalError(res);
    }
  }
);

// ── DELETE /comments/:commentId ─ Delete comment ──────────────────────────

router.delete(
  "/:commentId",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const isAdmin = authReq.permissions.includes("community.comment.delete");

    try {
      await communityCommentService.deleteComment(
        req.params.commentId,
        authReq.userId,
        isAdmin,
        { actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" }
      );
      ok(res, null, "Comment deleted");
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "COMMENT_NOT_FOUND")  { notFound(res,   "Comment not found");                return; }
        if (err.message === "NOT_COMMENT_AUTHOR") { forbidden(res, "You can only delete your own comments"); return; }
      }
      console.error("[community/comments DELETE /:commentId]", err);
      internalError(res);
    }
  }
);

// ── POST /comments/:commentId/hide ─ Admin: hide comment ──────────────────

router.post(
  "/:commentId/hide",
  authenticate,
  requirePermission("community.comment.delete"),
  validate(HideSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof HideSchema>;

    try {
      await communityCommentService.hideComment(
        req.params.commentId,
        { actorId: authReq.userId, actorHandle: authReq.handle, actorRole: authReq.roles[0] ?? "ADMIN" },
        body.reason
      );
      ok(res, null, "Comment hidden");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "COMMENT_NOT_FOUND") {
        notFound(res, "Comment not found");
        return;
      }
      console.error("[community/comments POST /:commentId/hide]", err);
      internalError(res);
    }
  }
);

// ── POST /comments/:commentId/like ─ Toggle comment like ─────────────────

router.post(
  "/:commentId/like",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      const result = await communityInteractionService.toggleCommentLike(
        req.params.commentId,
        authReq.userId
      );
      ok(res, result);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "COMMENT_NOT_FOUND") {
        notFound(res, "Comment not found");
        return;
      }
      console.error("[community/comments POST /:commentId/like]", err);
      internalError(res);
    }
  }
);

export default router;