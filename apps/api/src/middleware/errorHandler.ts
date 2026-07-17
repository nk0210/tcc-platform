import type { Request, Response, NextFunction } from "express";
import { isDev } from "../config/env";

export interface AppError extends Error {
  statusCode?: number;
  code?:       string;
}

export function errorHandler(
  err:  AppError,
  req:  Request,
  res:  Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message    = statusCode < 500 ? err.message : "Internal server error";

  if (isDev()) {
    console.error(`[ERROR] ${req.method} ${req.path}`, err);
  } else if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error:   message,
    code:    err.code ?? (statusCode >= 500 ? "INTERNAL_ERROR" : "CLIENT_ERROR"),
    ...(isDev() && statusCode >= 500 ? { stack: err.stack } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error:   `Route not found: ${req.method} ${req.path}`,
    code:    "NOT_FOUND",
  });
}