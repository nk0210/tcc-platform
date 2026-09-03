/**
 * Community Follow Service
 * Business logic for the social graph.
 */
import { communityFollowRepository } from "../repositories/communityFollowRepository";
import { createNotification }        from "../notifications/notificationService";

// ── Errors ────────────────────────────────────────────────────────────────

export class UserNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("USER_NOT_FOUND"); }
}
export class CannotFollowSelfError extends Error {
  statusCode = 400;
  constructor() { super("CANNOT_FOLLOW_SELF"); }
}
export class PrivateProfileError extends Error {
  statusCode = 403;
  constructor() { super("PROFILE_IS_PRIVATE"); }
}

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return { total, page, pageSize, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

// ── Service ───────────────────────────────────────────────────────────────

export const communityFollowService = {
  // ── Follow user by handle ─────────────────────────────────────────────────

  async followUser(followerId: string, targetHandle: string) {
    const target = await communityFollowRepository.findUserByHandle(targetHandle);

    if (!target || !target.isActive || target.status === "BANNED") throw new UserNotFoundError();
    if (target.id === followerId) throw new CannotFollowSelfError();
    // A PRIVATE profile (profileService.getPublicProfile's strictest tier —
    // visible to no one but the owner, unlike FOLLOWERS_ONLY which is
    // reachable by following first) was never actually enforced here even
    // though this exact error class already existed and the REST route
    // already handled it (routes/community/follow.ts) — dead code until
    // now. This closes that gap rather than leaving it reachable through
    // any caller, Copilot included.
    if (target.profileVisibility === "PRIVATE") throw new PrivateProfileError();

    await communityFollowRepository.follow(followerId, target.id);

    // Notify the followed user
    await createNotification({
      userId:      target.id,
      type:        "COMMUNITY",
      priority:    "LOW",
      title:       "New follower",
      message:     "Someone started following you.",
      actionLabel: "View Profile",
      actionPath:  `/profile`,
    });

    const [followerCount, followingCount] = await Promise.all([
      communityFollowRepository.followersCount(target.id),
      communityFollowRepository.followingCount(target.id),
    ]);

    return {
      targetId:      target.id,
      targetHandle:  target.handle,
      following:     true,
      followerCount,
      followingCount,
    };
  },

  // ── Unfollow user by handle ───────────────────────────────────────────────

  async unfollowUser(followerId: string, targetHandle: string) {
    const target = await communityFollowRepository.findUserByHandle(targetHandle);
    if (!target) throw new UserNotFoundError();
    if (target.id === followerId) throw new CannotFollowSelfError();

    await communityFollowRepository.unfollow(followerId, target.id);

    return { targetId: target.id, targetHandle: target.handle, following: false };
  },

  // ── Check follow status ───────────────────────────────────────────────────

  async getFollowStatus(followerId: string, targetHandle: string) {
    const target = await communityFollowRepository.findUserByHandle(targetHandle);
    if (!target) throw new UserNotFoundError();

    const [isFollowing, isFollowedBy, followerCount, followingCount] = await Promise.all([
      communityFollowRepository.isFollowing(followerId, target.id),
      communityFollowRepository.isFollowing(target.id, followerId),
      communityFollowRepository.followersCount(target.id),
      communityFollowRepository.followingCount(target.id),
    ]);

    return {
      targetId:         target.id,
      targetHandle:     target.handle,
      isFollowing,
      isFollowedBy,
      isMutual:         isFollowing && isFollowedBy,
      followerCount,
      followingCount,
    };
  },

  // ── Get followers ─────────────────────────────────────────────────────────

  async getFollowers(userId: string, page: number, pageSize: number) {
    const { items, total } = await communityFollowRepository.findFollowers(userId, page, pageSize);
    return { items, ...paginate(total, page, pageSize) };
  },

  // ── Get following ─────────────────────────────────────────────────────────

  async getFollowing(userId: string, page: number, pageSize: number) {
    const { items, total } = await communityFollowRepository.findFollowing(userId, page, pageSize);
    return { items, ...paginate(total, page, pageSize) };
  },

  // ── Get mutual follows ────────────────────────────────────────────────────

  async getMutuals(userId: string, page: number, pageSize: number) {
    const { items, total } = await communityFollowRepository.findMutuals(userId, page, pageSize);
    return { items, ...paginate(total, page, pageSize) };
  },
};