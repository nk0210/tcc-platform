import { Router } from "express";
import { z }      from "zod";
import db          from "../lib/prisma";
import { hashPassword, verifyPassword }        from "../lib/password";
import { signAccessToken, signRefreshToken,
         verifyRefreshToken, getRefreshTokenExpiresAt,
         getAccessTokenExpiresInSeconds }       from "../lib/jwt";
import { generateTccId }                       from "../lib/tccId";
import { validate }                            from "../middleware/validate";
import { authenticate, type AuthRequest }      from "../middleware/authenticate";
import { getEffectivePermissions }             from "../server/permissions/permissionService";
import {
  ok, created, unauthorized, conflict,
  internalError
} from "../lib/response";

const router = Router();

// ── Schemas ────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  email:       z.string().email("Invalid email address"),
  password:    z.string().min(8, "Password must be at least 8 characters"),
  handle:      z.string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Handle can only contain letters, numbers, and underscores"),
  displayName: z.string().min(1, "Display name is required").max(50),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── POST /auth/register ────────────────────────────────────────────────────

router.post("/register", validate(RegisterSchema), async (req, res) => {
  const { email, password, handle, displayName } = req.body as z.infer<typeof RegisterSchema>;

  try {
    const existing = await db.user.findFirst({
      where: { OR: [{ email }, { handle }] },
      select: { email: true, handle: true },
    });

    if (existing) {
      if (existing.email === email) {
        conflict(res, "An account with this email already exists");
        return;
      }
      conflict(res, "This handle is already taken");
      return;
    }

    const passwordHash = await hashPassword(password);
    const tccId        = generateTccId("TRD");

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        handle,
        displayName,
        tccId,
        roles:  ["NORMAL_USER"],
        status: "ACTIVE",
        tradingIdentity: { create: {} },
        socialLinks:     { create: {} },
      },
      select: {
        id: true, tccId: true, email: true, handle: true,
        displayName: true, roles: true, status: true, isVerified: true,
      },
    });

    const session = await db.session.create({
      data: {
        userId:       user.id,
        refreshToken: "placeholder",
        expiresAt:    getRefreshTokenExpiresAt(),
        userAgent:    req.headers["user-agent"] ?? null,
        ipAddress:    (req.ip ?? req.socket.remoteAddress) ?? null,
      },
    });

    const accessToken  = signAccessToken({
      userId: user.id, email: user.email, handle: user.handle, roles: user.roles as any,
    });
    const refreshToken = signRefreshToken({
      userId: user.id, handle: user.handle, tokenId: session.id,
    });

    await db.session.update({ where: { id: session.id }, data: { refreshToken } });

    const permissions = await getEffectivePermissions(user.roles as any);

    created(res, {
      user: { ...user, permissions },
      tokens: { accessToken, refreshToken, expiresIn: getAccessTokenExpiresInSeconds() },
    }, "Account created successfully");
  } catch (err) {
    console.error("[register]", err);
    internalError(res);
  }
});

// ── POST /auth/login ───────────────────────────────────────────────────────

