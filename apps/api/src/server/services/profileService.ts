/**
 * Profile Service
 * All business logic for public/own profiles: visibility gating, completeness
 * scoring, search, and follow-suggestions.
 */
import {
  profileRepository,
  type UpdateProfileInput,
  type UpdateSocialLinksInput,
  type UpdateTradingIdentityInput,
  type PageParams,
} from "../repositories/profileRepository";
import { communityFollowRepository } from "../repositories/communityFollowRepository";
import { getEffectivePermissions }   from "../permissions/permissionService";

// ── Errors ────────────────────────────────────────────────────────────────

export class ProfileNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("PROFILE_NOT_FOUND"); }
}
export class StatsHiddenError extends Error {
  statusCode = 403;
  constructor() { super("STATS_HIDDEN"); }
}

// ── Pagination helper ─────────────────────────────────────────────────────

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ── Limited (visibility-denied) profile shape ──────────────────────────────

type FullProfile = NonNullable<Awaited<ReturnType<typeof profileRepository.findByHandle>>>;

function limitedProfile(profile: FullProfile) {
  return {
    id:          profile.id,
    handle:      profile.handle,
    displayName: profile.displayName,
    avatarUrl:   profile.avatarUrl,
    isPrivate:   true as const,
  };
}

// ── Service ───────────────────────────────────────────────────────────────

export const profileService = {
  // ── Public profile (visibility-gated) ──────────────────────────────────

  async getPublicProfile(handle: string, viewerId?: string) {
    const profile = await profileRepository.findByHandle(handle);
    if (!profile || !profile.isActive) throw new ProfileNotFoundError();

    const isSelf = viewerId === profile.id;
    if (isSelf || profile.profileVisibility === "PUBLIC") return profile;

    if (profile.profileVisibility === "FOLLOWERS_ONLY") {
      const isFollowing = viewerId ? await communityFollowRepository.isFollowing(viewerId, profile.id) : false;
      if (isFollowing) return profile;
    }

    return limitedProfile(profile);
  },

  // ── Own profile (includes private fields) ──────────────────────────────

  async getOwnProfile(userId: string) {
    const profile = await profileRepository.findById(userId);
    if (!profile) throw new ProfileNotFoundError();

    const permissions = await getEffectivePermissions(profile.roles);
    return { ...profile, permissions };
  },

  // ── Updates (own profile only — callers always pass authReq.userId) ───────

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return profileRepository.updateProfile(userId, input);
  },

  async updateSocialLinks(userId: string, input: UpdateSocialLinksInput) {
    return profileRepository.updateSocialLinks(userId, input);
  },

  async updateTradingIdentity(userId: string, input: UpdateTradingIdentityInput) {
    return profileRepository.updateTradingIdentity(userId, input);
  },

  // ── Trading stats ─────────────────────────────────────────────────────

  async getTradingStats(userId: string) {
    return profileRepository.getTradingStats(userId);
  },

  async getTradingStatsForHandle(handle: string, viewerId?: string) {
    const profile = await profileRepository.findByHandle(handle);
    if (!profile || !profile.isActive) throw new ProfileNotFoundError();

    const isSelf = viewerId === profile.id;
    if (!isSelf && profile.portfolioVisibility !== "PUBLIC") {
      const isFollowing =
        profile.portfolioVisibility === "FOLLOWERS_ONLY" && viewerId
          ? await communityFollowRepository.isFollowing(viewerId, profile.id)
          : false;
      if (!isFollowing) throw new StatsHiddenError();
    }

    return profileRepository.getTradingStats(profile.id);
  },

  // ── Completeness ───────────────────────────────────────────────────────

  async getProfileCompleteness(userId: string) {
    const profile = await profileRepository.findById(userId);
    if (!profile) throw new ProfileNotFoundError();

    const checks: { field: string; filled: boolean }[] = [
      { field: "displayName",     filled: !!profile.displayName },
      { field: "bio",             filled: !!profile.bio },
      { field: "location",        filled: !!profile.location },
      { field: "avatarUrl",       filled: !!profile.avatarUrl },
      { field: "experienceLevel", filled: !!profile.experienceLevel },
      {
        field: "socialLinks",
        filled: !!profile.socialLinks && [
          profile.socialLinks.website,
          profile.socialLinks.x,
          profile.socialLinks.linkedin,
          profile.socialLinks.youtube,
          profile.socialLinks.instagram,
        ].some(Boolean),
      },
      {
        field: "tradingIdentity",
        filled: !!profile.tradingIdentity && [
          profile.tradingIdentity.marketsTraded,
          profile.tradingIdentity.symbolsTraded,
          profile.tradingIdentity.strategiesUsed,
          profile.tradingIdentity.preferredSessions,
        ].some((arr) => arr.length > 0),
      },
    ];

    const filledCount    = checks.filter((c) => c.filled).length;
    const percentage     = Math.round((filledCount / checks.length) * 100);
    const missingFields  = checks.filter((c) => !c.filled).map((c) => c.field);

    return { percentage, missingFields };
  },

  // ── Search / suggestions ──────────────────────────────────────────────

  async searchUsers(query: string, params: PageParams) {
    const { items, total } = await profileRepository.searchUsers(query, params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },

  async getSuggestedUsers(userId: string, params: PageParams) {
    const { items, total } = await profileRepository.findSuggested(userId, params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },
};
