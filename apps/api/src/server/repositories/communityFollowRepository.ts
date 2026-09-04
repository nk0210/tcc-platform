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

  // ── Search ─────────────────────────────────────────────────────────────

  searchUsers(query: string, limit: number) {
    return db.user.findMany({
      where: {
        isActive: true,
        status:   "ACTIVE",
        OR: [
          { handle:      { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
      orderBy: { followedBy: { _count: "desc" } },
      take:    limit,
      select:  USER_PROFILE_SELECT,
    });
  },

  // ── Suggestions ("People you may know") ───────────────────────────────────
  // Deliberately simple, real-data-only heuristic: active users the viewer
  // doesn't already follow (and isn't themselves), ranked by follower count.
  // No mutual-follow/interest-graph scoring — that's real future work, not
  // something to fake with placeholder numbers now.

  async findSuggestions(userId: string, limit: number) {
    const alreadyFollowed = await db.follow.findMany({
      where:  { sourceId: userId, status: "ACTIVE" },
      select: { targetId: true },
    });
    const excludeIds = [userId, ...alreadyFollowed.map((f) => f.targetId)];

    return db.user.findMany({
      where: { id: { notIn: excludeIds }, isActive: true, status: "ACTIVE" },
      orderBy: { followedBy: { _count: "desc" } },
      take: limit,
      select: USER_PROFILE_SELECT,
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