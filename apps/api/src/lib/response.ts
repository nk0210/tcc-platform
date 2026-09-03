import type { Response } from "express";

export function ok<T>(res: Response, data: T, message?: string, status = 200): Response {
  return res.status(status).json({
    success: true,
    data,
    ...(message ? { message } : {}),
  });
}

export function created<T>(res: Response, data: T, message?: string): Response {
  return ok(res, data, message, 201);
}

export function badRequest(
  res: Response,
  error: string,
  details?: Record<string, string[]>
): Response {
  return res.status(400).json({
    success: false,
    error,
    code: "BAD_REQUEST",
    ...(details ? { details } : {}),
  });
}

export function unauthorized(res: Response, error = "Authentication required"): Response {
  return res.status(401).json({ success: false, error, code: "UNAUTHORIZED" });
}

export function forbidden(res: Response, error = "Insufficient permissions"): Response {
  return res.status(403).json({ success: false, error, code: "FORBIDDEN" });
}

export function notFound(res: Response, error = "Resource not found"): Response {
  return res.status(404).json({ success: false, error, code: "NOT_FOUND" });
}

export function conflict(res: Response, error: string): Response {
  return res.status(409).json({ success: false, error, code: "CONFLICT" });
}

export function internalError(res: Response, error = "Internal server error"): Response {
  return res.status(500).json({ success: false, error, code: "INTERNAL_ERROR" });
}