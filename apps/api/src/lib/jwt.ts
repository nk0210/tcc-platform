/**
 * JWT utilities for TCC API.
 *
 * Payloads extend JwtPayload so jwt.verify() cast is safe and correct.
 * Roles are string[] throughout — never Prisma UserRole enum — to avoid
 * cross-package type conflicts.
 */

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { getEnv } from "../config/env";

// ─────────────────────────────────────────────────────────────────────────────
// Payload interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  handle: string;
  roles: string[];
  type: "access";
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  handle: string;
  tokenId: string;
  type: "refresh";
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseExpirySeconds(raw: string): number {
  const match = raw.match(/^(\d+)([smhd])$/);

  if (!match) return 900;

  const value = Number(match[1]);

  const unit = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  } as const;

  return value * unit[match[2] as keyof typeof unit];
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign
// ─────────────────────────────────────────────────────────────────────────────

export function signAccessToken(payload: {
  userId: string;
  email: string;
  handle: string;
  roles: string[];
}): string {
  const env = getEnv();

  return jwt.sign(
    {
      sub: payload.userId,
      email: payload.email,
      handle: payload.handle,
      roles: payload.roles,
      type: "access",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    }
  );
}

export function signRefreshToken(payload: {
  userId: string;
  handle: string;
  tokenId: string;
}): string {
  const env = getEnv();

  return jwt.sign(
    {
      sub: payload.userId,
      handle: payload.handle,
      tokenId: payload.tokenId,
      type: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Verify
// ─────────────────────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, getEnv().JWT_ACCESS_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Unexpected string JWT payload");
  }

  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, getEnv().JWT_REFRESH_SECRET);

  if (typeof decoded === "string") {
    throw new Error("Unexpected string JWT payload");
  }

  return decoded as RefreshTokenPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getAccessTokenExpiresInSeconds(): number {
  return parseExpirySeconds(getEnv().JWT_ACCESS_EXPIRES_IN);
}

export function getRefreshTokenExpiresAt(): Date {
  return new Date(
    Date.now() +
      parseExpirySeconds(getEnv().JWT_REFRESH_EXPIRES_IN) * 1000
  );
}