router.post("/login", validate(LoginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof LoginSchema>;

  try {
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true, tccId: true, email: true, handle: true, displayName: true,
        roles: true, status: true, isVerified: true, passwordHash: true,
        isActive: true, isSuspended: true,
      },
    });

    if (!user) { unauthorized(res, "Invalid email or password"); return; }
    if (!user.isActive || user.status === "DEACTIVATED") { unauthorized(res, "This account has been deactivated"); return; }
    if (user.isSuspended || user.status === "SUSPENDED")  { unauthorized(res, "This account has been suspended");  return; }
    if (user.status === "BANNED")                          { unauthorized(res, "This account has been banned");     return; }

    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) { unauthorized(res, "Invalid email or password"); return; }

    const session = await db.session.create({
      data: {
        userId:       user.id,
        refreshToken: "placeholder",
        expiresAt:    getRefreshTokenExpiresAt(),
        userAgent:    req.headers["user-agent"] ?? null,
        ipAddress:    (req.ip ?? req.socket.remoteAddress) ?? null,
      },
    });

    const accessToken  = signAccessToken({
      userId: user.id, email: user.email, handle: user.handle, roles: user.roles as any,
    });
    const refreshToken = signRefreshToken({
      userId: user.id, handle: user.handle, tokenId: session.id,
    });

    await db.session.update({ where: { id: session.id }, data: { refreshToken } });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const permissions = await getEffectivePermissions(user.roles as any);

    ok(res, {
      user: {
        id: user.id, tccId: user.tccId, email: user.email, handle: user.handle,
        displayName: user.displayName, roles: user.roles, status: user.status,
        isVerified: user.isVerified, permissions,
      },
      tokens: { accessToken, refreshToken, expiresIn: getAccessTokenExpiresInSeconds() },
    }, "Logged in successfully");
  } catch (err) {
    console.error("[login]", err);
    internalError(res);
  }
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────

router.post("/refresh", validate(RefreshSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof RefreshSchema>;

  try {
    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      unauthorized(res, "Invalid or expired refresh token");
      return;
    }

    const session = await db.session.findUnique({
      where:  { refreshToken },
      include: { user: { select: { id: true, email: true, handle: true, roles: true, isActive: true, isSuspended: true, status: true } } },
    });

    if (!session || session.userId !== payload.sub) {
      unauthorized(res, "Refresh token not found or user mismatch");
      return;
    }

    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } });
      unauthorized(res, "Refresh token has expired. Please log in again.");
      return;
    }

    if (!session.user.isActive || session.user.isSuspended || session.user.status === "BANNED" || session.user.status === "DEACTIVATED") {
      await db.session.delete({ where: { id: session.id } });
      unauthorized(res, "Account is inactive, suspended, or banned");
      return;
    }

    const newAccessToken  = signAccessToken({
      userId: session.user.id, email: session.user.email, handle: session.user.handle, roles: session.user.roles as any,
    });
    const newRefreshToken = signRefreshToken({
      userId: session.user.id, handle: session.user.handle, tokenId: session.id,
    });

    await db.session.update({
      where: { id: session.id },
      data:  { refreshToken: newRefreshToken, expiresAt: getRefreshTokenExpiresAt() },
    });

    ok(res, {
      tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: getAccessTokenExpiresInSeconds() },
    });
  } catch (err) {
    console.error("[refresh]", err);
    internalError(res);
  }
});

// ── DELETE /auth/logout ────────────────────────────────────────────────────

router.delete("/logout", validate(RefreshSchema), async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof RefreshSchema>;
  try {
    await db.session.deleteMany({ where: { refreshToken } });
    ok(res, null, "Logged out successfully");
  } catch (err) {
    console.error("[logout]", err);
    internalError(res);
  }
});

// ── DELETE /auth/logout-all ─────────────────────────────────────────────────

router.delete("/logout-all", authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    await db.session.deleteMany({ where: { userId: authReq.userId } });
    ok(res, null, "Logged out from all devices");
  } catch (err) {
    console.error("[logout-all]", err);
    internalError(res);
  }
});

// ── GET /auth/me ───────────────────────────────────────────────────────────

router.get("/me", authenticate, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const user = await db.user.findUnique({
      where: { id: authReq.userId },
      select: {
        id: true, tccId: true, email: true, handle: true, displayName: true,
        bio: true, location: true, avatarUrl: true, roles: true, status: true,
        isVerified: true, lastLoginAt: true, profileVisibility: true,
        portfolioVisibility: true, experienceLevel: true, isActive: true,
        isSuspended: true, createdAt: true, updatedAt: true,
        socialLinks: true, tradingIdentity: true,
      },
    });

    if (!user) { unauthorized(res, "User not found"); return; }

    ok(res, { ...user, permissions: authReq.permissions });
  } catch (err) {
    console.error("[me]", err);
    internalError(res);
  }
});

export default router;