/**
 * Community Post Repository
 * Sole Prisma layer for CommunityPost. No business logic.
 */
import db from "../../lib/prisma";
import type { Prisma, PostType, PostVisibility } from "@prisma/client";

// ── Author select (reused across queries) ─────────────────────────────────

const AUTHOR_SELECT = {
  id:          true,
  handle:      true,
  displayName: true,
  avatarUrl:   true,
  roles:       true,
  isVerified:  true,
  tccId:       true,
} as const;

// ── Base include (counts only — no viewer-specific data) ──────────────────

const POST_COUNT_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  _count: { select: { likes: true, comments: true, shares: true } },
} as const;

// ── Viewer-aware include builder ───────────────────────────────────────────
// Returns filtered likes/savedBy arrays so the service can derive booleans.

function buildInclude(viewerId?: string) {
  if (!viewerId) return POST_COUNT_INCLUDE;
  return {
    ...POST_COUNT_INCLUDE,
    likes:   { where: { userId: viewerId }, select: { userId: true } },
    savedBy: { where: { userId: viewerId }, select: { userId: true } },
  } as const;
}

// ── Input types ───────────────────────────────────────────────────────────

export interface CreatePostInput {
  authorId:            string;
  type:                PostType;
  content:             string;
  visibility:          PostVisibility;
  linkedTradeId?:      string | null;
  linkedStrategyId?:   string | null;
  linkedCourseId?:     string | null;
  linkedCompetitionId?: string | null;
  tradeSnapshot?:      Prisma.InputJsonValue | null;
  linkedStrategyTitle?: string | null;
  linkedCourseTitle?:  string | null;
  symbol?:             string | null;
  tags?:               string[];
}

export interface UpdatePostInput {
  content?:    string;
  visibility?: PostVisibility;
  tags?:       string[];
}

export interface FeedParams {
  page:     number;
  pageSize: number;
  type?:    PostType;
  symbol?:  string;
}

// ── Repository ────────────────────────────────────────────────────────────

export const communityPostRepository = {
  // ── Create ───────────────────────────────────────────────────────────────

  create(input: CreatePostInput) {
  const data: Prisma.CommunityPostCreateInput = {
    author: {
      connect: {
        id: input.authorId,
      },
    },

    type: input.type,
    content: input.content,
    visibility: input.visibility,

    linkedTradeId: input.linkedTradeId ?? null,
    linkedStrategyId: input.linkedStrategyId ?? null,
    linkedCourseId: input.linkedCourseId ?? null,
    linkedCompetitionId: input.linkedCompetitionId ?? null,

    linkedStrategyTitle: input.linkedStrategyTitle ?? null,
    linkedCourseTitle: input.linkedCourseTitle ?? null,

    symbol: input.symbol ?? null,
    tags: input.tags ?? [],
  };

  if (input.tradeSnapshot !== undefined) {
    data.tradeSnapshot = input.tradeSnapshot as Prisma.InputJsonValue;
  }

  return db.communityPost.create({
    data,
    include: POST_COUNT_INCLUDE,
  });
},

  // ── Find by ID (viewer-aware) ─────────────────────────────────────────────

  findById(postId: string, viewerId?: string) {
    return db.communityPost.findUnique({
      where:   { id: postId },
      include: buildInclude(viewerId),
    });
  },

  // ── Update ───────────────────────────────────────────────────────────────

  update(postId: string, input: UpdatePostInput) {
    return db.communityPost.update({
      where: { id: postId },
      data: {
        ...(input.content    !== undefined ? { content:    input.content    } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.tags       !== undefined ? { tags:       input.tags       } : {}),
      },
      include: POST_COUNT_INCLUDE,
    });
  },

  // ── Delete ───────────────────────────────────────────────────────────────

  delete(postId: string) {
    return db.communityPost.delete({ where: { id: postId } });
  },

  // ── Admin: set hidden ─────────────────────────────────────────────────────

  setHidden(postId: string, hidden: boolean) {
    return db.communityPost.update({
      where: { id: postId },
      data:  { isHiddenByAdmin: hidden },
    });
  },

  // ── Global feed (public posts only) ──────────────────────────────────────

  async findGlobalFeed(params: FeedParams, viewerId?: string) {
    const { page, pageSize, type, symbol } = params;

    const where: Prisma.CommunityPostWhereInput = {
      visibility:     "PUBLIC",
      isHiddenByAdmin: false,
      ...(type   ? { type }   : {}),
      ...(symbol ? { symbol } : {}),
    };

    const [items, total] = await Promise.all([
      db.communityPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildInclude(viewerId),
      }),
      db.communityPost.count({ where }),
    ]);

    return { items, total };
  },

  // ── Following feed ────────────────────────────────────────────────────────

  async findFollowingFeed(userId: string, params: FeedParams) {
    const { page, pageSize, type, symbol } = params;

    const follows = await db.follow.findMany({
      where:  { sourceId: userId, status: "ACTIVE" },
      select: { targetId: true },
    });
    const followedIds = follows.map((f) => f.targetId);

    const where: Prisma.CommunityPostWhereInput = {
      isHiddenByAdmin: false,
      ...(type   ? { type }   : {}),
      ...(symbol ? { symbol } : {}),
      OR: [
        // Own posts: all visibilities
        { authorId: userId },
        // Followed users: public and followers-only
        {
          authorId:   { in: followedIds },
          visibility: { in: ["PUBLIC", "FOLLOWERS_ONLY"] },
        },
      ],
    };

    const [items, total] = await Promise.all([
      db.communityPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildInclude(userId),
      }),
      db.communityPost.count({ where }),
    ]);

    return { items, total };
  },

  // ── User profile feed ─────────────────────────────────────────────────────

  async findByAuthor(
    authorId:    string,
    viewerId:    string | undefined,
    isSelf:      boolean,
    isFollowing: boolean,
    params:      FeedParams
  ) {
    const { page, pageSize, type } = params;

    const visibilityFilter: Prisma.CommunityPostWhereInput["visibility"] = isSelf
      ? undefined
      : isFollowing
      ? { in: ["PUBLIC", "FOLLOWERS_ONLY"] }
      : "PUBLIC";

    const where: Prisma.CommunityPostWhereInput = {
      authorId,
      isHiddenByAdmin: false,
      ...(visibilityFilter ? { visibility: visibilityFilter } : {}),
      ...(type ? { type } : {}),
    };

    const [items, total] = await Promise.all([
      db.communityPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildInclude(viewerId),
      }),
      db.communityPost.count({ where }),
    ]);

    return { items, total };
  },

  // ── Bookmarked (saved) posts ─────────────────────────────────────────────

  async findSavedByUser(userId: string, params: FeedParams) {
    const { page, pageSize } = params;

    const where: Prisma.CommunityPostWhereInput = {
      isHiddenByAdmin: false,
      savedBy:         { some: { userId } },
    };

    const [items, total] = await Promise.all([
      db.communityPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildInclude(userId),
      }),
      db.communityPost.count({ where }),
    ]);

    return { items, total };
  },
};