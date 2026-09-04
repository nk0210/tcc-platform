/**
 * Block / Mute Routes
 * Mounted at: /community
 *
 * Both act on a handle (consistent with the follow routes) rather than a
 * raw user id, since the frontend always has a handle in hand (profile
 * page, post author, etc.) and never a bare id.
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, type AuthRequest } from "../../middleware/authenticate";
import { validate }              from "../../middleware/validate";
import { userRelationService, CannotActOnSelfError } from "../../server/services/userRelationService";
import { communityFollowRepository } from "../../server/repositories/communityFollowRepository";
import { ok, notFound, badRequest, internalError } from "../../lib/response";

const router: ReturnType<typeof Router> = Router();

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

async function resolveHandle(handle: string) {
  return communityFollowRepository.findUserByHandle(handle);
}

// ── POST /block/:handle ─ Block a user ─────────────────────────────────────

router.post("/block/:handle", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const target = await resolveHandle(req.params.handle);
    if (!target) { notFound(res, "User not found"); return; }
    const result = await userRelationService.blockUser(authReq.userId, target.id);
    ok(res, result, `Blocked @${req.params.handle}`);
  } catch (err: unknown) {
    if (err instanceof CannotActOnSelfError) { badRequest(res, "You cannot block yourself"); return; }
    console.error("[community/relations POST /block/:handle]", err);
    internalError(res);
  }
});

// ── DELETE /block/:handle ─ Unblock a user ─────────────────────────────────

router.delete("/block/:handle", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const target = await resolveHandle(req.params.handle);
    if (!target) { notFound(res, "User not found"); return; }
    const result = await userRelationService.unblockUser(authReq.userId, target.id);
    ok(res, result, `Unblocked @${req.params.handle}`);
  } catch (err) {
    console.error("[community/relations DELETE /block/:handle]", err);
    internalError(res);
  }
});

// ── GET /blocked ─ My blocked users ────────────────────────────────────────

router.get("/blocked", authenticate, validate(PaginationSchema, "query"), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const query   = req.query as unknown as z.infer<typeof PaginationSchema>;
  try {
    const result = await userRelationService.getBlockedUsers(authReq.userId, query.page, query.pageSize);
    ok(res, result);
  } catch (err) {
    console.error("[community/relations GET /blocked]", err);
    internalError(res);
  }
});

// ── POST /mute/:handle ─ Mute a user ───────────────────────────────────────

router.post("/mute/:handle", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const target = await resolveHandle(req.params.handle);
    if (!target) { notFound(res, "User not found"); return; }
    const result = await userRelationService.muteUser(authReq.userId, target.id);
    ok(res, result, `Muted @${req.params.handle}`);
  } catch (err: unknown) {
    if (err instanceof CannotActOnSelfError) { badRequest(res, "You cannot mute yourself"); return; }
    console.error("[community/relations POST /mute/:handle]", err);
    internalError(res);
  }
});

// ── DELETE /mute/:handle ─ Unmute a user ───────────────────────────────────

router.delete("/mute/:handle", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const target = await resolveHandle(req.params.handle);
    if (!target) { notFound(res, "User not found"); return; }
    const result = await userRelationService.unmuteUser(authReq.userId, target.id);
    ok(res, result, `Unmuted @${req.params.handle}`);
  } catch (err) {
    console.error("[community/relations DELETE /mute/:handle]", err);
    internalError(res);
  }
});

// ── GET /muted ─ My muted users ────────────────────────────────────────────

router.get("/muted", authenticate, validate(PaginationSchema, "query"), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const query   = req.query as unknown as z.infer<typeof PaginationSchema>;
  try {
    const result = await userRelationService.getMutedUsers(authReq.userId, query.page, query.pageSize);
    ok(res, result);
  } catch (err) {
    console.error("[community/relations GET /muted]", err);
    internalError(res);
  }
});

export default router;
