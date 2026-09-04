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

// Embedded shape for the post a repost points at — one level deep only
// (a repost of a repost is re-pointed at the ultimate original at create
// time, see communityPostService.createRepost, so this never needs to
// recurse). No viewer-specific like/save state on the embedded post itself
// — reactions always target the repost wrapper the viewer is looking at.
const REPOST_OF_INCLUDE = {
  repostOf: {
    select: {
      id: true, authorId: true, type: true, content: true, visibility: true,
      isHiddenByAdmin: true, tradeSnapshot: true, symbol: true, tags: true,
      createdAt: true,
      author: { select: AUTHOR_SELECT },
      _count: { select: { likes: true, comments: true, shares: true } },
    },
  },
} as const;

const POST_COUNT_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  _count: { select: { likes: true, comments: true, shares: true } },
  ...REPOST_OF_INCLUDE,
} as const;

// ── Viewer-aware include builder ───────────────────────────────────────────
// Returns filtered likes/savedBy arrays so the service can derive booleans.

function buildInclude(viewerId?: string) {
  if (!viewerId) return POST_COUNT_INCLUDE;
  return {
    ...POST_COUNT_INCLUDE,
    // `type` selected alongside userId so the service can derive
    // myReaction (which of the 6 reaction types, if any, this viewer has
    // on the post) without a second query — the composite PK means this
    // filtered-to-one-user include can only ever return 0 or 1 row anyway.
    likes:   { where: { userId: viewerId }, select: { userId: true, type: true } },
    savedBy: { where: { userId: viewerId }, select: { userId: true } },
    ...REPOST_OF_INCLUDE,
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
  repostOfId?:         string | null;
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
  /** Hashtag filter (without the leading #), matched against CommunityPost.tags. */
  tag?:     string;
  /** "latest" (default) = createdAt desc. "trending" = a simple, explicit
   *  heuristic (most-liked, tie-broken by most-commented, tie-broken by
   *  recency) — not a scoring column or a background job, just an
   *  alternate ORDER BY, per the "keep the feed algorithm simple" brief. */
  sort?:    "latest" | "trending";
}

function feedOrderBy(sort: FeedParams["sort"]): Prisma.CommunityPostOrderByWithRelationInput[] {
  if (sort === "trending") {
    return [{ likes: { _count: "desc" } }, { comments: { _count: "desc" } }, { createdAt: "desc" }];
  }
  return [{ createdAt: "desc" }];
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

  if (input.repostOfId) {
    data.repostOf = { connect: { id: input.repostOfId } };
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
    const { page, pageSize, type, symbol, tag, sort } = params;

    const where: Prisma.CommunityPostWhereInput = {
      visibility:     "PUBLIC",
      isHiddenByAdmin: false,
      ...(type   ? { type }   : {}),
      ...(symbol ? { symbol } : {}),
      ...(tag    ? { tags: { has: tag } } : {}),
    };

    const [items, total] = await Promise.all([
      db.communityPost.findMany({
        where,
        orderBy: feedOrderBy(sort),
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
    const { page, pageSize, type, symbol, tag, sort } = params;

    const follows = await db.follow.findMany({
      where:  { sourceId: userId, status: "ACTIVE" },
      select: { targetId: true },
    });
    const followedIds = follows.map((f) => f.targetId);

    const where: Prisma.CommunityPostWhereInput = {
      isHiddenByAdmin: false,
      ...(type   ? { type }   : {}),
      ...(symbol ? { symbol } : {}),
      ...(tag    ? { tags: { has: tag } } : {}),
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
        orderBy: feedOrderBy(sort),
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

  // ── Search ─────────────────────────────────────────────────────────────
  // Public posts only, same visibility rule as the global feed — search
  // must never surface a private/followers-only post to someone who
  // couldn't otherwise see it in a feed.

  async searchPosts(query: string, limit: number, viewerId?: string) {
    return db.communityPost.findMany({
      where: {
        content:         { contains: query, mode: "insensitive" },
        visibility:      "PUBLIC",
        isHiddenByAdmin: false,
      },
      orderBy: { createdAt: "desc" },
      take:    limit,
      include: buildInclude(viewerId),
    });
  },

  // ── Trending hashtags ─────────────────────────────────────────────────────
  // `tags` is a Postgres array column — Prisma has no groupBy over array
  // elements, so this is the one place in the community layer that uses a
  // raw query. Parameterized via Prisma's tagged-template $queryRaw (the
  // `${limit}` below is bound as a real query parameter, never string-
  // interpolated), scoped to public/non-hidden posts from the last 7 days
  // so this reflects current conversation, not the platform's all-time tag
  // history.
  /** Hashtags whose text contains `query` (case-insensitive), ranked by how
   *  many public posts currently carry them — same underlying raw query
   *  shape as findTrendingHashtags, just with a WHERE on the unnested tag. */
  async searchHashtags(query: string, limit: number): Promise<{ tag: string; count: number }[]> {
    const rows = await db.$queryRaw<{ tag: string; count: bigint }[]>`
      SELECT tag, COUNT(*) AS count FROM (
        SELECT unnest(tags) AS tag
        FROM "CommunityPost"
        WHERE "isHiddenByAdmin" = false AND visibility = 'PUBLIC'
      ) AS t
      WHERE tag ILIKE ${`%${query}%`}
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  },

  async findTrendingHashtags(limit: number): Promise<{ tag: string; count: number }[]> {
    const rows = await db.$queryRaw<{ tag: string; count: bigint }[]>`
      SELECT unnest(tags) AS tag, COUNT(*) AS count
      FROM "CommunityPost"
      WHERE "isHiddenByAdmin" = false
        AND visibility = 'PUBLIC'
        AND "createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY tag
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  },

  // ── Bookmarked (saved) posts ─────────────────────────────────────────────

  async findSavedByUser(userId: string, params: FeedParams) {
    const { page, pageSize, type } = params;

    const where: Prisma.CommunityPostWhereInput = {
      isHiddenByAdmin: false,
      savedBy:         { some: { userId } },
      ...(type ? { type } : {}),
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