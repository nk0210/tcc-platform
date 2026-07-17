import { Router } from "express";
import { z }      from "zod";
import db          from "../lib/prisma";
import { validate }                       from "../middleware/validate";
import { authenticate, type AuthRequest } from "../middleware/authenticate";
import { ok, notFound, badRequest, internalError } from "../lib/response";

const router = Router();

const ProfileUpdateSchema = z.object({
  displayName:         z.string().min(1).max(50).optional(),
  bio:                 z.string().max(500).optional(),
  location:            z.string().max(100).optional(),
  profileVisibility:   z.enum(["PUBLIC","PRIVATE","FOLLOWERS_ONLY"]).optional(),
  portfolioVisibility: z.enum(["PUBLIC","PRIVATE","FOLLOWERS_ONLY"]).optional(),
  experienceLevel:     z.enum(["BEGINNER","INTERMEDIATE","ADVANCED","PROFESSIONAL"]).nullable().optional(),
  tradingIdentity: z.object({
    marketsTraded:     z.array(z.string()).optional(),
    symbolsTraded:     z.array(z.string()).optional(),
    strategiesUsed:    z.array(z.string()).optional(),
    preferredSessions: z.array(z.string()).optional(),
  }).optional(),
  socialLinks: z.object({
    website:   z.string().url().nullable().optional(),
    x:         z.string().nullable().optional(),
    linkedin:  z.string().nullable().optional(),
    youtube:   z.string().nullable().optional(),
    instagram: z.string().nullable().optional(),
  }).optional(),
});

router.get("/profile", authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const user = await db.user.findUnique({ where: { id: authReq.userId }, include: { socialLinks: true, tradingIdentity: true, _count: { select: { followedBy: true, following: true, posts: true } } } });
    if (!user) { notFound(res); return; }
    ok(res, user);
  } catch (err) { console.error("[users/profile]", err); internalError(res); }
});

router.put("/profile", authenticate, validate(ProfileUpdateSchema), async (req, res) => {
  const authReq = req as AuthRequest;
  const body    = req.body as z.infer<typeof ProfileUpdateSchema>;
  try {
    const updates: Record<string, unknown> = {};
    if (body.displayName         != null) updates["displayName"]         = body.displayName;
    if (body.bio                 != null) updates["bio"]                 = body.bio;
    if (body.location            != null) updates["location"]            = body.location;
    if (body.profileVisibility   != null) updates["profileVisibility"]   = body.profileVisibility;
    if (body.portfolioVisibility != null) updates["portfolioVisibility"] = body.portfolioVisibility;
    if (body.experienceLevel     !== undefined) updates["experienceLevel"] = body.experienceLevel;

    const user = await db.user.update({
      where: { id: authReq.userId },
      data: {
        ...updates,
        ...(body.socialLinks ? { socialLinks: { upsert: { create: { ...body.socialLinks }, update: { ...body.socialLinks } } } } : {}),
        ...(body.tradingIdentity ? { tradingIdentity: { upsert: { create: { marketsTraded: [], symbolsTraded: [], strategiesUsed: [], preferredSessions: [], ...body.tradingIdentity }, update: { ...body.tradingIdentity } } } } : {}),
      },
      include: { socialLinks: true, tradingIdentity: true },
    });
    ok(res, user, "Profile updated");
  } catch (err) { console.error("[users/profile/put]", err); internalError(res); }
});

router.get("/:handle", async (req, res) => {
  try {
    const user = await db.user.findUnique({ where: { handle: req.params.handle }, select: { id: true, tccId: true, handle: true, displayName: true, bio: true, location: true, avatarUrl: true, roles: true, profileVisibility: true, experienceLevel: true, isActive: true, createdAt: true, socialLinks: true, tradingIdentity: true, _count: { select: { followedBy: true, following: true } } } });
    if (!user || !user.isActive) { notFound(res); return; }
    if (user.profileVisibility === "PRIVATE") { ok(res, { id: user.id, handle: user.handle, displayName: user.displayName, isPrivate: true }); return; }
    ok(res, user);
  } catch (err) { console.error("[users/:handle]", err); internalError(res); }
});

router.post("/:handle/follow", authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const target = await db.user.findUnique({ where: { handle: req.params.handle }, select: { id: true } });
    if (!target) { notFound(res); return; }
    if (target.id === authReq.userId) { badRequest(res, "Cannot follow yourself"); return; }
    const follow = await db.follow.upsert({ where: { sourceId_targetId: { sourceId: authReq.userId, targetId: target.id } }, create: { sourceId: authReq.userId, targetId: target.id, status: "ACTIVE" }, update: { status: "ACTIVE" } });
    ok(res, follow, "Following");
  } catch (err) { console.error("[users/follow]", err); internalError(res); }
});

router.delete("/:handle/follow", authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const target = await db.user.findUnique({ where: { handle: req.params.handle }, select: { id: true } });
    if (!target) { notFound(res); return; }
    await db.follow.deleteMany({ where: { sourceId: authReq.userId, targetId: target.id } });
    ok(res, null, "Unfollowed");
  } catch (err) { console.error("[users/unfollow]", err); internalError(res); }
});

export default router;