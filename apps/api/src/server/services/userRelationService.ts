/**
 * User Relation Service — blocking and muting.
 * A block is symmetric in effect (hides posts + prevents follow/DM both
 * ways) even though only the blocker's row exists; a mute is one-directional
 * and silent (only affects the muter's own feed).
 */
import { userRelationRepository } from "../repositories/userRelationRepository";
import { communityFollowRepository } from "../repositories/communityFollowRepository";

export class CannotActOnSelfError extends Error {
  statusCode = 400;
  constructor() { super("CANNOT_ACT_ON_SELF"); }
}

export const userRelationService = {
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) throw new CannotActOnSelfError();

    await userRelationRepository.block(blockerId, blockedId);
    // A block also ends any existing follow relationship, both directions —
    // you can't block someone you still follow, or who still follows you.
    await Promise.all([
      communityFollowRepository.unfollow(blockerId, blockedId),
      communityFollowRepository.unfollow(blockedId, blockerId),
    ]);
    return { blocked: true };
  },

  async unblockUser(blockerId: string, blockedId: string) {
    await userRelationRepository.unblock(blockerId, blockedId);
    return { blocked: false };
  },

  getBlockedUsers(blockerId: string, page: number, pageSize: number) {
    return userRelationRepository.findBlockedUsers(blockerId, page, pageSize);
  },

  async muteUser(muterId: string, mutedId: string) {
    if (muterId === mutedId) throw new CannotActOnSelfError();
    await userRelationRepository.mute(muterId, mutedId);
    return { muted: true };
  },

  async unmuteUser(muterId: string, mutedId: string) {
    await userRelationRepository.unmute(muterId, mutedId);
    return { muted: false };
  },

  getMutedUsers(muterId: string, page: number, pageSize: number) {
    return userRelationRepository.findMutedUsers(muterId, page, pageSize);
  },

  /** Ids to exclude from a user's own feed: everyone they've blocked or
   *  muted, everyone who has blocked them (two-way), but not anyone who
   *  has merely muted them (mutes are silent to the muted person). */
  async getFeedExclusionIds(viewerId: string): Promise<string[]> {
    const [blocked, blockedBy, muted] = await Promise.all([
      userRelationRepository.findBlockedIds(viewerId),
      userRelationRepository.findBlockedByIds(viewerId),
      userRelationRepository.findMutedIds(viewerId),
    ]);
    return [...new Set([...blocked, ...blockedBy, ...muted])];
  },

  isBlockedEitherWay(userAId: string, userBId: string) {
    return userRelationRepository.isBlockedEitherWay(userAId, userBId);
  },
};
