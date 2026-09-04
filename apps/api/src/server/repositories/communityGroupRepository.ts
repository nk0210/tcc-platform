/**
 * Community Group Repository
 * Sole Prisma layer for CommunityGroup/GroupMember. No business logic.
 */
import db from "../../lib/prisma";
import type { Prisma, GroupVisibility, GroupRole } from "@prisma/client";

const AUTHOR_SELECT = {
  id: true, handle: true, displayName: true, avatarUrl: true, isVerified: true,
} as const;

const GROUP_INCLUDE = {
  owner:  { select: AUTHOR_SELECT },
  _count: { select: { members: true, posts: true } },
} as const;

export interface CreateGroupInput {
  name:          string;
  slug:          string;
  description:   string;
  visibility:    GroupVisibility;
  coverImageUrl?: string | null;
  ownerId:       string;
}

export interface UpdateGroupInput {
  name?:          string;
  description?:   string;
  visibility?:    GroupVisibility;
  coverImageUrl?: string | null;
}

export const communityGroupRepository = {
  async create(input: CreateGroupInput) {
    const group = await db.communityGroup.create({
      data: {
        name:          input.name,
        slug:          input.slug,
        description:   input.description,
        visibility:    input.visibility,
        coverImageUrl: input.coverImageUrl ?? null,
        owner:         { connect: { id: input.ownerId } },
        members:       { create: { userId: input.ownerId, role: "OWNER" } },
      },
      include: GROUP_INCLUDE,
    });
    return group;
  },

  findById(id: string) {
    return db.communityGroup.findUnique({ where: { id }, include: GROUP_INCLUDE });
  },

  findBySlug(slug: string) {
    return db.communityGroup.findUnique({ where: { slug }, include: GROUP_INCLUDE });
  },

  update(id: string, input: UpdateGroupInput) {
    return db.communityGroup.update({
      where: { id },
      data: {
        ...(input.name          !== undefined ? { name: input.name }                   : {}),
        ...(input.description   !== undefined ? { description: input.description }     : {}),
        ...(input.visibility    !== undefined ? { visibility: input.visibility }        : {}),
        ...(input.coverImageUrl !== undefined ? { coverImageUrl: input.coverImageUrl }  : {}),
      },
      include: GROUP_INCLUDE,
    });
  },

  delete(id: string) {
    return db.communityGroup.delete({ where: { id } });
  },

  // ── Discover (public groups, searchable) ───────────────────────────────

  async findPublicGroups(page: number, pageSize: number, search?: string) {
    const where: Prisma.CommunityGroupWhereInput = {
      visibility: "PUBLIC",
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      db.communityGroup.findMany({
        where,
        orderBy: { members: { _count: "desc" } },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: GROUP_INCLUDE,
      }),
      db.communityGroup.count({ where }),
    ]);
    return { items, total };
  },

  // ── My groups ────────────────────────────────────────────────────────────

  async findMyGroups(userId: string, page: number, pageSize: number) {
    const where: Prisma.GroupMemberWhereInput = { userId };
    const [rows, total] = await Promise.all([
      db.groupMember.findMany({
        where,
        orderBy: { joinedAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { group: { include: GROUP_INCLUDE } },
      }),
      db.groupMember.count({ where }),
    ]);
    return { items: rows.map((r) => ({ ...r.group, myRole: r.role })), total };
  },

  // ── Membership ───────────────────────────────────────────────────────────

  addMember(groupId: string, userId: string, role: GroupRole = "MEMBER") {
    return db.groupMember.upsert({
      where:  { groupId_userId: { groupId, userId } },
      create: { groupId, userId, role },
      update: {},
    });
  },

  removeMember(groupId: string, userId: string) {
    return db.groupMember.deleteMany({ where: { groupId, userId } });
  },

  findMembership(groupId: string, userId: string) {
    return db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  },

  async findMembers(groupId: string, page: number, pageSize: number) {
    const where = { groupId };
    const [rows, total] = await Promise.all([
      db.groupMember.findMany({
        where,
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { user: { select: AUTHOR_SELECT } },
      }),
      db.groupMember.count({ where }),
    ]);
    return { items: rows.map((r) => ({ ...r.user, role: r.role, joinedAt: r.joinedAt })), total };
  },

  setMemberRole(groupId: string, userId: string, role: GroupRole) {
    return db.groupMember.update({ where: { groupId_userId: { groupId, userId } }, data: { role } });
  },

  memberCount(groupId: string) {
    return db.groupMember.count({ where: { groupId } });
  },
};
