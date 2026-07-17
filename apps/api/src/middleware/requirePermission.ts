import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "./authenticate";
import { hasPermission } from "../server/permissions/permissionService";
import { forbidden } from "../lib/response";

/**
 * Require one or more permission keys (OR logic — any one grants access).
 * Must be called after authenticate().
 */
export function requirePermission(...keys: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;

    if (!authReq.roles) {
      forbidden(res, "Authentication required before permission check");
      return;
    }

    // Fast path: permissions were pre-computed by authenticate()
    if (authReq.permissions) {
      if (!keys.some((k) => authReq.permissions.includes(k))) {
        forbidden(res, "Insufficient permissions");
        return;
      }
      next();
      return;
    }

    // Fallback: compute on demand
    const checks = await Promise.all(keys.map((k) => hasPermission(authReq.roles, k)));
    if (!checks.some(Boolean)) {
      forbidden(res, "Insufficient permissions");
      return;
    }
    next();
  };
}