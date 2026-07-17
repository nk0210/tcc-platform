/**
 * TCC Shared Types — Phase Alpha
 * Framework-agnostic types shared between apps/api and apps/web.
 * No Prisma imports. No Express imports. Pure TypeScript.
 */

// ── Enum mirrors (string literals matching Prisma enum values) ────────────

export type UserRole =
  | "NORMAL_USER"
  | "FOLLOWER_TRADER"
  | "VERIFIED_TRADER"
  | "MASTER_TRADER"
  | "MENTOR"
  | "ADMIN"
  | "OWNER";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED" | "DEACTIVATED";

export type Visibility = "PUBLIC" | "PRIVATE" | "FOLLOWERS_ONLY";

export type ExperienceLevel =
  | "BEGINNER"
  | "INTERMEDIATE"
  | "ADVANCED"
  | "PROFESSIONAL";

export type TradeSide    = "BUY" | "SELL";
export type CloseReason  = "MANUAL" | "STOP_LOSS" | "TAKE_PROFIT";
export type TradeResult  = "WIN" | "LOSS" | "BREAKEVEN";

export type PostType =
  | "TEXT"
  | "TRADE_IDEA"
  | "SHARED_TRADE"
  | "ACADEMY_COMPLETION"
  | "STRATEGY_SHARE"
  | "COMPETITION_UPDATE";

export type PostVisibility  = "PUBLIC" | "FOLLOWERS_ONLY" | "PRIVATE";
export type StrategyType    = "OFFICIAL" | "EDUCATIONAL_TEMPLATE" | "CREATOR_PUBLISHED";
export type PerformanceStatus = "UNVERIFIED" | "SELF_REPORTED" | "VERIFIED";
export type RiskLevel       = "LOW" | "MEDIUM" | "HIGH";
export type PricingModel    = "FREE" | "ONE_TIME" | "SUBSCRIPTION";
export type CourseType      = "OFFICIAL" | "FREE_RESOURCE" | "CREATOR_PUBLISHED";
export type CourseLevel     = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type CertificateStatus = "UNAVAILABLE" | "COMING_SOON" | "EARNED";
export type LessonType      = "TEXT" | "VIDEO" | "QUIZ" | "EXERCISE";

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "MORE_INFO_REQUIRED"
  | "SUSPENDED";

export type MasterStatus       = "ACTIVE" | "SUSPENDED" | "REMOVED";
export type CopyMode           = "PAPER_COPY" | "LIVE_COPY";
export type RelationshipStatus =
  | "ACTIVE"
  | "PAUSED"
  | "STOPPED"
  | "BLOCKED"
  | "PENDING_BROKER_CONNECTION";
export type CopyLotMode     = "FIXED_LOT" | "RISK_MULTIPLIER" | "EQUITY_RATIO";
export type CopyTradeStatus = "COPIED_PAPER" | "SKIPPED" | "BLOCKED" | "PENDING" | "FAILED";

export type NotificationType =
  | "SYSTEM"
  | "ACADEMY"
  | "COPY_TRADE"
  | "COMMUNITY"
  | "MARKETPLACE"
  | "COMPETITION"
  | "ADMIN"
  | "REPORT_UPDATE"
  | "TRADE"
  | "PRICE_ALERT";

export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ReportStatus         = "PENDING" | "REVIEWED" | "RESOLVED" | "DISMISSED";
export type ReportPriority       = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type FollowStatus         = "ACTIVE" | "PENDING" | "BLOCKED";

// ── API response wrappers ─────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data:    T;
  message?: string;
}

export interface ApiError {
  success: false;
  error:   string;
  code?:   string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Auth ──────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken:  string;
  refreshToken: string;
  expiresIn:    number;
}

export interface TokenPayload {
  sub:    string;
  email:  string;
  handle: string;
  roles:  string[];
  iat?:   number;
  exp?:   number;
}

// ── User DTOs ─────────────────────────────────────────────────────────────

