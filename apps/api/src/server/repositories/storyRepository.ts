/**
 * Story Repository
 * Sole Prisma layer for Story/StoryView. No business logic.
 */
import db from "../../lib/prisma";

const AUTHOR_SELECT = {
  id: true, handle: true, displayName: true, avatarUrl: true, isVerified: true,
} as const;

export interface CreateStoryInput {
  authorId:  string;
  content:   string;
  imageUrl?: string | null;
  expiresAt: Date;
}

export const storyRepository = {
  create(input: CreateStoryInput) {
    return db.story.create({
      data: {
        authorId:  input.authorId,
        content:   input.content,
        imageUrl:  input.imageUrl ?? null,
        expiresAt: input.expiresAt,
      },
      include: { author: { select: AUTHOR_SELECT }, _count: { select: { views: true } } },
    });
  },

  findById(id: string) {
    return db.story.findUnique({
      where:   { id },
      include: { author: { select: AUTHOR_SELECT }, _count: { select: { views: true } } },
    });
  },

  delete(id: string) {
    return db.story.delete({ where: { id } });
  },

  // ── Active stories from the people a user follows (+ their own) ──────────
  // Grouped by author at the service layer — this just returns the flat,
  // still-active rows ordered oldest-first within each author so the
  // service can build "tap through this author's stories in order" groups.

  findActiveFromAuthors(authorIds: string[], now: Date) {
    return db.story.findMany({
      where:   { authorId: { in: authorIds }, expiresAt: { gt: now } },
      orderBy: [{ authorId: "asc" }, { createdAt: "asc" }],
      include: {
        author: { select: AUTHOR_SELECT },
        _count: { select: { views: true } },
      },
    });
  },

  findActiveByAuthor(authorId: string, now: Date) {
    return db.story.findMany({
      where:   { authorId, expiresAt: { gt: now } },
      orderBy: { createdAt: "asc" },
      include: { author: { select: AUTHOR_SELECT }, _count: { select: { views: true } } },
    });
  },

  // ── Views ────────────────────────────────────────────────────────────────

  markViewed(storyId: string, viewerId: string) {
    return db.storyView.upsert({
      where:  { storyId_viewerId: { storyId, viewerId } },
      create: { storyId, viewerId },
      update: {},
    });
  },

  hasViewed(storyId: string, viewerId: string) {
    return db.storyView
      .findUnique({ where: { storyId_viewerId: { storyId, viewerId } }, select: { viewerId: true } })
      .then((r) => r !== null);
  },

  async findViewedStoryIds(storyIds: string[], viewerId: string): Promise<Set<string>> {
    if (storyIds.length === 0) return new Set();
    const rows = await db.storyView.findMany({
      where:  { storyId: { in: storyIds }, viewerId },
      select: { storyId: true },
    });
    return new Set(rows.map((r) => r.storyId));
  },

  findViewers(storyId: string) {
    return db.storyView.findMany({
      where:   { storyId },
      orderBy: { viewedAt: "desc" },
      include: { viewer: { select: AUTHOR_SELECT } },
    });
  },
};
