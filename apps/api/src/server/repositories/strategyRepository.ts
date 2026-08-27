/**
 * Strategy Repository
 * Sole Prisma layer for Strategy, StrategyReview, SavedStrategy. No business logic.
 */
import db from "../../lib/prisma";
import type {
  Prisma,
  StrategyType,
  RiskLevel,
  PricingModel,
  PerformanceStatus,
} from "@prisma/client";

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

const STRATEGY_COUNT_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  _count: { select: { reviews: true, savedBy: true } },
} as const;

// ── Viewer-aware include builder ───────────────────────────────────────────
// Returns a filtered savedBy array so the service can derive isSaved/isInPlaybook.

function buildInclude(viewerId?: string) {
  if (!viewerId) return STRATEGY_COUNT_INCLUDE;
  return {
    ...STRATEGY_COUNT_INCLUDE,
    savedBy: {
      where:  { userId: viewerId },
      select: { userId: true, savedToPlaybook: true },
    },
  } as const;
}

// ── Input types ───────────────────────────────────────────────────────────

export interface CreateStrategyInput {
  authorId:          string;
  authorHandle:      string;
  authorTccId?:      string | null;
  title:             string;
  description:       string;
  type:              StrategyType;
  asset?:            string;
  assetCategory?:    string;
  timeframe?:        string;
  riskLevel?:        RiskLevel;
  pricingModel?:     PricingModel;
  price?:            number;
  performanceStatus?: PerformanceStatus;
  winRate?:          number | null;
  profitFactor?:     number | null;
  maxDrawdown?:      number | null;
  totalTrades?:      number | null;
  avgRR?:            number | null;
  monthlyReturn?:    number | null;
  rules?:            string[];
  entryConditions?:  string[];
  exitConditions?:   string[];
  riskManagement?:   string[];
  tags?:             string[];
  version?:          string;
  disclaimer:        string;
  linkedCourseId?:   string | null;
}

export interface UpdateStrategyInput {
  title?:            string;
  description?:      string;
  asset?:            string;
  assetCategory?:    string;
  timeframe?:        string;
  riskLevel?:        RiskLevel;
  pricingModel?:     PricingModel;
  price?:            number;
  rules?:            string[];
  entryConditions?:  string[];
  exitConditions?:   string[];
  riskManagement?:   string[];
  tags?:             string[];
  version?:          string;
  disclaimer?:       string;
  linkedCourseId?:   string | null;
}

export interface StrategyFilterParams {
  page:          number;
  pageSize:      number;
  type?:         StrategyType;
  riskLevel?:    RiskLevel;
  assetCategory?: string;
  timeframe?:    string;
  tags?:         string[];
  search?:       string;
}

export interface PageParams {
  page:     number;
  pageSize: number;
}

// ── Repository ────────────────────────────────────────────────────────────

