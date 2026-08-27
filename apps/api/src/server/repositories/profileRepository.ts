/**
 * Profile Repository
 * Sole Prisma layer for public/own user profiles, social links, and trading
 * identity. No business logic — visibility gating and completeness scoring
 * live in profileService.
 */
import db from "../../lib/prisma";
import type { Visibility, ExperienceLevel, Prisma } from "@prisma/client";

// ── Select shapes ─────────────────────────────────────────────────────────
// select (not include) so passwordHash never leaves the repository.

const PROFILE_SELECT = {
  id:                  true,
  tccId:               true,
  handle:              true,
  displayName:         true,
  bio:                 true,
  location:            true,
  avatarUrl:           true,
  roles:               true,
  status:              true,
  isVerified:          true,
  profileVisibility:   true,
  portfolioVisibility: true,
  experienceLevel:     true,
  isActive:            true,
  createdAt:           true,
  updatedAt:           true,
  socialLinks:         true,
  tradingIdentity:     true,
  _count: { select: { followedBy: true, following: true, posts: true, strategies: true } },
} as const;

const OWN_PROFILE_SELECT = {
  ...PROFILE_SELECT,
  email: true,
} as const;

const SEARCH_SELECT = {
  id:          true,
  handle:      true,
  displayName: true,
  avatarUrl:   true,
  bio:         true,
  roles:       true,
  isVerified:  true,
  _count: { select: { followedBy: true } },
} as const;

// ── Input types ───────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  displayName?:         string;
  bio?:                 string;
  location?:            string;
  avatarUrl?:           string | null;
  profileVisibility?:   Visibility;
  portfolioVisibility?: Visibility;
  experienceLevel?:     ExperienceLevel | null;
}

export interface UpdateSocialLinksInput {
  website?:   string | null;
  x?:         string | null;
  linkedin?:  string | null;
  youtube?:   string | null;
  instagram?: string | null;
}

export interface UpdateTradingIdentityInput {
  marketsTraded?:     string[];
  symbolsTraded?:     string[];
  strategiesUsed?:    string[];
  preferredSessions?: string[];
}

export interface PageParams {
  page:     number;
  pageSize: number;
}

// ── Repository ────────────────────────────────────────────────────────────

export const profileRepository = {
  findByHandle(handle: string) {
    return db.user.findUnique({ where: { handle }, select: PROFILE_SELECT });
  },

  findById(id: string) {
    return db.user.findUnique({ where: { id }, select: OWN_PROFILE_SELECT });
  },

  updateProfile(userId: string, input: UpdateProfileInput) {
    return db.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName         !== undefined ? { displayName:         input.displayName }         : {}),
        ...(input.bio                 !== undefined ? { bio:                 input.bio }                 : {}),
        ...(input.location            !== undefined ? { location:            input.location }            : {}),
        ...(input.avatarUrl           !== undefined ? { avatarUrl:           input.avatarUrl }            : {}),
        ...(input.profileVisibility   !== undefined ? { profileVisibility:   input.profileVisibility }    : {}),
        ...(input.portfolioVisibility !== undefined ? { portfolioVisibility: input.portfolioVisibility }  : {}),
        ...(input.experienceLevel     !== undefined ? { experienceLevel:     input.experienceLevel }      : {}),
      },
      select: OWN_PROFILE_SELECT,
    });
  },

  updateSocialLinks(userId: string, input: UpdateSocialLinksInput) {
    return db.userSocialLinks.upsert({
      where:  { userId },
      create: { userId, ...input },
      update: { ...input },
    });
  },

  updateTradingIdentity(userId: string, input: UpdateTradingIdentityInput) {
    return db.userTradingIdentity.upsert({
      where: { userId },
      create: {
        userId,
        marketsTraded:     input.marketsTraded     ?? [],
        symbolsTraded:     input.symbolsTraded     ?? [],
        strategiesUsed:    input.strategiesUsed    ?? [],
        preferredSessions: input.preferredSessions ?? [],
      },
      update: { ...input },
    });
  },

  async getTradingStats(userId: string) {
    const [totalTrades, closedTrades, openTrades, pnlAgg] = await Promise.all([
      db.trade.count({ where: { userId } }),
      db.trade.count({ where: { userId, isOpen: false } }),
      db.trade.count({ where: { userId, isOpen: true } }),
      db.trade.aggregate({ where: { userId, isOpen: false }, _sum: { netPnl: true } }),
    ]);
    return { totalTrades, closedTrades, openTrades, totalNetPnl: pnlAgg._sum.netPnl ?? 0 };
  },

  async searchUsers(query: string, params: PageParams) {
    const { page, pageSize } = params;
    const where: Prisma.UserWhereInput = {
      isActive:          true,
      profileVisibility: "PUBLIC",
      OR: [
        { handle:      { contains: query, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
      ],
    };

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select:  SEARCH_SELECT,
      }),
      db.user.count({ where }),
    ]);

    return { items, total };
  },

  async findSuggested(userId: string, params: PageParams) {
    const { page, pageSize } = params;
    const where: Prisma.UserWhereInput = {
      id:                { not: userId },
      isActive:          true,
      profileVisibility: "PUBLIC",
      followedBy:        { none: { sourceId: userId, status: "ACTIVE" } },
    };

    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { followedBy: { _count: "desc" } },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select:  SEARCH_SELECT,
      }),
      db.user.count({ where }),
    ]);

    return { items, total };
  },
};
