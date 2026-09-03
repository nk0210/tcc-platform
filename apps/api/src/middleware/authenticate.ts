/**
 * TCC JWT authentication middleware.
 *
 * AuthRequest extends Express Request — the `req as AuthRequest` cast in routes
 * is valid and standard Express pattern (not an unsafe cast).
 *
 * Roles are string[] — identical values to Prisma UserRole enum but decoupled
 * from the Prisma package so middleware never imports Prisma types.
 */
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { unauthorized } from "../lib/response";
import db from "../lib/prisma";
import { getEffectivePermissions } from "../server/permissions/permissionService";
import { getCachedAuthStatus, setCachedAuthStatus } from "./authStatusCache";

// ── AuthRequest ───────────────────────────────────────────────────────────
// Augments Express Request with auth fields attached by authenticate().

export interface AuthRequest extends Request {
  userId:      string;
  email:       string;
  handle:      string;
  roles:       string[];
  permissions: string[];
}

// ── authenticate ──────────────────────────────────────────────────────────

export async function authenticate(
  req:  Request,
  res:  Response,
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

    let status = getCachedAuthStatus(payload.sub);
    if (!status) {
      const user = await db.user.findUnique({
        where:  { id: payload.sub },
        select: { isActive: true, isSuspended: true, status: true },
      });

      if (!user) {
        unauthorized(res, "Account not found");
        return;
      }

      status = user;
      setCachedAuthStatus(payload.sub, status);
    }

    if (
      !status.isActive ||
      status.isSuspended ||
      status.status === "BANNED" ||
      status.status === "DEACTIVATED"
    ) {
      unauthorized(res, "Account is inactive, suspended, or banned");
      return;
    }

    const authReq        = req as AuthRequest;
    authReq.userId       = payload.sub;
    authReq.email        = payload.email;
    authReq.handle       = payload.handle;
    authReq.roles        = payload.roles;
    authReq.permissions  = await getEffectivePermissions(payload.roles);

    next();
  } catch {
    unauthorized(res, "Invalid or expired token");
  }
}

// ── optionalAuthenticate ──────────────────────────────────────────────────

export async function optionalAuthenticate(
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload        = verifyAccessToken(header.slice(7));
      const authReq        = req as AuthRequest;
      authReq.userId       = payload.sub;
      authReq.email        = payload.email;
      authReq.handle       = payload.handle;
      authReq.roles        = payload.roles;
      authReq.permissions  = await getEffectivePermissions(payload.roles);
    } catch {
      // Invalid token — continue unauthenticated
    }
  }
  next();
}