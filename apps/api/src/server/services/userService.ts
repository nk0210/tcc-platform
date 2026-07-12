/**
 * TCC User Service — business logic for admin user-management actions.
 *
 * Each function here demonstrates the intended Alpha pattern:
 *   1. Validate via repository
 *   2. Apply the state change via repository
 *   3. Write an audit log entry via auditService
 *   4. Notify the affected user via notificationService
 *   5. Return the updated record
 *
 * Routes call these — never repositories or Prisma directly.
 */
import { userRepository } from "../repositories/userRepository";
import { createAuditLog } from "../audit/auditService";
import { createNotification } from "../notifications/notificationService";
import type { UserRole } from "@tcc/db";

export interface ActorContext {
  actorId:     string;
  actorHandle: string;
  actorRole:   string;
}

export class UserNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("User not found"); }
}

async function requireUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) throw new UserNotFoundError();
  return user;
}

export async function suspendUser(actor: ActorContext, targetUserId: string, reason: string) {
  const target = await requireUser(targetUserId);

  const updated = await userRepository.updateStatus(targetUserId, "SUSPENDED", {
    isSuspended: true,
  });

  await createAuditLog({
    actorId:      actor.actorId,
    actorHandle:  actor.actorHandle,
    actorRole:    actor.actorRole,
    actionType:   "user_suspended",
    targetType:   "user",
    targetId:     targetUserId,
    targetUserId,
    description:  `Suspended ${target.handle}: ${reason}`,
    reason,
  });

  await createNotification({
    userId:  targetUserId,
    type:    "ADMIN",
    priority: "CRITICAL",
    title:   "Your account has been suspended",
    message: reason,
  });

  return updated;
}

export async function banUser(actor: ActorContext, targetUserId: string, reason: string) {
  const target = await requireUser(targetUserId);

  const updated = await userRepository.updateStatus(targetUserId, "BANNED", {
    isActive: false,
    isSuspended: true,
  });

  await createAuditLog({
    actorId:     actor.actorId,
    actorHandle: actor.actorHandle,
    actorRole:   actor.actorRole,
    actionType:  "user_banned",
    targetType:  "user",
    targetId:    targetUserId,
    targetUserId,
    description: `Banned ${target.handle}: ${reason}`,
    reason,
  });

  await createNotification({
    userId:  targetUserId,
    type:    "ADMIN",
    priority: "CRITICAL",
    title:   "Your account has been banned",
    message: reason,
  });

  return updated;
}

export async function reinstateUser(actor: ActorContext, targetUserId: string) {
  const target = await requireUser(targetUserId);

  const updated = await userRepository.updateStatus(targetUserId, "ACTIVE", {
    isActive: true,
    isSuspended: false,
  });

  await createAuditLog({
    actorId:     actor.actorId,
    actorHandle: actor.actorHandle,
    actorRole:   actor.actorRole,
    actionType:  "user_reinstated",
    targetType:  "user",
    targetId:    targetUserId,
    targetUserId,
    description: `Reinstated ${target.handle}`,
  });

  await createNotification({
    userId:  targetUserId,
    type:    "ADMIN",
    priority: "HIGH",
    title:   "Your account has been reinstated",
    message: "Your account access has been fully restored.",
  });

  return updated;
}

export async function verifyUser(actor: ActorContext, targetUserId: string) {
  const target = await requireUser(targetUserId);
  const updated = await userRepository.setVerified(targetUserId, true);

  await createAuditLog({
    actorId:     actor.actorId,
    actorHandle: actor.actorHandle,
    actorRole:   actor.actorRole,
    actionType:  "user_verified",
    targetType:  "user",
    targetId:    targetUserId,
    targetUserId,
    description: `Verified ${target.handle} as a verified trader`,
  });

  await createNotification({
    userId:  targetUserId,
    type:    "ADMIN",
    priority: "MEDIUM",
    title:   "You are now a Verified Trader",
    message: "Your account has been marked as verified.",
  });

  return updated;
}

export async function changeUserRoles(actor: ActorContext, targetUserId: string, roles: UserRole[]) {
  const target = await requireUser(targetUserId);
  const updated = await userRepository.updateRoles(targetUserId, roles);

  await createAuditLog({
    actorId:     actor.actorId,
    actorHandle: actor.actorHandle,
    actorRole:   actor.actorRole,
    actionType:  "user_roles_changed",
    targetType:  "user",
    targetId:    targetUserId,
    targetUserId,
    description: `Changed roles for ${target.handle}: [${roles.join(", ")}]`,
    metadata:    { previousRoles: target.roles, newRoles: roles },
  });

  await createNotification({
    userId:  targetUserId,
    type:    "ADMIN",
    priority: "MEDIUM",
    title:   "Your account roles have changed",
    message: `Your roles are now: ${roles.join(", ")}`,
  });

  return updated;
}