export interface UserPublicDTO {
  id:          string;
  tccId:       string;
  handle:      string;
  displayName: string;
  bio:         string;
  location:    string;
  avatarUrl:   string | null;
  roles:       UserRole[];
  status:      UserStatus;
  isVerified:  boolean;
  profileVisibility: Visibility;
  experienceLevel:   ExperienceLevel | null;
  socialLinks: {
    website?:   string | null;
    x?:         string | null;
    linkedin?:  string | null;
    youtube?:   string | null;
    instagram?: string | null;
  } | null;
  tradingIdentity: {
    marketsTraded:     string[];
    symbolsTraded:     string[];
    strategiesUsed:    string[];
    preferredSessions: string[];
  } | null;
  createdAt: string;
}

export interface UserPrivateDTO extends UserPublicDTO {
  email:               string;
  portfolioVisibility: Visibility;
  isActive:            boolean;
  lastLoginAt:         string | null;
  permissions:         string[];
  updatedAt:           string;
}

// ── RBAC DTOs ─────────────────────────────────────────────────────────────

export interface RoleDTO {
  id:          string;
  name:        UserRole;
  label:       string;
  description: string;
  isSystem:    boolean;
}

export interface PermissionDTO {
  id:          string;
  key:         string;
  label:       string;
  description: string;
  category:    string;
}

export interface AuditLogDTO {
  id:           string;
  actorId:      string;
  actorHandle:  string;
  actorRole:    string;
  actionType:   string;
  targetType:   string;
  targetId:     string;
  targetUserId: string | null;
  description:  string;
  reason:       string | null;
  metadata:     Record<string, unknown> | null;
  createdAt:    string;
}

export interface NotificationDTO {
  id:          string;
  userId:      string;
  type:        NotificationType;
  priority:    NotificationPriority;
  title:       string;
  message:     string;
  actionLabel: string | null;
  actionPath:  string | null;
  read:        boolean;
  createdAt:   string;
}

// ── Trade DTOs ────────────────────────────────────────────────────────────

export interface TradeDTO {
  id:            string;
  userId:        string;
  mode:          string;
  symbol:        string;
  displayName:   string;
  category:      string;
  side:          TradeSide;
  lotSize:       number;
  entryPrice:    number;
  currentPrice:  number | null;
  exitPrice:     number | null;
  sl:            number | null;
  tp:            number | null;
  grossPnl:      number | null;
  commission:    number | null;
  netPnl:        number | null;
  marginUsed:    number;
  notionalValue: number;
  leverage:      number;
  closeReason:   CloseReason | null;
  openedAt:      string;
  closedAt:      string | null;
  durationMs:    number | null;
  isOpen:        boolean;
  result:        TradeResult | null;
  session:       string | null;
  createdAt:     string;
  updatedAt:     string;
}

// ── Journal DTOs ──────────────────────────────────────────────────────────

export interface JournalEntryDTO {
  id:              string;
  userId:          string;
  tradeId:         string | null;
  symbol:          string;
  displayName:     string;
  side:            TradeSide;
  lotSize:         number;
  entryPrice:      number;
  exitPrice:       number | null;
  grossPnl:        number | null;
  netPnl:          number | null;
  result:          TradeResult | null;
  openedAt:        string | null;
  closedAt:        string | null;
  durationMs:      number | null;
  closeReason:     string | null;
  emotion:         string;
  confidenceLevel: number;
  stressLevel:     number;
  entryQuality:    string;
  followedPlan:    boolean | null;
  strategy:        string;
  marketStructure: string;
  session:         string;
  timeframe:       string;
  notes:           string;
  whatWentRight:   string;
  whatWentWrong:   string;
  lessonLearned:   string;
  tags:            string[];
  aiAnalysis:      string;
  createdAt:       string;
  updatedAt:       string;
}

// ── Pagination ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items:      T[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  hasNext:    boolean;
  hasPrev:    boolean;
}