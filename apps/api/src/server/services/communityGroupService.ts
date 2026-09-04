/**
 * Community Group Service
 * Business logic for groups: create/update/delete, join/leave, membership,
 * and posting into a group (which reuses the normal post pipeline with a
 * groupId attached — a group post is a normal CommunityPost).
 *
 * Visibility model, kept deliberately simple: PUBLIC groups appear in
 * discovery and anyone can join directly. PRIVATE groups are hidden from
 * discovery/search and their members/posts aren't visible to non-members,
 * but there's no invite-approval workflow — anyone with the group's id/slug
 * (e.g. a shared link) can still join. Building a request-to-join queue is
 * real future work, not something this pass fakes with a half-working queue.
 */
import { communityGroupRepository, type CreateGroupInput, type UpdateGroupInput } from "../repositories/communityGroupRepository";
import type { CreatePostInput } from "../repositories/communityPostRepository";
import type { GroupRole } from "@prisma/client";

export class GroupNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("GROUP_NOT_FOUND"); }
}
export class NotGroupMemberError extends Error {
  statusCode = 403;
  constructor() { super("NOT_GROUP_MEMBER"); }
}
export class NotGroupAdminError extends Error {
  statusCode = 403;
  constructor() { super("NOT_GROUP_ADMIN"); }
}
export class OwnerCannotLeaveError extends Error {
  statusCode = 400;
  constructor() { super("OWNER_CANNOT_LEAVE"); }
}
export class AlreadyMemberError extends Error {
  statusCode = 400;
  constructor() { super("ALREADY_MEMBER"); }
}

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "group";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 0;
  while (await communityGroupRepository.findBySlug(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export const communityGroupService = {
  // ── Create ───────────────────────────────────────────────────────────────

  async createGroup(ownerId: string, input: { name: string; description: string; visibility: "PUBLIC" | "PRIVATE"; coverImageUrl?: string | null }) {
    const slug = await uniqueSlug(input.name);
    const group = await communityGroupRepository.create({
      name:          input.name,
      slug,
      description:   input.description,
      visibility:    input.visibility,
      coverImageUrl: input.coverImageUrl,
      ownerId,
    } satisfies CreateGroupInput);
    return { ...group, myRole: "OWNER" as GroupRole };
  },

  // ── Get (membership-gated for private groups) ─────────────────────────────

  async getGroup(idOrSlug: string, viewerId?: string) {
    const group =
      (await communityGroupRepository.findById(idOrSlug)) ??
      (await communityGroupRepository.findBySlug(idOrSlug));

    if (!group) throw new GroupNotFoundError();

    const membership = viewerId ? await communityGroupRepository.findMembership(group.id, viewerId) : null;
    if (group.visibility === "PRIVATE" && !membership) throw new GroupNotFoundError();

    return { ...group, myRole: membership?.role ?? null };
  },

  // ── Update / delete ────────────────────────────────────────────────────

  async updateGroup(groupId: string, actorId: string, input: UpdateGroupInput) {
    await requireAdmin(groupId, actorId);
    return communityGroupRepository.update(groupId, input);
  },

  async deleteGroup(groupId: string, actorId: string) {
    const membership = await communityGroupRepository.findMembership(groupId, actorId);
    if (!membership || membership.role !== "OWNER") throw new NotGroupAdminError();
    await communityGroupRepository.delete(groupId);
  },

  // ── Discover / my groups ───────────────────────────────────────────────

  async discoverGroups(page: number, pageSize: number, search?: string) {
    const { items, total } = await communityGroupRepository.findPublicGroups(page, pageSize, search);
    return { items, ...paginate(total, page, pageSize) };
  },

  async getMyGroups(userId: string, page: number, pageSize: number) {
    const { items, total } = await communityGroupRepository.findMyGroups(userId, page, pageSize);
    return { items, ...paginate(total, page, pageSize) };
  },

  // ── Join / leave ────────────────────────────────────────────────────────

  async joinGroup(groupId: string, userId: string) {
    const group = await communityGroupRepository.findById(groupId);
    if (!group) throw new GroupNotFoundError();

    const existing = await communityGroupRepository.findMembership(groupId, userId);
    if (existing) throw new AlreadyMemberError();

    await communityGroupRepository.addMember(groupId, userId, "MEMBER");
    return { joined: true, memberCount: await communityGroupRepository.memberCount(groupId) };
  },

  async leaveGroup(groupId: string, userId: string) {
    const membership = await communityGroupRepository.findMembership(groupId, userId);
    if (!membership) throw new NotGroupMemberError();
    if (membership.role === "OWNER") throw new OwnerCannotLeaveError();

    await communityGroupRepository.removeMember(groupId, userId);
    return { joined: false, memberCount: await communityGroupRepository.memberCount(groupId) };
  },

  // ── Members ─────────────────────────────────────────────────────────────

  async getMembers(groupId: string, page: number, pageSize: number) {
    const { items, total } = await communityGroupRepository.findMembers(groupId, page, pageSize);
    return { items, ...paginate(total, page, pageSize) };
  },

  async kickMember(groupId: string, actorId: string, targetUserId: string) {
    await requireAdmin(groupId, actorId);
    const target = await communityGroupRepository.findMembership(groupId, targetUserId);
    if (target?.role === "OWNER") throw new NotGroupAdminError();
    await communityGroupRepository.removeMember(groupId, targetUserId);
  },

  async setMemberRole(groupId: string, actorId: string, targetUserId: string, role: "ADMIN" | "MEMBER") {
    const actorMembership = await communityGroupRepository.findMembership(groupId, actorId);
    if (!actorMembership || actorMembership.role !== "OWNER") throw new NotGroupAdminError();
    return communityGroupRepository.setMemberRole(groupId, targetUserId, role);
  },

  // ── Post into a group ───────────────────────────────────────────────────

  async requireMembership(groupId: string, userId: string) {
    const membership = await communityGroupRepository.findMembership(groupId, userId);
    if (!membership) throw new NotGroupMemberError();
    return membership;
  },

  buildGroupPostInput(groupId: string, base: CreatePostInput): CreatePostInput {
    return { ...base, groupId };
  },
};

async function requireAdmin(groupId: string, userId: string) {
  const membership = await communityGroupRepository.findMembership(groupId, userId);
  if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
    throw new NotGroupAdminError();
  }
  return membership;
}
