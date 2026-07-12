/**
 * TCC requirePermission middleware — RBAC enforcement.
 *
 * Usage (after `authenticate`):
 *   router.post("/owner/users/:id/ban", authenticate, requirePermission("user.ban"), handler)
 *
 * Semantics: ANY of the listed permissions grants access (OR logic),
 * matching the existing requireRole() pattern.
 */
import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "./authenticate";
import { hasPermission } from "../server/permissions/permissionService";
import type { PermissionKey } from "../server/permissions/permissionRegistry";
import { forbidden } from "../lib/response";

export function requirePermission(...keys: PermissionKey[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;

    if (!authReq.roles) {
      forbidden(res, "Authentication required before permission check");
      return;
    }

    // Fast path: permissions already computed by authenticate middleware
    if (authReq.permissions) {
      const allowed = keys.some((k) => authReq.permissions!.includes(k));
      if (!allowed) { forbidden(res, "Insufficient permissions"); return; }
      next();
      return;
    }

    // Fallback: compute on the fly (should rarely hit this path)
    const checks = await Promise.all(keys.map((k) => hasPermission(authReq.roles, k)));
    if (!checks.some(Boolean)) {
      forbidden(res, "Insufficient permissions");
      return;
    }
    next();
  };
}