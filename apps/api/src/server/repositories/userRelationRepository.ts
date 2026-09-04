/**
 * User Relation Repository — blocking and muting.
 * Sole Prisma layer for UserBlock/UserMute. No business logic.
 */
import db from "../../lib/prisma";

const USER_PROFILE_SELECT = {
  id:          true,
  handle:      true,
  displayName: true,
  avatarUrl:   true,
  isVerified:  true,
} as const;

export const userRelationRepository = {
  // ── Block ───────────────────────────────────────────────────────────────

  block(blockerId: string, blockedId: string) {
    return db.userBlock.upsert({
      where:  { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
  },

  unblock(blockerId: string, blockedId: string) {
    return db.userBlock.deleteMany({ where: { blockerId, blockedId } });
  },

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const row = await db.userBlock.findUnique({
      where:  { blockerId_blockedId: { blockerId, blockedId } },
      select: { blockerId: true },
    });
    return row !== null;
  },

  /** True if either user has blocked the other — the relation that gates
   *  follow/DM/visibility, since a block is meant to work both ways even
   *  though only the blocker created the row. */
  async isBlockedEitherWay(userAId: string, userBId: string): Promise<boolean> {
    const row = await db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
      select: { blockerId: true },
    });
    return row !== null;
  },

  async findBlockedIds(blockerId: string): Promise<string[]> {
    const rows = await db.userBlock.findMany({ where: { blockerId }, select: { blockedId: true } });
    return rows.map((r) => r.blockedId);
  },

  /** Ids of everyone who has blocked `userId` — needed alongside
   *  findBlockedIds so a user's own feed also hides posts from people who
   *  blocked *them* (a block is two-way invisibility, one-way action). */
  async findBlockedByIds(blockedId: string): Promise<string[]> {
    const rows = await db.userBlock.findMany({ where: { blockedId }, select: { blockerId: true } });
    return rows.map((r) => r.blockerId);
  },

  async findBlockedUsers(blockerId: string, page: number, pageSize: number) {
    const where = { blockerId };
    const [rows, total] = await Promise.all([
      db.userBlock.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { blocked: { select: USER_PROFILE_SELECT } },
      }),
      db.userBlock.count({ where }),
    ]);
    return { items: rows.map((r) => r.blocked), total };
  },

  // ── Mute ────────────────────────────────────────────────────────────────

  mute(muterId: string, mutedId: string) {
    return db.userMute.upsert({
      where:  { muterId_mutedId: { muterId, mutedId } },
      create: { muterId, mutedId },
      update: {},
    });
  },

  unmute(muterId: string, mutedId: string) {
    return db.userMute.deleteMany({ where: { muterId, mutedId } });
  },

  async isMuted(muterId: string, mutedId: string): Promise<boolean> {
    const row = await db.userMute.findUnique({
      where:  { muterId_mutedId: { muterId, mutedId } },
      select: { muterId: true },
    });
    return row !== null;
  },

  async findMutedIds(muterId: string): Promise<string[]> {
    const rows = await db.userMute.findMany({ where: { muterId }, select: { mutedId: true } });
    return rows.map((r) => r.mutedId);
  },

  async findMutedUsers(muterId: string, page: number, pageSize: number) {
    const where = { muterId };
    const [rows, total] = await Promise.all([
      db.userMute.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { muted: { select: USER_PROFILE_SELECT } },
      }),
      db.userMute.count({ where }),
    ]);
    return { items: rows.map((r) => r.muted), total };
  },
};
