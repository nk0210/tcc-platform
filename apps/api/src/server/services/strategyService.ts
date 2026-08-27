/**
 * Strategy Service
 * All business logic for the strategy marketplace: publishing, reviews, saves/playbook.
 */
import {
  strategyRepository,
  type CreateStrategyInput,
  type UpdateStrategyInput,
  type StrategyFilterParams,
  type PageParams,
} from "../repositories/strategyRepository";
import { createNotification } from "../notifications/notificationService";
import { createAuditLog }     from "../audit/auditService";

// ── Roles allowed to publish official / educational strategies ────────────

const PRIVILEGED_CREATOR_ROLES = ["ADMIN", "OWNER", "MENTOR"];

function isPrivilegedCreator(roles: string[]): boolean {
  return roles.some((r) => PRIVILEGED_CREATOR_ROLES.includes(r));
}

// ── Errors ────────────────────────────────────────────────────────────────

export class StrategyNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("STRATEGY_NOT_FOUND"); }
}
export class NotStrategyAuthorError extends Error {
  statusCode = 403;
  constructor() { super("NOT_STRATEGY_AUTHOR"); }
}
export class InvalidStrategyTypeError extends Error {
  statusCode = 403;
  constructor() { super("INVALID_STRATEGY_TYPE"); }
}
export class ReviewNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("REVIEW_NOT_FOUND"); }
}
export class NotReviewAuthorError extends Error {
  statusCode = 403;
  constructor() { super("NOT_REVIEW_AUTHOR"); }
}
export class CannotReviewOwnStrategyError extends Error {
  statusCode = 400;
  constructor() { super("CANNOT_REVIEW_OWN_STRATEGY"); }
}
export class AlreadyReviewedError extends Error {
  statusCode = 400;
  constructor() { super("ALREADY_REVIEWED"); }
}
export class StrategyNotSavedError extends Error {
  statusCode = 400;
  constructor() { super("STRATEGY_NOT_SAVED"); }
}

// ── Response formatter ────────────────────────────────────────────────────
// Collapses the viewer-filtered `savedBy` array into isSaved / isInPlaybook flags.

type RawStrategy = {
  savedBy?: { userId: string; savedToPlaybook: boolean }[];
  [key: string]: unknown;
};

