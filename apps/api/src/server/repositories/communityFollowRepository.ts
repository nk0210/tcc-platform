/**
 * Community Follow Repository
 * Provides rich querying for the social graph.
 * (Simple follow/unfollow also exists in users.ts; this adds listing + detection.)
 */
import db from "../../lib/prisma";

const USER_PROFILE_SELECT = {
  id:          true,
  handle:      true,
  displayName: true,
  avatarUrl:   true,
  roles:       true,
  isVerified:  true,
  tccId:       true,
  bio:         true,
  _count: { select: { followedBy: true, following: true } },
} as const;

export const communityFollowRepository = {
  // ── Follow (upsert for idempotency) ──────────────────────────────────────

  follow(sourceId: string, targetId: string) {
    return db.follow.upsert({
      where:  { sourceId_targetId: { sourceId, targetId } },
      create: { sourceId, targetId, status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
  },

  // ── Unfollow ─────────────────────────────────────────────────────────────

  unfollow(sourceId: string, targetId: string) {
    return db.follow.deleteMany({ where: { sourceId, targetId } });
  },

  // ── Is following check ────────────────────────────────────────────────────

  async isFollowing(sourceId: string, targetId: string): Promise<boolean> {
    const row = await db.follow.findUnique({
      where: { sourceId_targetId: { sourceId, targetId } },
      select: { status: true },
    });
    return row?.status === "ACTIVE";
  },

  // ── Get followers (users who follow userId) ───────────────────────────────

  async findFollowers(userId: string, page: number, pageSize: number) {
    const where = { targetId: userId, status: "ACTIVE" as const };

    const [rows, total] = await Promise.all([
      db.follow.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { source: { select: USER_PROFILE_SELECT } },
      }),
      db.follow.count({ where }),
    ]);

    return { items: rows.map((r) => r.source), total };
  },

  // ── Get following (users that userId follows) ─────────────────────────────

  async findFollowing(userId: string, page: number, pageSize: number) {
    const where = { sourceId: userId, status: "ACTIVE" as const };

    const [rows, total] = await Promise.all([
      db.follow.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { target: { select: USER_PROFILE_SELECT } },
      }),
      db.follow.count({ where }),
    ]);

    return { items: rows.map((r) => r.target), total };
  },

  // ── Mutual follows ────────────────────────────────────────────────────────
  // Users where: I follow them AND they follow me.

  async findMutuals(userId: string, page: number, pageSize: number) {
    const where = {
      sourceId: userId,
      status:   "ACTIVE" as const,
      target: {
        following: {
          some: { targetId: userId, status: "ACTIVE" as const },
        },
      },
    };

    const [rows, total] = await Promise.all([
      db.follow.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { target: { select: USER_PROFILE_SELECT } },
      }),
      db.follow.count({ where }),
    ]);

    return { items: rows.map((r) => r.target), total };
  },

  // ── Find user by handle (for follow/unfollow by handle) ──────────────────

  findUserByHandle(handle: string) {
    return db.user.findUnique({
      where:  { handle },
      select: {
        id:           true,
        handle:       true,
        displayName:  true,
        avatarUrl:    true,
        isActive:     true,
        isSuspended:  true,
        status:       true,
        profileVisibility: true,
      },
    });
  },

  // ── Follower counts ───────────────────────────────────────────────────────

  followersCount(userId: string) {
    return db.follow.count({ where: { targetId: userId, status: "ACTIVE" } });
  },

  followingCount(userId: string) {
    return db.follow.count({ where: { sourceId: userId, status: "ACTIVE" } });
  },
};