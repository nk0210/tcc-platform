/**
 * Story Service
 * 24h-ephemeral updates. No background expiry job — "active" is always a
 * plain `expiresAt > now()` filter at read time, so an expired story simply
 * stops appearing without needing to be cleaned up (it's deleted lazily,
 * never — Postgres just never returns it again; a periodic cleanup job for
 * the dead rows would be a real operational nice-to-have but isn't required
 * for correctness here).
 */
import { storyRepository } from "../repositories/storyRepository";
import { communityFollowRepository } from "../repositories/communityFollowRepository";
import { userRelationService } from "./userRelationService";

const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;

export class StoryNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("STORY_NOT_FOUND"); }
}
export class NotStoryAuthorError extends Error {
  statusCode = 403;
  constructor() { super("NOT_STORY_AUTHOR"); }
}

export const storyService = {
  async createStory(authorId: string, input: { content: string; imageUrl?: string | null }) {
    return storyRepository.create({
      authorId,
      content:   input.content,
      imageUrl:  input.imageUrl,
      expiresAt: new Date(Date.now() + STORY_LIFETIME_MS),
    });
  },

  async deleteStory(storyId: string, userId: string) {
    const story = await storyRepository.findById(storyId);
    if (!story) throw new StoryNotFoundError();
    if (story.authorId !== userId) throw new NotStoryAuthorError();
    await storyRepository.delete(storyId);
  },

  // ── Feed: grouped by author, own stories first, then follows ─────────────

  async getStoryFeed(userId: string) {
    const following = await communityFollowRepository.findFollowing(userId, 1, 500);
    const excludeIds = await userRelationService.getFeedExclusionIds(userId);
    const authorIds = [userId, ...following.items.map((u) => u.id)].filter((id) => !excludeIds.includes(id));

    const rows = await storyRepository.findActiveFromAuthors(authorIds, new Date());
    const viewedIds = await storyRepository.findViewedStoryIds(rows.map((r) => r.id), userId);

    const byAuthor = new Map<string, { author: (typeof rows)[number]["author"]; stories: typeof rows; allViewed: boolean }>();
    for (const row of rows) {
      const entry = byAuthor.get(row.authorId) ?? { author: row.author, stories: [], allViewed: true };
      entry.stories.push(row);
      byAuthor.set(row.authorId, entry);
    }
    for (const entry of byAuthor.values()) {
      entry.allViewed = entry.stories.every((s) => viewedIds.has(s.id));
    }

    return Array.from(byAuthor.values()).map((entry) => ({
      author:    entry.author,
      allViewed: entry.allViewed,
      stories:   entry.stories.map((s) => ({ ...s, viewed: viewedIds.has(s.id) })),
    }));
  },

  async getMyStories(userId: string) {
    return storyRepository.findActiveByAuthor(userId, new Date());
  },

  async viewStory(storyId: string, viewerId: string) {
    const story = await storyRepository.findById(storyId);
    if (!story) throw new StoryNotFoundError();
    if (story.authorId === viewerId) return { viewed: true };
    await storyRepository.markViewed(storyId, viewerId);
    return { viewed: true };
  },

  async getViewers(storyId: string, requesterId: string) {
    const story = await storyRepository.findById(storyId);
    if (!story) throw new StoryNotFoundError();
    if (story.authorId !== requesterId) throw new NotStoryAuthorError();
    const rows = await storyRepository.findViewers(storyId);
    return rows.map((r) => ({ ...r.viewer, viewedAt: r.viewedAt }));
  },
};