export const strategyRepository = {
  // ── Create ───────────────────────────────────────────────────────────────

  create(input: CreateStrategyInput) {
    return db.strategy.create({
      data: {
        author: { connect: { id: input.authorId } },

        title:        input.title,
        description:  input.description,
        type:         input.type,
        authorHandle: input.authorHandle,
        authorTccId:  input.authorTccId ?? null,

        asset:         input.asset         ?? "All",
        assetCategory: input.assetCategory ?? "all",
        timeframe:     input.timeframe     ?? "H1",
        riskLevel:     input.riskLevel     ?? "MEDIUM",
        pricingModel:  input.pricingModel  ?? "FREE",
        price:         input.price         ?? 0,

        performanceStatus: input.performanceStatus ?? "UNVERIFIED",
        winRate:           input.winRate       ?? null,
        profitFactor:      input.profitFactor  ?? null,
        maxDrawdown:       input.maxDrawdown    ?? null,
        totalTrades:       input.totalTrades    ?? null,
        avgRR:             input.avgRR          ?? null,
        monthlyReturn:     input.monthlyReturn  ?? null,

        rules:           input.rules           ?? [],
        entryConditions: input.entryConditions ?? [],
        exitConditions:  input.exitConditions  ?? [],
        riskManagement:  input.riskManagement  ?? [],
        tags:            input.tags            ?? [],

        version:        input.version ?? "1.0",
        disclaimer:     input.disclaimer,
        linkedCourseId: input.linkedCourseId ?? null,
      },
      include: STRATEGY_COUNT_INCLUDE,
    });
  },

  // ── Find by ID (viewer-aware) ─────────────────────────────────────────────

  findById(strategyId: string, viewerId?: string) {
    return db.strategy.findUnique({
      where:   { id: strategyId },
      include: buildInclude(viewerId),
    });
  },

  // ── Discover feed (paginated, filterable) ──────────────────────────────────

  async findAll(params: StrategyFilterParams, viewerId?: string) {
    const { page, pageSize, type, riskLevel, assetCategory, timeframe, tags, search } = params;

    const where: Prisma.StrategyWhereInput = {
      ...(type          ? { type }          : {}),
      ...(riskLevel      ? { riskLevel }      : {}),
      ...(assetCategory  ? { assetCategory }  : {}),
      ...(timeframe      ? { timeframe }      : {}),
      ...(tags && tags.length > 0 ? { tags: { hasSome: tags } } : {}),
      ...(search
        ? {
            OR: [
              { title:       { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.strategy.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildInclude(viewerId),
      }),
      db.strategy.count({ where }),
    ]);

    return { items, total };
  },

  // ── Strategies published by a specific author (paginated) ─────────────────

  async findByAuthor(authorId: string, params: PageParams, viewerId?: string) {
    const { page, pageSize } = params;
    const where: Prisma.StrategyWhereInput = { authorId };

    const [items, total] = await Promise.all([
      db.strategy.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildInclude(viewerId),
      }),
      db.strategy.count({ where }),
    ]);

    return { items, total };
  },

  // ── Saved strategies for a user (optionally playbook-only) ────────────────

  async findSaved(userId: string, params: PageParams & { playbookOnly?: boolean }) {
    const { page, pageSize, playbookOnly } = params;
    const where: Prisma.StrategyWhereInput = {
      savedBy: {
        some: {
          userId,
          ...(playbookOnly ? { savedToPlaybook: true } : {}),
        },
      },
    };

    const [items, total] = await Promise.all([
      db.strategy.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: buildInclude(userId),
      }),
      db.strategy.count({ where }),
    ]);

    return { items, total };
  },

  // ── Update ───────────────────────────────────────────────────────────────

  update(strategyId: string, input: UpdateStrategyInput) {
    return db.strategy.update({
      where: { id: strategyId },
      data: {
        ...(input.title           !== undefined ? { title:           input.title }           : {}),
        ...(input.description     !== undefined ? { description:     input.description }     : {}),
        ...(input.asset           !== undefined ? { asset:           input.asset }           : {}),
        ...(input.assetCategory   !== undefined ? { assetCategory:   input.assetCategory }   : {}),
        ...(input.timeframe       !== undefined ? { timeframe:       input.timeframe }       : {}),
        ...(input.riskLevel       !== undefined ? { riskLevel:       input.riskLevel }       : {}),
        ...(input.pricingModel    !== undefined ? { pricingModel:    input.pricingModel }    : {}),
        ...(input.price           !== undefined ? { price:           input.price }           : {}),
        ...(input.rules           !== undefined ? { rules:           input.rules }           : {}),
        ...(input.entryConditions !== undefined ? { entryConditions: input.entryConditions } : {}),
        ...(input.exitConditions  !== undefined ? { exitConditions:  input.exitConditions }  : {}),
        ...(input.riskManagement  !== undefined ? { riskManagement:  input.riskManagement }  : {}),
        ...(input.tags            !== undefined ? { tags:            input.tags }            : {}),
        ...(input.version         !== undefined ? { version:         input.version }         : {}),
        ...(input.disclaimer      !== undefined ? { disclaimer:      input.disclaimer }      : {}),
        ...(input.linkedCourseId  !== undefined ? { linkedCourseId:  input.linkedCourseId }  : {}),
      },
      include: STRATEGY_COUNT_INCLUDE,
    });
  },

  // ── Delete ───────────────────────────────────────────────────────────────

  delete(strategyId: string) {
    return db.strategy.delete({ where: { id: strategyId } });
  },

  // ── Admin: feature / verify ────────────────────────────────────────────────

  setFeatured(strategyId: string, featured: boolean) {
    return db.strategy.update({
      where: { id: strategyId },
      data:  { isFeatured: featured },
    });
  },

  setVerified(strategyId: string, verified: boolean, performanceStatus?: PerformanceStatus) {
    return db.strategy.update({
      where: { id: strategyId },
      data: {
        verified,
        ...(performanceStatus ? { performanceStatus } : {}),
      },
    });
  },

  // ── Reviews ────────────────────────────────────────────────────────────────

  createReview(data: { strategyId: string; authorId: string; handle: string; rating: number; comment: string }) {
    return db.strategyReview.create({
      data: {
        strategy: { connect: { id: data.strategyId } },
        author:   { connect: { id: data.authorId } },
        handle:   data.handle,
        rating:   data.rating,
        comment:  data.comment,
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
  },

  async findReviews(strategyId: string, page: number, pageSize: number) {
    const where = { strategyId };

    const [items, total] = await Promise.all([
      db.strategyReview.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { author: { select: AUTHOR_SELECT } },
      }),
      db.strategyReview.count({ where }),
    ]);

    return { items, total };
  },

  findReviewById(reviewId: string) {
    return db.strategyReview.findUnique({ where: { id: reviewId } });
  },

  findReviewByAuthorAndStrategy(strategyId: string, authorId: string) {
    return db.strategyReview.findFirst({ where: { strategyId, authorId } });
  },

  updateReview(reviewId: string, data: { rating?: number; comment?: string }) {
    return db.strategyReview.update({
      where: { id: reviewId },
      data: {
        ...(data.rating  !== undefined ? { rating:  data.rating }  : {}),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
      },
      include: { author: { select: AUTHOR_SELECT } },
    });
  },

  deleteReview(reviewId: string) {
    return db.strategyReview.delete({ where: { id: reviewId } });
  },

  // ── Saved / playbook ─────────────────────────────────────────────────────

  saveStrategy(userId: string, strategyId: string) {
    return db.savedStrategy.upsert({
      where:  { userId_strategyId: { userId, strategyId } },
      create: { userId, strategyId },
      update: {},
    });
  },

  unsaveStrategy(userId: string, strategyId: string) {
    return db.savedStrategy.deleteMany({ where: { userId, strategyId } });
  },

  async togglePlaybook(userId: string, strategyId: string) {
    const existing = await db.savedStrategy.findUnique({
      where: { userId_strategyId: { userId, strategyId } },
    });
    if (!existing) throw new Error("STRATEGY_NOT_SAVED");

    return db.savedStrategy.update({
      where: { userId_strategyId: { userId, strategyId } },
      data:  { savedToPlaybook: !existing.savedToPlaybook },
    });
  },

  isStrategySaved(userId: string, strategyId: string): Promise<boolean> {
    return db.savedStrategy
      .findUnique({ where: { userId_strategyId: { userId, strategyId } } })
      .then((r) => r !== null);
  },
};
