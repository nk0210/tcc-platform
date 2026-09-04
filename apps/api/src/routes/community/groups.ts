/**
 * Community Group Routes
 * Mounted at: /community/groups
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../../middleware/authenticate";
import { validate }             from "../../middleware/validate";
import { communityGroupService, GroupNotFoundError, NotGroupMemberError, NotGroupAdminError, OwnerCannotLeaveError, AlreadyMemberError } from "../../server/services/communityGroupService";
import { communityFeedService } from "../../server/services/communityFeedService";
import { communityPostService } from "../../server/services/communityPostService";
import { ok, created, notFound, badRequest, forbidden, internalError } from "../../lib/response";
import type { PostType, PostVisibility } from "@prisma/client";

const router: ReturnType<typeof Router> = Router();

const PaginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  search:   z.string().max(100).optional(),
});

const CreateGroupSchema = z.object({
  name:          z.string().min(2, "Name is required").max(80),
  description:   z.string().max(500).default(""),
  visibility:    z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  coverImageUrl: z.string().url().max(500).optional().nullable(),
});

const UpdateGroupSchema = z.object({
  name:          z.string().min(2).max(80).optional(),
  description:   z.string().max(500).optional(),
  visibility:    z.enum(["PUBLIC", "PRIVATE"]).optional(),
  coverImageUrl: z.string().url().max(500).optional().nullable(),
});

const RoleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });

const GroupFeedSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  sort:     z.enum(["latest", "trending"]).default("latest"),
});

const CreateGroupPostSchema = z.object({
  type:       z.enum(["TEXT","TRADE_IDEA","SHARED_TRADE","ACADEMY_COMPLETION","STRATEGY_SHARE","COMPETITION_UPDATE"]).default("TEXT"),
  content:    z.string().min(1, "Content is required").max(5000),
  tradeSnapshot: z.record(z.unknown()).optional().nullable(),
  symbol:     z.string().max(20).optional().nullable(),
  tags:       z.array(z.string().max(50)).max(10).default([]),
});

function handleGroupError(err: unknown, res: import("express").Response): boolean {
  if (err instanceof GroupNotFoundError)   { notFound(res, "Group not found"); return true; }
  if (err instanceof NotGroupMemberError)  { forbidden(res, "You're not a member of this group"); return true; }
  if (err instanceof NotGroupAdminError)   { forbidden(res, "You don't have permission to do that"); return true; }
  if (err instanceof OwnerCannotLeaveError){ badRequest(res, "The owner can't leave — delete the group instead"); return true; }
  if (err instanceof AlreadyMemberError)   { badRequest(res, "You're already a member"); return true; }
  return false;
}

// ── GET /groups ─ Discover public groups ───────────────────────────────────

router.get("/", optionalAuthenticate, validate(PaginationSchema, "query"), async (req, res) => {
  const query = req.query as unknown as z.infer<typeof PaginationSchema>;
  try {
    const result = await communityGroupService.discoverGroups(query.page, query.pageSize, query.search);
    ok(res, result);
  } catch (err) {
    console.error("[community/groups GET /]", err);
    internalError(res);
  }
});

// ── GET /groups/mine ─ Groups I'm a member of ──────────────────────────────

router.get("/mine", authenticate, validate(PaginationSchema, "query"), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const query   = req.query as unknown as z.infer<typeof PaginationSchema>;
  try {
    const result = await communityGroupService.getMyGroups(authReq.userId, query.page, query.pageSize);
    ok(res, result);
  } catch (err) {
    console.error("[community/groups GET /mine]", err);
    internalError(res);
  }
});

// ── POST /groups ─ Create a group ───────────────────────────────────────────

router.post("/", authenticate, validate(CreateGroupSchema), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const body    = req.body as z.infer<typeof CreateGroupSchema>;
  try {
    const group = await communityGroupService.createGroup(authReq.userId, body);
    created(res, group, "Group created");
  } catch (err) {
    console.error("[community/groups POST /]", err);
    internalError(res);
  }
});

// ── GET /groups/:idOrSlug ─ Get one group ───────────────────────────────────

router.get("/:idOrSlug", optionalAuthenticate, async (req, res) => {
  const authReq  = req as unknown as AuthRequest;
  const viewerId = authReq.userId ?? undefined;
  try {
    const group = await communityGroupService.getGroup(req.params.idOrSlug, viewerId);
    ok(res, group);
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups GET /:idOrSlug]", err);
    internalError(res);
  }
});

// ── PATCH /groups/:groupId ─ Update (owner/admin) ───────────────────────────

router.patch("/:groupId", authenticate, validate(UpdateGroupSchema), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const body    = req.body as z.infer<typeof UpdateGroupSchema>;
  try {
    const group = await communityGroupService.updateGroup(req.params.groupId, authReq.userId, body);
    ok(res, group, "Group updated");
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups PATCH /:groupId]", err);
    internalError(res);
  }
});

// ── DELETE /groups/:groupId ─ Delete (owner only) ───────────────────────────

router.delete("/:groupId", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    await communityGroupService.deleteGroup(req.params.groupId, authReq.userId);
    ok(res, { deleted: true }, "Group deleted");
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups DELETE /:groupId]", err);
    internalError(res);
  }
});

// ── POST /groups/:groupId/join ───────────────────────────────────────────

router.post("/:groupId/join", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const result = await communityGroupService.joinGroup(req.params.groupId, authReq.userId);
    ok(res, result, "Joined group");
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups POST /:groupId/join]", err);
    internalError(res);
  }
});

// ── POST /groups/:groupId/leave ─────────────────────────────────────────

router.post("/:groupId/leave", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    const result = await communityGroupService.leaveGroup(req.params.groupId, authReq.userId);
    ok(res, result, "Left group");
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups POST /:groupId/leave]", err);
    internalError(res);
  }
});

// ── GET /groups/:groupId/members ───────────────────────────────────────────

router.get("/:groupId/members", optionalAuthenticate, validate(PaginationSchema, "query"), async (req, res) => {
  const query = req.query as unknown as z.infer<typeof PaginationSchema>;
  try {
    const result = await communityGroupService.getMembers(req.params.groupId, query.page, query.pageSize);
    ok(res, result);
  } catch (err) {
    console.error("[community/groups GET /:groupId/members]", err);
    internalError(res);
  }
});

// ── DELETE /groups/:groupId/members/:userId ─ Kick (owner/admin) ─────────

router.delete("/:groupId/members/:userId", authenticate, async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  try {
    await communityGroupService.kickMember(req.params.groupId, authReq.userId, req.params.userId);
    ok(res, { removed: true }, "Member removed");
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups DELETE /:groupId/members/:userId]", err);
    internalError(res);
  }
});

// ── PATCH /groups/:groupId/members/:userId/role ─ Owner only ─────────────

router.patch("/:groupId/members/:userId/role", authenticate, validate(RoleSchema), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const body    = req.body as z.infer<typeof RoleSchema>;
  try {
    const membership = await communityGroupService.setMemberRole(req.params.groupId, authReq.userId, req.params.userId, body.role);
    ok(res, membership, "Role updated");
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups PATCH /:groupId/members/:userId/role]", err);
    internalError(res);
  }
});

// ── GET /groups/:groupId/posts ─ Group feed ─────────────────────────────

router.get("/:groupId/posts", optionalAuthenticate, validate(GroupFeedSchema, "query"), async (req, res) => {
  const authReq  = req as unknown as AuthRequest;
  const viewerId = authReq.userId ?? undefined;
  const query    = req.query as unknown as z.infer<typeof GroupFeedSchema>;
  try {
    const feed = await communityFeedService.getGroupFeed(req.params.groupId, query, viewerId);
    ok(res, feed);
  } catch (err) {
    console.error("[community/groups GET /:groupId/posts]", err);
    internalError(res);
  }
});

// ── POST /groups/:groupId/posts ─ Post into a group (members only) ───────

router.post("/:groupId/posts", authenticate, validate(CreateGroupPostSchema), async (req, res) => {
  const authReq = req as unknown as AuthRequest;
  const body    = req.body as z.infer<typeof CreateGroupPostSchema>;
  try {
    await communityGroupService.requireMembership(req.params.groupId, authReq.userId);
    const post = await communityPostService.createPost({
      authorId:   authReq.userId,
      type:       body.type as PostType,
      content:    body.content,
      visibility: "PUBLIC" as PostVisibility,
      tradeSnapshot: body.tradeSnapshot as import("@prisma/client").Prisma.InputJsonValue | null | undefined,
      symbol:     body.symbol,
      tags:       body.tags,
      groupId:    req.params.groupId,
    });
    created(res, post, "Posted to group");
  } catch (err) {
    if (handleGroupError(err, res)) return;
    console.error("[community/groups POST /:groupId/posts]", err);
    internalError(res);
  }
});

export default router;
