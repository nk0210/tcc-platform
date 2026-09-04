/**
 * Community Search Service
 * Aggregates people, posts, and hashtags for one search query. No new
 * repository architecture — reuses communityPostRepository/
 * communityFollowRepository's existing patterns (same visibility rules as
 * the feed, same author/user select shapes) plus the reaction-aware
 * fmt() communityFeedService.ts already exports.
 */
import { communityPostRepository }   from "../repositories/communityPostRepository";
import { communityFollowRepository } from "../repositories/communityFollowRepository";
import { fmt, type RawPost } from "./communityFeedService";

const MIN_QUERY_LENGTH = 1;
const DEFAULT_LIMIT = 8;

export const communitySearchService = {
  async search(query: string, viewerId?: string, limit = DEFAULT_LIMIT) {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      return { people: [], posts: [], hashtags: [] };
    }

    // Hashtag search takes the query with or without a leading # equally —
    // most people will type "#gold" out of habit even though the stored
    // tag itself never has the leading character.
    const tagQuery = q.startsWith("#") ? q.slice(1) : q;

    const [people, rawPosts, hashtags] = await Promise.all([
      communityFollowRepository.searchUsers(q, limit),
      communityPostRepository.searchPosts(q, limit, viewerId),
      communityPostRepository.searchHashtags(tagQuery, limit),
    ]);

    return {
      people,
      posts: rawPosts.map((p) => fmt(p as RawPost)),
      hashtags,
    };
  },
};