function fmt(strategy: RawStrategy) {
  const { savedBy, ...rest } = strategy;
  const record = Array.isArray(savedBy) ? savedBy[0] : undefined;
  return {
    ...rest,
    isSaved:      !!record,
    isInPlaybook: record?.savedToPlaybook ?? false,
  };
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

// ── Service ───────────────────────────────────────────────────────────────

export const strategyService = {
  // ── Create ───────────────────────────────────────────────────────────────

  async createStrategy(
    authorId:     string,
    authorHandle: string,
    authorRoles:  string[],
    authorTccId:  string | null,
    input:        Omit<CreateStrategyInput, "authorId" | "authorHandle" | "authorTccId">
  ) {
    if (input.type !== "CREATOR_PUBLISHED" && !isPrivilegedCreator(authorRoles)) {
      throw new InvalidStrategyTypeError();
    }

    const strategy = await strategyRepository.create({
      ...input,
      authorId,
      authorHandle,
      authorTccId,
    });
    return fmt(strategy as RawStrategy);
  },

  // ── Get single strategy ────────────────────────────────────────────────────

  async getStrategy(strategyId: string, viewerId?: string) {
    const strategy = await strategyRepository.findById(strategyId, viewerId);
    if (!strategy) throw new StrategyNotFoundError();
    return fmt(strategy as RawStrategy);
  },

  // ── Discover feed ──────────────────────────────────────────────────────────

  async discoverStrategies(params: StrategyFilterParams, viewerId?: string) {
    const { items, total } = await strategyRepository.findAll(params, viewerId);
    return { items: items.map((s) => fmt(s as RawStrategy)), ...paginate(total, params.page, params.pageSize) };
  },

  // ── Strategies published by one author ─────────────────────────────────────

  async getUserStrategies(authorId: string, viewerId: string | undefined, params: PageParams) {
    const { items, total } = await strategyRepository.findByAuthor(authorId, params, viewerId);
    return { items: items.map((s) => fmt(s as RawStrategy)), ...paginate(total, params.page, params.pageSize) };
  },

  // ── Update (author only) ──────────────────────────────────────────────────

  async updateStrategy(strategyId: string, userId: string, isAdmin: boolean, input: UpdateStrategyInput) {
    const strategy = await strategyRepository.findById(strategyId);
    if (!strategy) throw new StrategyNotFoundError();
    if (strategy.authorId !== userId && !isAdmin) throw new NotStrategyAuthorError();

    const updated = await strategyRepository.update(strategyId, input);
    return fmt(updated as RawStrategy);
  },

  // ── Delete (author or admin) ──────────────────────────────────────────────

  async deleteStrategy(
    strategyId: string,
    userId:     string,
    isAdmin:    boolean,
    actor?:     { actorHandle: string; actorRole: string }
  ) {
    const strategy = await strategyRepository.findById(strategyId);
    if (!strategy) throw new StrategyNotFoundError();
    if (strategy.authorId !== userId && !isAdmin) throw new NotStrategyAuthorError();

    if (isAdmin && strategy.authorId !== userId && actor) {
      await createAuditLog({
        actorId:      userId,
        actorHandle:  actor.actorHandle,
        actorRole:    actor.actorRole,
        actionType:   "strategy_admin_deleted",
        targetType:   "strategy",
        targetId:     strategyId,
        targetUserId: strategy.authorId,
        description:  `Admin deleted strategy "${strategy.title}"`,
      });
    }

    await strategyRepository.delete(strategyId);
  },

  // ── Admin: feature / verify ────────────────────────────────────────────────

  async featureStrategy(strategyId: string, featured: boolean) {
    const strategy = await strategyRepository.findById(strategyId);
    if (!strategy) throw new StrategyNotFoundError();
    const updated = await strategyRepository.setFeatured(strategyId, featured);
    return fmt(updated as RawStrategy);
  },

  async verifyStrategy(strategyId: string, verified: boolean) {
    const strategy = await strategyRepository.findById(strategyId);
    if (!strategy) throw new StrategyNotFoundError();
    const updated = await strategyRepository.setVerified(
      strategyId,
      verified,
      verified ? "VERIFIED" : "UNVERIFIED"
    );
    return fmt(updated as RawStrategy);
  },

  // ── Admin: remove (moderation — audit log + notify author) ─────────────────

  async removeStrategy(
    strategyId: string,
    actor:      { actorId: string; actorHandle: string; actorRole: string },
    reason?:    string
  ) {
    const strategy = await strategyRepository.findById(strategyId);
    if (!strategy) throw new StrategyNotFoundError();

    await strategyRepository.delete(strategyId);

    await createAuditLog({
      actorId:      actor.actorId,
      actorHandle:  actor.actorHandle,
      actorRole:    actor.actorRole,
      actionType:   "strategy_removed",
      targetType:   "strategy",
      targetId:     strategyId,
      targetUserId: strategy.authorId,
      description:  `Strategy "${strategy.title}" removed by admin`,
      reason,
    });

    await createNotification({
      userId:      strategy.authorId,
      type:        "MARKETPLACE",
      priority:    "HIGH",
      title:       "Your strategy was removed",
      message:     reason ?? `Your strategy "${strategy.title}" was removed by a moderator.`,
      actionLabel: undefined,
      actionPath:  undefined,
    });
  },

  // ── Reviews ────────────────────────────────────────────────────────────────

  async addReview(strategyId: string, authorId: string, handle: string, rating: number, comment: string) {
    const strategy = await strategyRepository.findById(strategyId);
    if (!strategy) throw new StrategyNotFoundError();
    if (strategy.authorId === authorId) throw new CannotReviewOwnStrategyError();

    const existing = await strategyRepository.findReviewByAuthorAndStrategy(strategyId, authorId);
    if (existing) throw new AlreadyReviewedError();

    return strategyRepository.createReview({ strategyId, authorId, handle, rating, comment });
  },

  async editReview(reviewId: string, userId: string, input: { rating?: number; comment?: string }) {
    const review = await strategyRepository.findReviewById(reviewId);
    if (!review) throw new ReviewNotFoundError();
    if (review.authorId !== userId) throw new NotReviewAuthorError();

    return strategyRepository.updateReview(reviewId, input);
  },

  async deleteReview(
    reviewId: string,
    userId:   string,
    isAdmin:  boolean,
    actor?:   { actorHandle: string; actorRole: string }
  ) {
    const review = await strategyRepository.findReviewById(reviewId);
    if (!review) throw new ReviewNotFoundError();
    if (review.authorId !== userId && !isAdmin) throw new NotReviewAuthorError();

    if (isAdmin && review.authorId !== userId && actor) {
      await createAuditLog({
        actorId:      userId,
        actorHandle:  actor.actorHandle,
        actorRole:    actor.actorRole,
        actionType:   "strategy_review_admin_deleted",
        targetType:   "strategy_review",
        targetId:     reviewId,
        targetUserId: review.authorId,
        description:  "Admin deleted strategy review",
      });
    }

    await strategyRepository.deleteReview(reviewId);
  },

  async getReviews(strategyId: string, page: number, pageSize: number) {
    const { items, total } = await strategyRepository.findReviews(strategyId, page, pageSize);
    return { items, ...paginate(total, page, pageSize) };
  },

  // ── Save / playbook ─────────────────────────────────────────────────────

  async saveStrategy(strategyId: string, userId: string) {
    const strategy = await strategyRepository.findById(strategyId);
    if (!strategy) throw new StrategyNotFoundError();

    const already = await strategyRepository.isStrategySaved(userId, strategyId);
    if (already) {
      await strategyRepository.unsaveStrategy(userId, strategyId);
    } else {
      await strategyRepository.saveStrategy(userId, strategyId);
    }
    return { saved: !already };
  },

  async togglePlaybook(strategyId: string, userId: string) {
    try {
      const record = await strategyRepository.togglePlaybook(userId, strategyId);
      return { inPlaybook: record.savedToPlaybook };
    } catch (err) {
      if (err instanceof Error && err.message === "STRATEGY_NOT_SAVED") throw new StrategyNotSavedError();
      throw err;
    }
  },

  async getSavedStrategies(userId: string, params: PageParams) {
    const { items, total } = await strategyRepository.findSaved(userId, { ...params, playbookOnly: false });
    return { items: items.map((s) => fmt(s as RawStrategy)), ...paginate(total, params.page, params.pageSize) };
  },

  async getPlaybook(userId: string, params: PageParams) {
    const { items, total } = await strategyRepository.findSaved(userId, { ...params, playbookOnly: true });
    return { items: items.map((s) => fmt(s as RawStrategy)), ...paginate(total, params.page, params.pageSize) };
  },
};
