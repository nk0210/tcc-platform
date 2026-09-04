"use client";
/**
 * TCC Trader Profile — /profile
 *
 * API-backed via profileStore.ts (Phase Alpha Frontend Integration).
 *
 * Key shape changes from the old local-only profile model:
 *   - myProfile.username → myProfile.handle
 *   - tradingIdentity.experienceLevel moved up to myProfile.experienceLevel
 *   - profileVisibility/portfolioVisibility/experienceLevel/roles are all
 *     uppercase enums now (server-driven, not client-invented strings)
 *   - Follower/following counts come from myProfile._count (server-computed)
 *     — there's no client-side follow-relationship list to derive them from
 *     anymore, so this page shows counts only, not member lists.
 *   - updateProfile/updateSocialLinks/updateTradingIdentity are three
 *     separate API calls now instead of one combined local update.
 *   - "My strategies" now comes from strategyStore's myStrategies (a real
 *     /strategy/my fetch) instead of filtering the discover feed by handle.
 *   - "My posts" has no dedicated store action, so this page calls the
 *     /community/users/:handle/posts endpoint directly via `api`.
 *   - copyTradingStore no longer exposes a master-trader-by-userId lookup
 *     (that lived in the old, now-deleted useMasterRegistryStore) — master
 *     status is read from the auth role (MASTER_TRADER) instead of a full
 *     master profile fetch, so the detailed master-profile card was
 *     simplified to a status banner + link to /copy-trading.
 */

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// ── Stores ─────────────────────────────────────────────────────────────────
import { useAuthStore, type UserRole } from "@/store/authStore";
import {
  useProfileStore,
  type UserProfile,
  type Visibility,
  type ExperienceLevel,
  type TradingIdentity,
} from "@/store/profileStore";
import { useTradeStore } from "@/store/tradeStore";
import { useJournalStore } from "@/store/journalStore";
import { useAcademyStore, type Course } from "@/store/academyStore";
import { useStrategyStore, type Strategy } from "@/store/strategyStore";
import {
  useCommunityStore,
  type CommunityPost,
  type CommunityPostType,
} from "@/store/communityStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useCopyTradingStore } from "@/store/copyTradingStore";
import { api } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/auth/roles";

// ── Analytics ──────────────────────────────────────────────────────────────
import {
  calculatePerformanceOverview,
  calculateDisciplineScore,
  calculateSymbolAnalytics,
  calculateSessionAnalytics,
  formatDuration,
  PAPER_INITIAL_BALANCE,
} from "@/lib/analytics/performance";
import { TCC_SYMBOL_MAP } from "@/lib/markets/symbols";

// ── Layout ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// TAB CONFIG
// ─────────────────────────────────────────────────────────────────────────

type ProfileTab =
  | "overview"
  | "portfolio"
  | "posts"
  | "strategies"
  | "academy"
  | "copy_trading"
  | "settings";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "overview", label: "📊 Overview" },
  { key: "portfolio", label: "💼 Portfolio" },
  { key: "posts", label: "💬 Posts" },
  { key: "strategies", label: "📋 Strategies" },
  { key: "academy", label: "🎓 Academy" },
  { key: "copy_trading", label: "📡 Copy Trading" },
  { key: "settings", label: "⚙ Settings" },
];

// ─────────────────────────────────────────────────────────────────────────
// DISPLAY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

const ROLE_CLASS: Record<UserRole, string> = {
  NORMAL_USER: "text-fg-muted bg-elevated border-border",
  FOLLOWER_TRADER: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  VERIFIED_TRADER: "text-success bg-success-soft border-success/30",
  MASTER_TRADER: "text-warning bg-warning-soft border-warning/30",
  MENTOR: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  ADMIN: "text-danger bg-danger-soft border-danger/30",
  OWNER: "text-danger bg-danger-soft border-danger/30",
};

const VIS_ICON: Record<string, string> = {
  PUBLIC: "🌐",
  PRIVATE: "🔒",
  FOLLOWERS_ONLY: "👥",
};

const VIS_LABEL: Record<string, string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  FOLLOWERS_ONLY: "Followers Only",
};

const POST_TYPE_LABEL: Record<CommunityPostType, string> = {
  TEXT: "💬 Text",
  TRADE_IDEA: "💡 Trade Idea",
  SHARED_TRADE: "📊 Shared Trade",
  ACADEMY_COMPLETION: "🎓 Academy",
  STRATEGY_SHARE: "📋 Strategy",
  COMPETITION_UPDATE: "🏆 Competition",
};

// ─────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────

function pnlClass(v: number): string {
  return v > 0.01
    ? "text-success"
    : v < -0.01
      ? "text-danger"
      : "text-fg-dim";
}

// ─────────────────────────────────────────────────────────────────────────
// MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────

