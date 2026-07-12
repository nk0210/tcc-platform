import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { unauthorized } from "../lib/response";
import db from "../lib/prisma";
import type { UserRole } from "@tcc/types";
import { getEffectivePermissions } from "../server/permissions/permissionService";

export interface AuthRequest extends Request {
  userId:      string;
  email:       string;
  handle:      string;
  roles:       UserRole[];
  permissions: string[];
}

/**
 * Require a valid Bearer JWT access token.
 * Attaches userId, email, handle, roles, and effective permissions
 * to the request. Permissions are read from the in-memory cache
 * (see permissionService.ts) — no extra DB query.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    unauthorized(res);
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);

    const user = await db.user.findUnique({
      where:  { id: payload.sub },
      select: { id: true, isActive: true, isSuspended: true, status: true },
    });

    if (!user) {
      unauthorized(res, "Account not found");
      return;
    }

    // Dual check during status-field migration period (see tech debt notes)
    if (!user.isActive || user.isSuspended || user.status === "BANNED" || user.status === "DEACTIVATED") {
      unauthorized(res, "Account is inactive, suspended, or banned");
      return;
    }

    const authReq = req as AuthRequest;
    authReq.userId  = payload.sub;
    authReq.email   = payload.email;
    authReq.handle  = payload.handle;
    authReq.roles   = payload.roles;
    authReq.permissions = await getEffectivePermissions(payload.roles as any);

    next();
  } catch {
    unauthorized(res, "Invalid or expired token");
  }
}

/**
 * Require specific roles (call after authenticate).
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    const hasRole = authReq.roles?.some((r) => allowedRoles.includes(r));
    if (!hasRole) {
      res.status(403).json({ success: false, error: "Insufficient permissions", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}

/**
 * Optional authentication — attaches user if token present, continues if not.
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  try {
    const token   = header.slice(7);
    const payload = verifyAccessToken(token);
    const authReq = req as AuthRequest;
    authReq.userId  = payload.sub;
    authReq.email   = payload.email;
    authReq.handle  = payload.handle;
    authReq.roles   = payload.roles;
    authReq.permissions = await getEffectivePermissions(payload.roles as any);
  } catch {
    // Ignore invalid token for optional auth
  }

  next();
}