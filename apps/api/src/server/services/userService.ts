import { userRepository } from "../repositories/userRepository";
import { auditRepository } from "../repositories/auditRepository";
import { notificationRepository } from "../repositories/notificationRepository";
import type { UserRole } from "@prisma/client";

export interface ActorContext {
  actorId:     string;
  actorHandle: string;
  actorRole:   string;
}

export class UserNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("User not found"); }
}

async function getUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) throw new UserNotFoundError();
  return user;
}

async function auditAndNotify(
  actor:       ActorContext,
  actionType:  string,
  target:      { id: string; handle: string },
  description: string,
  notify:      { title: string; message: string; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" },
  reason?:     string
) {
  await Promise.all([
    auditRepository.create({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType,
      targetType:   "user",
      targetId:     target.id,
      targetUserId: target.id,
      description,
      reason,
    }),
    notificationRepository.create({
      userId:   target.id,
      type:     "ADMIN",
      priority: notify.priority,
      title:    notify.title,
      message:  notify.message,
    }),
  ]);
}

export async function suspendUser(actor: ActorContext, targetId: string, reason: string) {
  const target  = await getUser(targetId);
  const updated = await userRepository.updateStatus(targetId, "SUSPENDED", { isSuspended: true });
  await auditAndNotify(
    actor,
    "user_suspended",
    { id: targetId, handle: target.handle },
    `Suspended ${target.handle}: ${reason}`,
    { title: "Your account has been suspended", message: reason, priority: "CRITICAL" },
    reason
  );
  return updated;
}

export async function banUser(actor: ActorContext, targetId: string, reason: string) {
  const target  = await getUser(targetId);
  const updated = await userRepository.updateStatus(targetId, "BANNED", { isActive: false, isSuspended: true });
  await auditAndNotify(
    actor,
    "user_banned",
    { id: targetId, handle: target.handle },
    `Banned ${target.handle}: ${reason}`,
    { title: "Your account has been banned", message: reason, priority: "CRITICAL" },
    reason
  );
  return updated;
}

export async function reinstateUser(actor: ActorContext, targetId: string) {
  const target  = await getUser(targetId);
  const updated = await userRepository.updateStatus(targetId, "ACTIVE", { isActive: true, isSuspended: false });
  await auditAndNotify(
    actor,
    "user_reinstated",
    { id: targetId, handle: target.handle },
    `Reinstated ${target.handle}`,
    { title: "Your account has been reinstated", message: "Your access has been fully restored.", priority: "HIGH" }
  );
  return updated;
}

export async function verifyUser(actor: ActorContext, targetId: string) {
  const target  = await getUser(targetId);
  const updated = await userRepository.setVerified(targetId, true);
  await auditAndNotify(
    actor,
    "user_verified",
    { id: targetId, handle: target.handle },
    `Verified ${target.handle}`,
    { title: "You are now a Verified Trader", message: "Your account has been verified.", priority: "MEDIUM" }
  );
  return updated;
}

export async function changeUserRoles(actor: ActorContext, targetId: string, roles: string[]) {
  const target  = await getUser(targetId);
  const updated = await userRepository.updateRoles(targetId, roles as UserRole[]);
  await auditAndNotify(
    actor,
    "user_roles_changed",
    { id: targetId, handle: target.handle },
    `Changed roles for ${target.handle}: [${roles.join(", ")}]`,
    { title: "Your account roles have changed", message: `Your roles: ${roles.join(", ")}`, priority: "MEDIUM" }
  );
  return updated;
}