function Avatar({
  name,
  size = "xl",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sz: Record<string, string> = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl",
    xl: "w-24 h-24 text-4xl",
  };

  return (
    <div
      className={`${sz[size]} rounded-2xl bg-gradient-to-br from-green-500/25 to-green-700/15 border-2 border-success/30 flex items-center justify-center text-success font-bold shrink-0 select-none`}
    >
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  color = "text-fg",
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="glass border border-border rounded-xl p-4">
      <p className="text-fg-dim text-xs truncate mb-1">{label}</p>
      <p className={`text-xl font-bold truncate ${color}`}>{value}</p>
      {sub && (
        <p className="text-fg-dim text-xs mt-0.5 leading-tight">{sub}</p>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-fg-dim text-sm font-medium">{title}</p>
      {sub && (
        <p className="text-fg-dim text-xs max-w-xs leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: CommunityPost }) {
  return (
    <div className="glass border border-border rounded-xl p-4 hover:border-border transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Chip className="text-fg-dim bg-elevated border-border">
          {POST_TYPE_LABEL[post.type]}
        </Chip>
        <span className="text-fg-dim text-xs shrink-0">
          {new Date(post.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <p className="text-fg-muted text-sm leading-relaxed line-clamp-3 mb-3">
        {post.content}
      </p>

      {post.tradeSnapshot && (
        <div className="flex items-center gap-3 bg-elevated border border-border rounded-lg px-3 py-2 mb-3 text-xs">
          <span
            className={`font-semibold ${
              post.tradeSnapshot.side === "BUY"
                ? "text-success"
                : "text-danger"
            }`}
          >
            {post.tradeSnapshot.side}
          </span>
          <span className="text-fg-muted">
            {post.tradeSnapshot.displayName}
          </span>
          <span
            className={`ml-auto font-bold ${pnlClass(
              post.tradeSnapshot.netPnl
            )}`}
          >
            {post.tradeSnapshot.netPnl >= 0 ? "+" : ""}$
            {post.tradeSnapshot.netPnl.toFixed(2)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-fg-dim">
        <span>❤ {post._count.likes}</span>
        <span>💬 {post._count.comments}</span>
        <span>🔁 {post._count.shares}</span>
        <span
          className={`ml-auto ${
            post.visibility === "PUBLIC"
              ? "text-success/40"
              : post.visibility === "FOLLOWERS_ONLY"
                ? "text-warning/40"
                : "text-danger/40"
          }`}
        >
          {VIS_ICON[post.visibility]}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COPY TRADING TAB
// ─────────────────────────────────────────────────────────────────────────

function CopyTradingTab({
  roles,
  onNavigate,
}: {
  roles: UserRole[];
  onNavigate: (path: string) => void;
}) {
  const { myApplication, myRelationships } = useCopyTradingStore();

  const isMaster = roles.includes("MASTER_TRADER");
  const isFollower = myRelationships.length > 0;

  let bannerTitle = "👤 Not Participating";
  let bannerDesc = "You are not currently participating in copy trading.";
  let bannerCls = "border-border";

  if (isMaster) {
    bannerTitle = "🏆 Master Trader";
    bannerDesc =
      "You are an approved master trader. Paper-copy only — no live broker execution. Manage your master profile from Copy Trading.";
    bannerCls = "border-warning/30 bg-warning-soft";
  } else if (isFollower) {
    bannerTitle = `📡 Active Follower — ${myRelationships.length} copy relationship${
      myRelationships.length > 1 ? "s" : ""
    }`;
    bannerDesc =
      "Copying master traders in paper-copy mode. No real broker execution.";
    bannerCls = "border-success/30 bg-success-soft";
  } else if (myApplication) {
    const statusLabel: Record<string, string> = {
      DRAFT: "📝 Draft Application",
      SUBMITTED: "📬 Application Submitted",
      UNDER_REVIEW: "🔍 Under Review",
      MORE_INFO_REQUIRED: "❓ More Info Requested",
      APPROVED: "✅ Approved",
      REJECTED: "❌ Application Rejected",
      SUSPENDED: "🚫 Suspended",
    };
    bannerTitle = statusLabel[myApplication.status] ?? myApplication.status;
    bannerDesc = `Application status: ${myApplication.status
      .toLowerCase()
      .replace(/_/g, " ")}.`;
    bannerCls =
      myApplication.status === "SUBMITTED" ||
      myApplication.status === "UNDER_REVIEW"
        ? "border-blue-500/15 bg-blue-500/3"
        : "border-border";
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Status banner */}
      <div className={`glass border rounded-xl p-5 ${bannerCls}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-fg font-semibold text-sm mb-1">
              {bannerTitle}
            </p>
            <p className="text-fg-dim text-xs leading-relaxed">
              {bannerDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("/copy-trading")}
            className="bg-elevated hover:bg-elevated text-fg-muted border border-border px-4 py-1.5 rounded-lg text-xs font-semibold transition shrink-0"
          >
            Open →
          </button>
        </div>
      </div>

      {/* Application status detail */}
      {myApplication && !isMaster && (
        <div className="glass border border-border rounded-xl p-5">
          <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">
            Application Details
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-3">
            {[
              { l: "TCC ID", v: myApplication.tccId },
              {
                l: "Status",
                v: myApplication.status.toLowerCase().replace(/_/g, " "),
              },
              {
                l: "Markets",
                v: myApplication.marketsTraded.join(", ") || "—",
              },
              {
                l: "Submitted",
                v: myApplication.submittedAt
                  ? new Date(myApplication.submittedAt).toLocaleDateString()
                  : "—",
              },
            ].map((item) => (
              <div key={item.l} className="flex gap-2">
                <span className="text-fg-dim w-24 shrink-0">{item.l}</span>
                <span className="text-fg-muted capitalize">{item.v}</span>
              </div>
            ))}
          </div>

          {myApplication.rejectionReason && (
            <div className="bg-danger-soft border border-danger/30 rounded-lg p-3 mt-2">
              <p className="text-danger text-xs font-semibold mb-1">
                Rejection Reason
              </p>
              <p className="text-fg-muted text-xs">
                {myApplication.rejectionReason}
              </p>
            </div>
          )}

          {myApplication.moreInfoRequest && (
            <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 mt-2">
              <p className="text-orange-400 text-xs font-semibold mb-1">
                Info Requested
              </p>
              <p className="text-fg-muted text-xs">
                {myApplication.moreInfoRequest}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active copy relationships */}
      {myRelationships.length > 0 && (
        <div className="glass border border-border rounded-xl p-5">
          <p className="text-fg-dim text-xs uppercase tracking-wider mb-3">
            Active Copy Relationships ({myRelationships.length})
          </p>

          {myRelationships.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
            >
              <div>
                <p className="text-fg-muted text-sm font-medium">
                  {rel.masterDisplayName}
                </p>
                <p className="text-fg-dim text-xs">
                  {rel.mode.toLowerCase().replace(/_/g, " ")} · {rel.status.toLowerCase()}
                </p>
              </div>
              <Chip
                className={
                  rel.status === "ACTIVE"
                    ? "text-success bg-success-soft border-success/30"
                    : rel.status === "PAUSED"
                      ? "text-warning bg-warning-soft border-warning/30"
                      : "text-fg-dim bg-elevated border-border"
                }
              >
                {rel.status.toLowerCase()}
              </Chip>
            </div>
          ))}

          <p className="text-fg-dim text-xs mt-3">
            All copy relationships are paper-copy only. No real broker orders
            placed.
          </p>
        </div>
      )}

      {/* Empty state — not participating at all */}
      {!isMaster && !isFollower && !myApplication && (
        <EmptyState
          icon="📡"
          title="Not participating in copy trading yet."
          sub="Apply to become a master trader, or discover master traders to start paper-copy following. Paper-copy mode only."
        />
      )}

      <div className="p-3 bg-elevated border border-border rounded-xl">
        <p className="text-fg-dim text-xs leading-relaxed">
          Copy trading is paper-copy mode only. No real money involved.
          Phase Alpha will require verified broker connections and
          real-time execution.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────

function SettingsTab({ profile }: { profile: UserProfile }) {
  const { updateProfile, updateSocialLinks, updateTradingIdentity } = useProfileStore();
  const { addNotification } = useNotificationStore();

  const ti: TradingIdentity = profile.tradingIdentity ?? {
    marketsTraded: [], symbolsTraded: [], strategiesUsed: [], preferredSessions: [],
  };

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [profileVisibility, setProfileVisibility] =
    useState<Visibility>(profile.profileVisibility);
  const [portfolioVisibility, setPortfolioVisibility] =
    useState<Visibility>(profile.portfolioVisibility);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(
    profile.experienceLevel
  );
  const [marketsTraded, setMarketsTraded] = useState(ti.marketsTraded.join(", "));
  const [symbolsTraded, setSymbolsTraded] = useState(ti.symbolsTraded.join(", "));
  const [strategiesUsed, setStrategiesUsed] = useState(ti.strategiesUsed.join(", "));
  const [preferredSessions, setPreferredSessions] = useState(ti.preferredSessions.join(", "));
  const [website, setWebsite] = useState(profile.socialLinks?.website ?? "");
  const [xHandle, setXHandle] = useState(profile.socialLinks?.x ?? "");
  const [linkedin, setLinkedin] = useState(profile.socialLinks?.linkedin ?? "");
  const [youtube, setYoutube] = useState(profile.socialLinks?.youtube ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const split = (raw: string) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = async () => {
    setSaving(true);
    await Promise.all([
      updateProfile({
        displayName,
        bio,
        location,
        profileVisibility,
        portfolioVisibility,
        experienceLevel,
      }),
      updateTradingIdentity({
        marketsTraded: split(marketsTraded),
        symbolsTraded: split(symbolsTraded),
        strategiesUsed: split(strategiesUsed),
        preferredSessions: split(preferredSessions),
      }),
      updateSocialLinks({
        website: website || null,
        x: xHandle || null,
        linkedin: linkedin || null,
        youtube: youtube || null,
      }),
    ]);
    setSaving(false);

    addNotification({
      type: "system",
      priority: "low",
      title: "✅ Profile Updated",
      message: "Your profile changes have been saved.",
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputCls =
    "w-full bg-elevated border border-border rounded-lg px-3 py-2 text-fg text-sm focus:outline-none focus:border-border-strong placeholder-white/20 transition";

  const sectionCls = "glass border border-border rounded-xl p-5";

  const VisOption = ({
    value,
    current,
    onChange,
  }: {
    value: Visibility;
    current: string;
    onChange: (v: Visibility) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`w-full text-left px-3 py-2 rounded-lg text-xs border mb-1 transition ${
        current === value
          ? "bg-success-soft text-success border-success/30"
          : "bg-elevated text-fg-muted border-border hover:border-border-strong"
      }`}
    >
      {VIS_ICON[value]} {VIS_LABEL[value]}
    </button>
  );

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* ── Basic info ── */}
      <div className={sectionCls}>
        <p className="text-fg-muted text-xs uppercase tracking-wider mb-4">
          Basic Information
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-fg-dim text-xs mb-1">Display Name</p>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <p className="text-fg-dim text-xs mb-1">Bio</p>
            <textarea
              value={bio}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other traders about yourself..."
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <p className="text-fg-dim text-xs mb-1">Location</p>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. London, UK"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* ── Visibility ── */}
      <div className={sectionCls}>
        <p className="text-fg-muted text-xs uppercase tracking-wider mb-4">
          Privacy & Visibility
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-fg-dim text-xs mb-1.5">Profile</p>
            {(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"] as Visibility[]).map(
              (v) => (
                <VisOption
                  key={v}
                  value={v}
                  current={profileVisibility}
                  onChange={setProfileVisibility}
                />
              )
            )}
          </div>

          <div>
            <p className="text-fg-dim text-xs mb-1.5">Portfolio</p>
            {(["PUBLIC", "FOLLOWERS_ONLY", "PRIVATE"] as Visibility[]).map(
              (v) => (
                <VisOption
                  key={v}
                  value={v}
                  current={portfolioVisibility}
                  onChange={setPortfolioVisibility}
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Trading identity ── */}
      <div className={sectionCls}>
        <p className="text-fg-muted text-xs uppercase tracking-wider mb-1">
          Trading Identity
        </p>
        <p className="text-fg-dim text-xs mb-4 leading-relaxed">
          Flexible — list as many markets, symbols, strategies, or sessions as
          you trade. Use comma-separated values.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-fg-dim text-xs mb-1.5">Experience Level</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [null, "BEGINNER", "INTERMEDIATE", "ADVANCED", "PROFESSIONAL"] as const
              ).map((lvl) => (
                <button
                  key={lvl ?? "none"}
                  type="button"
                  onClick={() => setExperienceLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-xs border capitalize transition ${
                    experienceLevel === lvl
                      ? "bg-success-soft text-success border-success/30"
                      : "bg-elevated text-fg-dim border-border hover:border-border-strong"
                  }`}
                >
                  {lvl === null ? "Not set" : lvl.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {[
            {
              label: "Markets Traded",
              value: marketsTraded,
              set: setMarketsTraded,
              ph: "e.g. Crypto, Forex, Gold",
            },
            {
              label: "Symbols Traded",
              value: symbolsTraded,
              set: setSymbolsTraded,
              ph: "e.g. BTCUSDT, XAUUSD, EURUSD",
            },
            {
              label: "Strategies Used",
              value: strategiesUsed,
              set: setStrategiesUsed,
              ph: "e.g. SMC, Price Action, EMA Cross",
            },
            {
              label: "Preferred Sessions",
              value: preferredSessions,
              set: setPreferredSessions,
              ph: "e.g. London, New York, Asian",
            },
          ].map(({ label, value, set, ph }) => (
            <div key={label}>
              <p className="text-fg-dim text-xs mb-1">
                {label}
                <span className="text-fg-dim ml-1">(comma separated)</span>
              </p>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Social links ── */}
      <div className={sectionCls}>
        <p className="text-fg-muted text-xs uppercase tracking-wider mb-4">
          Social Links{" "}
          <span className="text-fg-dim normal-case">(optional)</span>
        </p>

        <div className="flex flex-col gap-3">
          {[
            {
              label: "Website",
              value: website,
              set: setWebsite,
              ph: "https://yoursite.com",
            },
            {
              label: "X/Twitter",
              value: xHandle,
              set: setXHandle,
              ph: "@handle",
            },
            {
              label: "LinkedIn",
              value: linkedin,
              set: setLinkedin,
              ph: "linkedin.com/in/handle",
            },
            {
              label: "YouTube",
              value: youtube,
              set: setYoutube,
              ph: "youtube.com/@channel",
            },
          ].map(({ label, value, set, ph }) => (
            <div key={label}>
              <p className="text-fg-dim text-xs mb-1">{label}</p>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="bg-success-soft hover:bg-success/22 text-success border border-success/30 py-3 rounded-xl text-sm font-semibold transition disabled:opacity-40"
      >
        {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  // ── Auth ────────────────────────────────────────────────────────────────
  const { user } = useAuthStore();

  // ── Profile (self-initializes on login via authStore subscribe) ─────────
  const { myProfile, isLoading: profileLoading, isInitialized: profileInitialized, error: profileError, init: initProfile } = useProfileStore();

  // ── Trading data ─────────────────────────────────────────────────────────
  const { closedTrades, positions, balance, equity, floatingPnl } =
    useTradeStore();
  const { entries } = useJournalStore();

  // ── Academy ─────────────────────────────────────────────────────────────
  const { courses, myProgress } = useAcademyStore();

  // ── Strategies ────────────────────────────────────────────────────────
  const { myStrategies, savedStrategies, getMyStrategies, getSavedStrategies } = useStrategyStore();

  // ── Community posts (no dedicated store action — fetched directly) ──────
  const [myPosts, setMyPosts] = useState<CommunityPost[]>([]);

  // ── Hydration guard ──────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Active tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // Defensive direct init — the store also auto-inits via an authStore
  // subscribe (see bottom of profileStore.ts), but that relies on a dynamic
  // import registering before the next auth state change fires. Calling
  // init() here too is a no-op once already initialized/in-flight, and
  // closes that race so this page never depends solely on timing.
  useEffect(() => {
    if (user && !profileInitialized) initProfile();
  }, [user, profileInitialized, initProfile]);

  // ── Load data that isn't covered by store auto-init ──────────────────────
  useEffect(() => {
    getMyStrategies();
    getSavedStrategies();
  }, [getMyStrategies, getSavedStrategies]);

  useEffect(() => {
    if (!user?.handle) return;
    api.get<{ items: CommunityPost[] }>(`/community/users/${user.handle}/posts?pageSize=50`).then((res) => {
      if (res.success) setMyPosts(res.data.items);
    });
  }, [user?.handle]);

  // ── Redirect if not logged in ────────────────────────────────────────────
  useEffect(() => {
    if (mounted && !user) {
      router.push("/login");
    }
  }, [mounted, user, router]);

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED DATA — all memoised
  // ─────────────────────────────────────────────────────────────────────────

  const perf = useMemo(() => {
    if (closedTrades.length === 0) return null;

    return calculatePerformanceOverview(
      closedTrades,
      balance,
      equity,
      floatingPnl,
      positions
    );
  }, [closedTrades, balance, equity, floatingPnl, positions]);

  const disciplineScore = useMemo(
    () => calculateDisciplineScore(entries, closedTrades),
    [entries, closedTrades]
  );

  const symbolStats = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => calculateSymbolAnalytics(closedTrades, TCC_SYMBOL_MAP as any),
    [closedTrades]
  );

  const sessionStats = useMemo(
    () => calculateSessionAnalytics(entries),
    [entries]
  );

  const publishedStrategies = myStrategies;
  const savedStrategyCount = savedStrategies.length;

  const enrolledCourseIds = Object.keys(myProgress);

  const completedCourses = courses.filter((c: Course) => {
    const p = myProgress[c.id];
    return p && c.lessons.length > 0 && p.completedLessons.length >= c.lessons.length;
  });

  const bestSymbol = useMemo(
    () =>
      symbolStats.length > 0
        ? symbolStats.reduce(
            (best, s) => (s.netPnl > best.netPnl ? s : best),
            symbolStats[0]
          )
        : null,
    [symbolStats]
  );

  const mostTraded = useMemo(
    () =>
      symbolStats.length > 0
        ? symbolStats.reduce(
            (most, s) => (s.trades > most.trades ? s : most),
            symbolStats[0]
          )
        : null,
    [symbolStats]
  );

  const bestSession = useMemo(
    () =>
      sessionStats.length > 0
        ? sessionStats.reduce(
            (best, s) => (s.netPnl > best.netPnl ? s : best),
            sessionStats[0]
          )
        : null,
    [sessionStats]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING / GUARD
  // ─────────────────────────────────────────────────────────────────────────

  if (!mounted || !user || !profileInitialized || profileLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-fg-dim text-sm animate-pulse">
          {!user ? "Redirecting to login..." : "Loading profile..."}
        </p>
      </div>
    );
  }

  // Fetch finished (isInitialized) but failed, or returned nothing — show an
  // explicit, recoverable error instead of silently falling through to a
  // loading spinner that would never resolve.
  if (profileError || !myProfile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger text-sm mb-3">
            {profileError ?? "Failed to load profile."}
          </p>
          <button
            type="button"
            onClick={() => useProfileStore.setState({ isInitialized: false })}
            className="bg-elevated hover:bg-elevated text-fg-muted border border-border px-4 py-2 rounded-lg text-xs font-semibold transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const ti: TradingIdentity = myProfile.tradingIdentity ?? {
    marketsTraded: [], symbolsTraded: [], strategiesUsed: [], preferredSessions: [],
  };

  const hasIdentity =
    ti.marketsTraded.length > 0 ||
    ti.symbolsTraded.length > 0 ||
    ti.strategiesUsed.length > 0 ||
    ti.preferredSessions.length > 0 ||
    !!myProfile.experienceLevel;

  return (
        <div className="flex-1 overflow-y-auto">
          {/* ════════════════════════════════════════════════
              PROFILE HEADER
          ════════════════════════════════════════════════ */}
          <div className="glass border-b border-border px-6 py-5">
            <div className="flex items-start gap-6 flex-wrap">
              <Avatar
                name={myProfile.displayName || myProfile.handle}
                size="xl"
              />

              <div className="flex-1 min-w-0">
                {/* Name row */}
                <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                  <div>
                    <h1 className="text-2xl font-bold text-fg leading-tight">
                      {myProfile.displayName || myProfile.handle}
                    </h1>
                    <p className="text-fg-dim text-sm">
                      @{myProfile.handle}
                    </p>
                    {myProfile.tccId && (
                      <p className="text-success/60 font-mono text-xs mt-0.5">
                        {myProfile.tccId}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip
                      className={`${
                        myProfile.profileVisibility === "PUBLIC"
                          ? "text-success/70 border-success/30"
                          : myProfile.profileVisibility === "PRIVATE"
                            ? "text-danger/60 border-danger/30"
                            : "text-warning/60 border-warning/30"
                      } bg-transparent`}
                    >
                      {VIS_ICON[myProfile.profileVisibility]} Profile{" "}
                      {VIS_LABEL[myProfile.profileVisibility]}
                    </Chip>

                    <button
                      type="button"
                      onClick={() => setActiveTab("settings")}
                      className="bg-elevated hover:bg-elevated text-fg-muted border border-border px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                    >
                      ✏ Edit Profile
                    </button>
                  </div>
                </div>

                {/* Bio */}
                {myProfile.bio ? (
                  <p className="text-fg-dim5 text-sm mt-2 leading-relaxed max-w-2xl">
                    {myProfile.bio}
                  </p>
                ) : (
                  <p className="text-fg-dim text-sm mt-2 italic">
                    No bio yet — add one in Settings
                  </p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-fg-dim">
                  {myProfile.location && <span>📍 {myProfile.location}</span>}

                  <span>
                    📅 Joined{" "}
                    {new Date(myProfile.createdAt).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        year: "numeric",
                      }
                    )}
                  </span>

                  {myProfile.socialLinks?.x && (
                    <a
                      href={`https://x.com/${myProfile.socialLinks.x.replace(
                        "@",
                        ""
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-blue-400 transition"
                    >
                      𝕏 {myProfile.socialLinks.x}
                    </a>
                  )}

                  {myProfile.socialLinks?.website && (
                    <a
                      href={myProfile.socialLinks.website}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-fg transition"
                    >
                      🌐 Website
                    </a>
                  )}

                  {myProfile.socialLinks?.linkedin && (
                    <a
                      href={
                        myProfile.socialLinks.linkedin.startsWith("http")
                          ? myProfile.socialLinks.linkedin
                          : `https://linkedin.com/in/${myProfile.socialLinks.linkedin}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-blue-400 transition"
                    >
                      LinkedIn
                    </a>
                  )}

                  {myProfile.socialLinks?.youtube && (
                    <a
                      href={
                        myProfile.socialLinks.youtube.startsWith("http")
                          ? myProfile.socialLinks.youtube
                          : `https://youtube.com/@${myProfile.socialLinks.youtube.replace(
                              /^@/,
                              ""
                            )}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-danger transition"
                    >
                      YouTube
                    </a>
                  )}
                </div>

                {/* Role badges + social counts */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {myProfile.roles.map((role) => (
                    <Chip key={role} className={ROLE_CLASS[role as UserRole]}>
                      {ROLE_LABELS[role as UserRole] ?? role}
                    </Chip>
                  ))}

                  <div className="h-4 w-px bg-elevated mx-1" />

                  <div className="flex gap-4 text-xs text-fg-muted">
                    <span>
                      <span className="text-fg font-bold">
                        {myProfile._count?.followedBy ?? 0}
                      </span>{" "}
                      followers
                    </span>

                    <span>
                      <span className="text-fg font-bold">
                        {myProfile._count?.following ?? 0}
                      </span>{" "}
                      following
                    </span>

                    <span>
                      <span className="text-fg font-bold">
                        {myPosts.length}
                      </span>{" "}
                      posts
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-0.5 mt-5 overflow-x-auto pb-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    activeTab === tab.key
                      ? "bg-success-soft text-success"
                      : "text-fg-dim hover:text-fg-muted hover:bg-elevated"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ════════════════════════════════════════════════
              TAB CONTENT
          ════════════════════════════════════════════════ */}
          <div className="p-6">
            {/* ══════════════ OVERVIEW ══════════════════════ */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-6">
                {/* Trading identity */}
                <div className="glass border border-border rounded-xl p-5">
                  <p className="text-fg-dim text-xs uppercase tracking-wider mb-4">
                    Trading Identity
                  </p>

                  {!hasIdentity ? (
                    <p className="text-fg-dim text-sm">
                      No trading identity set yet.{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("settings")}
                        className="text-success/60 hover:text-success underline transition"
                      >
                        Add in Settings →
                      </button>
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {myProfile.experienceLevel && (
                        <div className="flex items-start gap-3">
                          <span className="text-fg-dim text-xs w-28 shrink-0 pt-0.5">
                            Experience
                          </span>
                          <Chip className="text-fg-muted bg-elevated border-border capitalize">
                            {myProfile.experienceLevel.toLowerCase()}
                          </Chip>
                        </div>
                      )}

                      {[
                        { label: "Markets", items: ti.marketsTraded },
                        { label: "Symbols", items: ti.symbolsTraded },
                        { label: "Strategies", items: ti.strategiesUsed },
                        { label: "Sessions", items: ti.preferredSessions },
                      ]
                        .filter(({ items }) => items.length > 0)
                        .map(({ label, items }) => (
                          <div key={label} className="flex items-start gap-3">
                            <span className="text-fg-dim text-xs w-28 shrink-0 pt-0.5">
                              {label}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map((item) => (
                                <Chip
                                  key={item}
                                  className="text-fg-muted bg-elevated border-border capitalize"
                                >
                                  {item}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Performance stats */}
                {closedTrades.length === 0 ? (
                  <EmptyState
                    icon="📊"
                    title="No paper trading data yet."
                    sub="Open the Dashboard, place and close paper trades to see performance stats here."
                  />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <StatCard
                      label="Closed Trades"
                      value={closedTrades.length}
                    />

                    {perf && (
                      <>
                        <StatCard
                          label="Win Rate"
                          value={`${perf.winRate}%`}
                          color={
                            perf.winRate >= 50
                              ? "text-success"
                              : "text-danger"
                          }
                          sub={`${perf.wins}W · ${perf.losses}L`}
                        />

                        <StatCard
                          label="Net P&L"
                          value={`${perf.netPnl >= 0 ? "+" : ""}$${
                            perf.netPnl
                          }`}
                          color={
                            perf.netPnl >= 0
                              ? "text-success"
                              : "text-danger"
                          }
                          sub="paper only"
                        />

                        <StatCard
                          label="Profit Factor"
                          value={
                            perf.profitFactor === 999
                              ? "∞"
                              : perf.profitFactor
                          }
                          color={
                            perf.profitFactor >= 1.5
                              ? "text-success"
                              : perf.profitFactor >= 1
                                ? "text-warning"
                                : "text-danger"
                          }
                        />

                        <StatCard
                          label="Avg Duration"
                          value={formatDuration(perf.avgDurationMs)}
                        />
                      </>
                    )}

                    {disciplineScore.hasEnoughData && (
                      <StatCard
                        label="Discipline"
                        value={`${disciplineScore.total}/100`}
                        color={
                          disciplineScore.total >= 70
                            ? "text-success"
                            : disciplineScore.total >= 50
                              ? "text-warning"
                              : "text-danger"
                        }
                        sub={`Grade ${disciplineScore.grade}`}
                      />
                    )}
                  </div>
                )}

                {/* Insight cards */}
                {closedTrades.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {bestSymbol && (
                      <div className="glass border border-success/30 bg-success-soft rounded-xl p-4">
                        <p className="text-fg-dim text-xs mb-2">
                          Best Symbol (Paper)
                        </p>
                        <p className="text-fg font-semibold">
                          {bestSymbol.displayName}
                        </p>
                        <p
                          className={`text-sm font-bold mt-1 ${
                            bestSymbol.netPnl >= 0
                              ? "text-success"
                              : "text-danger"
                          }`}
                        >
                          {bestSymbol.netPnl >= 0 ? "+" : ""}$
                          {bestSymbol.netPnl.toFixed(2)} ·{" "}
                          {bestSymbol.winRate}% WR
                        </p>
                      </div>
                    )}

                    {mostTraded && (
                      <div className="glass border border-border rounded-xl p-4">
                        <p className="text-fg-dim text-xs mb-2">
                          Most Traded
                        </p>
                        <p className="text-fg font-semibold">
                          {mostTraded.displayName}
                        </p>
                        <p className="text-fg-muted text-sm mt-1">
                          {mostTraded.trades} trade
                          {mostTraded.trades !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}

                    {bestSession && (
                      <div className="glass border border-border rounded-xl p-4">
                        <p className="text-fg-dim text-xs mb-2">
                          Best Session (Paper)
                        </p>
                        <p className="text-fg font-semibold capitalize">
                          {bestSession.session}
                        </p>
                        <p
                          className={`text-sm font-bold mt-1 ${
                            bestSession.netPnl >= 0
                              ? "text-success"
                              : "text-danger"
                          }`}
                        >
                          {bestSession.netPnl >= 0 ? "+" : ""}$
                          {bestSession.netPnl.toFixed(2)} ·{" "}
                          {bestSession.winRate}% WR
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Academy + strategy summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass border border-border rounded-xl p-4">
                    <p className="text-fg-dim text-xs mb-2">Academy</p>

                    {enrolledCourseIds.length === 0 ? (
                      <p className="text-fg-dim text-sm">
                        Not enrolled in any courses yet.
                      </p>
                    ) : (
                      <>
                        <p className="text-fg text-sm">
                          {completedCourses.length}/{enrolledCourseIds.length}{" "}
                          courses completed
                        </p>
                        <p className="text-fg-dim text-xs mt-0.5">
                          Certificates coming soon
                        </p>
                      </>
                    )}
                  </div>

                  <div className="glass border border-border rounded-xl p-4">
                    <p className="text-fg-dim text-xs mb-2">Strategies</p>

                    {publishedStrategies.length === 0 &&
                    savedStrategyCount === 0 ? (
                      <p className="text-fg-dim text-sm">
                        No strategies saved or published yet.
                      </p>
                    ) : (
                      <>
                        <p className="text-fg text-sm">
                          {publishedStrategies.length} published ·{" "}
                          {savedStrategyCount} saved
                        </p>
                        <p className="text-fg-dim text-xs mt-0.5">
                          &nbsp;
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-3 bg-elevated border border-border rounded-xl">
                  <p className="text-fg-dim text-xs leading-relaxed">
                    All stats are derived from your paper trading data. Not
                    verified. Not broker-connected.
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════ PORTFOLIO ══════════════════════ */}
            {activeTab === "portfolio" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-fg">Portfolio</h2>
                    <p className="text-fg-dim text-xs mt-0.5">
                      Paper trading performance
                    </p>
                  </div>

                  <Chip
                    className={`${
                      myProfile.portfolioVisibility === "PUBLIC"
                        ? "text-success/70 border-success/30"
                        : myProfile.portfolioVisibility === "PRIVATE"
                          ? "text-danger/60 border-danger/30"
                          : "text-warning/60 border-warning/30"
                    } bg-transparent`}
                  >
                    {VIS_ICON[myProfile.portfolioVisibility]} Portfolio{" "}
                    {VIS_LABEL[myProfile.portfolioVisibility]}
                  </Chip>
                </div>

                {closedTrades.length === 0 ? (
                  <EmptyState
                    icon="💼"
                    title="No closed paper trades yet."
                    sub="Close trades from the Dashboard. Portfolio analytics appear here automatically."
                  />
                ) : perf ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      {[
                        {
                          label: "Total Trades",
                          value: perf.totalTrades,
                          color: "text-fg",
                        },
                        {
                          label: "Win Rate",
                          value: `${perf.winRate}%`,
                          color:
                            perf.winRate >= 50
                              ? "text-success"
                              : "text-danger",
                          sub: `${perf.wins}W · ${perf.losses}L`,
                        },
                        {
                          label: "Net P&L",
                          value: `${perf.netPnl >= 0 ? "+" : ""}$${
                            perf.netPnl
                          }`,
                          color:
                            perf.netPnl >= 0
                              ? "text-success"
                              : "text-danger",
                          sub: "after 0.01% commission",
                        },
                        {
                          label: "ROI",
                          value: `${perf.roiPercent >= 0 ? "+" : ""}${
                            perf.roiPercent
                          }%`,
                          color:
                            perf.roiPercent >= 0
                              ? "text-success"
                              : "text-danger",
                          sub: `from $${PAPER_INITIAL_BALANCE.toLocaleString()}`,
                        },
                        {
                          label: "Profit Factor",
                          value:
                            perf.profitFactor === 999
                              ? "∞"
                              : perf.profitFactor,
                          color:
                            perf.profitFactor >= 1.5
                              ? "text-success"
                              : perf.profitFactor >= 1
                                ? "text-warning"
                                : "text-danger",
                        },
                        {
                          label: "Avg Duration",
                          value: formatDuration(perf.avgDurationMs),
                          color: "text-fg",
                        },
                        {
                          label: "Best Trade",
                          value: `+$${perf.bestTrade}`,
                          color: "text-success",
                        },
                        {
                          label: "Worst Trade",
                          value: `$${perf.worstTrade}`,
                          color: "text-danger",
                        },
                        {
                          label: "Avg Win",
                          value: `+$${perf.avgWin}`,
                          color: "text-success",
                          sub: `${perf.wins} wins`,
                        },
                        {
                          label: "Avg Loss",
                          value: `-$${perf.avgLoss}`,
                          color: "text-danger",
                          sub: `${perf.losses} losses`,
                        },
                        {
                          label: "SL Hits",
                          value: perf.slHits,
                          color: "text-danger",
                        },
                        {
                          label: "TP Hits",
                          value: perf.tpHits,
                          color: "text-success",
                        },
                      ].map(({ label, value, color, sub }) => (
                        <StatCard
                          key={label}
                          label={label}
                          value={value}
                          color={color}
                          sub={sub}
                        />
                      ))}
                    </div>

                    {symbolStats.length > 0 && (
                      <div className="glass border border-border rounded-xl overflow-hidden">
                        <p className="text-fg-dim text-xs uppercase tracking-wider px-5 py-3 border-b border-border">
                          Symbol Breakdown
                        </p>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-elevated">
                                {[
                                  "Symbol",
                                  "Trades",
                                  "Win Rate",
                                  "Net P&L",
                                  "Best",
                                  "Worst",
                                ].map((h) => (
                                  <th
                                    key={h}
                                    className={`py-3 px-5 text-fg-dim ${
                                      h === "Symbol"
                                        ? "text-left"
                                        : "text-right"
                                    }`}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>

                            <tbody>
                              {symbolStats.map((s) => (
                                <tr
                                  key={s.symbolId}
                                  className="border-b border-border hover:bg-elevated transition"
                                >
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                      <span>{s.emoji}</span>
                                      <div>
                                        <p className="text-fg font-medium">
                                          {s.displayName}
                                        </p>
                                        <p className="text-fg-dim capitalize">
                                          {s.category}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-5 py-3 text-right text-fg-muted">
                                    {s.trades}
                                  </td>

                                  <td
                                    className={`px-5 py-3 text-right font-semibold ${
                                      s.winRate >= 50
                                        ? "text-success"
                                        : "text-danger"
                                    }`}
                                  >
                                    {s.winRate}%
                                  </td>

                                  <td
                                    className={`px-5 py-3 text-right font-bold ${pnlClass(
                                      s.netPnl
                                    )}`}
                                  >
                                    {s.netPnl >= 0 ? "+" : ""}$
                                    {s.netPnl.toFixed(2)}
                                  </td>

                                  <td className="px-5 py-3 text-right text-success">
                                    +${s.bestTrade.toFixed(2)}
                                  </td>

                                  <td className="px-5 py-3 text-right text-danger">
                                    ${s.worstTrade.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}

                <div className="p-3 bg-elevated border border-border rounded-xl">
                  <p className="text-fg-dim text-xs leading-relaxed">
                    Paper trading only. Not broker-verified. Not real money.
                    Portfolio visibility is "{myProfile.portfolioVisibility.toLowerCase()}".
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════ POSTS ══════════════════════════ */}
            {activeTab === "posts" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-fg mb-0.5">
                    My Posts
                  </h2>
                  <p className="text-fg-dim text-xs">
                    {myPosts.length} post{myPosts.length !== 1 ? "s" : ""}
                  </p>
                </div>

                {myPosts.length === 0 ? (
                  <EmptyState
                    icon="💬"
                    title="No posts yet."
                    sub="Share your first trading thought, strategy idea, or journal lesson in Community."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {myPosts.map((post) => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ STRATEGIES ════════════════════ */}
            {activeTab === "strategies" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-fg mb-0.5">
                    Published Strategies
                  </h2>
                  <p className="text-fg-dim text-xs">
                    Creator-published by you
                  </p>
                </div>

                {publishedStrategies.length === 0 ? (
                  <EmptyState
                    icon="📋"
                    title="No published strategies yet."
                    sub="Publish a strategy from the Strategy Marketplace using the + Publish button."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {publishedStrategies.map((s: Strategy) => (
                      <div
                        key={s.id}
                        className="glass border border-border rounded-xl p-5 hover:border-border transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-fg font-semibold text-sm leading-snug flex-1 pr-2">
                            {s.title}
                          </h3>
                          {!s.verified && (
                            <Chip className="text-warning bg-warning-soft border-warning/30 shrink-0">
                              Not verified
                            </Chip>
                          )}
                        </div>

                        <p className="text-fg-dim text-xs leading-relaxed line-clamp-2 mb-3">
                          {s.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          <Chip className="text-fg-dim bg-elevated border-border capitalize">
                            {s.riskLevel.toLowerCase()} risk
                          </Chip>

                          <Chip className="text-fg-dim bg-elevated border-border">
                            {s.timeframe === "any" ? "Any TF" : s.timeframe}
                          </Chip>

                          <Chip className="text-fg-dim bg-elevated border-border capitalize">
                            {s.assetCategory === "all"
                              ? "All assets"
                              : s.assetCategory}
                          </Chip>

                          {s._count.reviews > 0 && (
                            <Chip className="text-fg-dim bg-elevated border-border">
                              {s._count.reviews} review
                              {s._count.reviews !== 1 ? "s" : ""}
                            </Chip>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {savedStrategyCount > 0 && (
                  <div className="p-4 glass border border-border rounded-xl">
                    <p className="text-fg-dim text-xs">
                      You also have{" "}
                      <span className="text-fg font-semibold">
                        {savedStrategyCount}
                      </span>{" "}
                      saved strategy record{savedStrategyCount !== 1 ? "s" : ""}{" "}
                      (not published strategies — use the Marketplace to view
                      them).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ ACADEMY ═══════════════════════ */}
            {activeTab === "academy" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-fg mb-0.5">
                    Academy Progress
                  </h2>
                  <p className="text-fg-dim text-xs">
                    Progress persists across sessions
                  </p>
                </div>

                {enrolledCourseIds.length === 0 ? (
                  <EmptyState
                    icon="🎓"
                    title="Not enrolled in any courses yet."
                    sub="Visit the Academy to enroll in official TCC courses and free educational resources."
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {courses
                      .filter((c: Course) => enrolledCourseIds.includes(c.id))
                      .map((course: Course) => {
                        const progress = myProgress[course.id];
                        if (!progress) return null;

                        const pct =
                          course.lessons.length > 0
                            ? Math.round(
                                (progress.completedLessons.length /
                                  course.lessons.length) *
                                  100
                              )
                            : 0;

                        const done = pct === 100;

                        return (
                          <div
                            key={course.id}
                            className="glass border border-border rounded-xl p-5 flex items-start gap-4"
                          >
                            <span className="text-3xl shrink-0 mt-0.5">
                              {course.thumbnail}
                            </span>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-fg font-semibold text-sm leading-snug">
                                  {course.title}
                                </p>

                                {done && (
                                  <Chip className="text-success bg-success-soft border-success/30 shrink-0">
                                    ✓ Completed
                                  </Chip>
                                )}
                              </div>

                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-fg-dim text-xs capitalize">
                                  {course.type.toLowerCase().replace(/_/g, " ")} ·{" "}
                                  {course.level.toLowerCase()}
                                </span>

                                <span
                                  className={`text-xs font-semibold ${
                                    done ? "text-success" : "text-fg-muted"
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </div>

                              <div className="w-full bg-elevated rounded-full h-1.5 mb-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    done ? "bg-success" : "bg-success-soft"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              {done && (
                                <p className="text-warning/60 text-xs">
                                  🏆 Certificate coming soon
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ COPY TRADING ══════════════════ */}
            {activeTab === "copy_trading" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-fg mb-0.5">
                    Copy Trading
                  </h2>
                  <p className="text-fg-dim text-xs">
                    Paper-copy mode only · No real broker execution
                  </p>
                </div>

                <CopyTradingTab
                  roles={user.roles}
                  onNavigate={(path) => router.push(path)}
                />
              </div>
            )}

            {/* ══════════════ SETTINGS ══════════════════════ */}
            {activeTab === "settings" && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-fg mb-0.5">
                    Profile Settings
                  </h2>
                  <p className="text-fg-dim text-xs">
                    Edit your profile, trading identity, and visibility
                    settings.
                  </p>
                </div>

                <SettingsTab profile={myProfile} />
              </div>
            )}
          </div>
        </div>
  );
}
