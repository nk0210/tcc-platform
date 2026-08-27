import { Router }   from "express";
import { z }        from "zod";
import db            from "../lib/prisma";
import { hashPassword, verifyPassword }         from "../lib/password";
import { signAccessToken, signRefreshToken,
         verifyRefreshToken, getRefreshTokenExpiresAt,
         getAccessTokenExpiresInSeconds }        from "../lib/jwt";
import { generateTccId }                        from "../lib/tccId";
import { validate }                             from "../middleware/validate";
import { authenticate, type AuthRequest }       from "../middleware/authenticate";
import { getEffectivePermissions }              from "../server/permissions/permissionService";
import {
  ok, created, unauthorized, conflict, internalError,
} from "../lib/response";

const router = Router();

const RegisterSchema = z.object({
  email:       z.string().email(),
  password:    z.string().min(8),
  handle:      z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(50),
});
const LoginSchema   = z.object({ email: z.string().email(), password: z.string().min(1) });
const RefreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post("/register", validate(RegisterSchema), async (req, res) => {
  const { email, password, handle, displayName } = req.body as z.infer<typeof RegisterSchema>;
  try {
    const exists = await db.user.findFirst({ where: { OR: [{ email }, { handle }] }, select: { email: true } });
    if (exists) { conflict(res, exists.email === email ? "Email already in use" : "Handle already taken"); return; }

    const user = await db.user.create({
      data: {
        email, handle, displayName, tccId: generateTccId("TRD"),
        passwordHash:    await hashPassword(password),
        roles:           ["NORMAL_USER"],
        status:          "ACTIVE",
        tradingIdentity: { create: {} },
        socialLinks:     { create: {} },
      },
      select: { id: true, tccId: true, email: true, handle: true, displayName: true, roles: true, status: true, isVerified: true, experienceLevel: true },
    });

    const session = await db.session.create({
      data: { userId: user.id, refreshToken: "placeholder", expiresAt: getRefreshTokenExpiresAt(), userAgent: req.headers["user-agent"] ?? null, ipAddress: req.ip ?? null },
    });

    const at = signAccessToken({ userId: user.id, email: user.email, handle: user.handle, roles: user.roles as string[] });
    const rt = signRefreshToken({ userId: user.id, handle: user.handle, tokenId: session.id });
    await db.session.update({ where: { id: session.id }, data: { refreshToken: rt } });

    created(res, {
      user:   { ...user, permissions: await getEffectivePermissions(user.roles as string[]) },
      tokens: { accessToken: at, refreshToken: rt, expiresIn: getAccessTokenExpiresInSeconds() },
    }, "Account created");
  } catch (err) { console.error("[auth/register]", err); internalError(res); }
});

router.post("/login", validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof LoginSchema>;
  try {
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, tccId: true, email: true, handle: true, displayName: true, roles: true, status: true, isVerified: true, experienceLevel: true, passwordHash: true, isActive: true, isSuspended: true },
    });
    if (!user)                                          { unauthorized(res, "Invalid credentials"); return; }
    if (!user.isActive || user.status === "DEACTIVATED") { unauthorized(res, "Account deactivated");  return; }
    if (user.isSuspended || user.status === "SUSPENDED") { unauthorized(res, "Account suspended");     return; }
    if (user.status === "BANNED")                        { unauthorized(res, "Account banned");        return; }
    if (!(await verifyPassword(password, user.passwordHash))) { unauthorized(res, "Invalid credentials"); return; }

    const session = await db.session.create({
      data: { userId: user.id, refreshToken: "placeholder", expiresAt: getRefreshTokenExpiresAt(), userAgent: req.headers["user-agent"] ?? null, ipAddress: req.ip ?? null },
    });
    const at = signAccessToken({ userId: user.id, email: user.email, handle: user.handle, roles: user.roles as string[] });
    const rt = signRefreshToken({ userId: user.id, handle: user.handle, tokenId: session.id });
    await db.session.update({ where: { id: session.id }, data: { refreshToken: rt } });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    ok(res, {
      user:   { id: user.id, tccId: user.tccId, email: user.email, handle: user.handle, displayName: user.displayName, roles: user.roles, status: user.status, isVerified: user.isVerified, experienceLevel: user.experienceLevel, permissions: await getEffectivePermissions(user.roles as string[]) },
      tokens: { accessToken: at, refreshToken: rt, expiresIn: getAccessTokenExpiresInSeconds() },
    }, "Logged in");
  } catch (err) { console.error("[auth/login]", err); internalError(res); }
});

router.post("/refresh", validate(RefreshSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof RefreshSchema>;
  try {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try { payload = verifyRefreshToken(refreshToken); }
    catch { unauthorized(res, "Invalid refresh token"); return; }

    const session = await db.session.findUnique({
      where: { refreshToken },
      include: { user: { select: { id: true, email: true, handle: true, roles: true, isActive: true, isSuspended: true, status: true } } },
    });
    if (!session || session.userId !== payload.sub)      { unauthorized(res, "Refresh token not found"); return; }
    if (session.expiresAt < new Date())                  { await db.session.delete({ where: { id: session.id } }); unauthorized(res, "Refresh token expired"); return; }
    if (!session.user.isActive || session.user.status === "BANNED") { await db.session.delete({ where: { id: session.id } }); unauthorized(res, "Account inactive"); return; }

    const at = signAccessToken({ userId: session.user.id, email: session.user.email, handle: session.user.handle, roles: session.user.roles as string[] });
    const rt = signRefreshToken({ userId: session.user.id, handle: session.user.handle, tokenId: session.id });
    await db.session.update({ where: { id: session.id }, data: { refreshToken: rt, expiresAt: getRefreshTokenExpiresAt() } });

    ok(res, { tokens: { accessToken: at, refreshToken: rt, expiresIn: getAccessTokenExpiresInSeconds() } });
  } catch (err) { console.error("[auth/refresh]", err); internalError(res); }
});

router.delete("/logout", validate(RefreshSchema), async (req, res) => {
  try { await db.session.deleteMany({ where: { refreshToken: req.body.refreshToken } }); ok(res, null, "Logged out"); }
  catch (err) { console.error("[auth/logout]", err); internalError(res); }
});

router.delete("/logout-all", authenticate, async (req, res) => {
  try { await db.session.deleteMany({ where: { userId: (req as AuthRequest).userId } }); ok(res, null, "Logged out all"); }
  catch (err) { console.error("[auth/logout-all]", err); internalError(res); }
});

router.get("/me", authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const user = await db.user.findUnique({
      where: { id: authReq.userId },
      select: { id: true, tccId: true, email: true, handle: true, displayName: true, bio: true, location: true, avatarUrl: true, roles: true, status: true, isVerified: true, lastLoginAt: true, profileVisibility: true, portfolioVisibility: true, experienceLevel: true, isActive: true, isSuspended: true, createdAt: true, updatedAt: true, socialLinks: true, tradingIdentity: true },
    });
    if (!user) { unauthorized(res, "User not found"); return; }
    ok(res, { ...user, permissions: authReq.permissions });
  } catch (err) { console.error("[auth/me]", err); internalError(res); }
});

export default router;