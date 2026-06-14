"use client";
/**
 * TCC Trader Profile — /profile
 * Day-9: Complete implementation
 *
 * 7 tabs: Overview / Portfolio / Posts / Strategies / Academy / Copy Trading / Settings
 *
 * All data from real local stores only.
 * No fake data. Paper trading only. Local-only.
 * Visibility enforced locally — backend enforcement in Phase Alpha.
 *
 * Fixed:
 * - Combined split code segments into one full file.
 * - Fixed broken social link <a> tags.
 * - Removed course.certificateStatus usage because Course type does not contain it.
 */

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// ── Stores ─────────────────────────────────────────────────────────────────
import { useAuthStore } from "@/store/authStore";
import {
  useProfileStore,
  type TCCUserProfile,
  type TCCUserRole,
  type ProfileVisibility,
  type PortfolioVisibility,
  type ExperienceLevel,
  type TCCTradingIdentity,
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
import {
  useMasterRegistryStore,
  useCopyTradingStore,
} from "@/store/copyTradingStore";

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
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

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

const ROLE_LABEL: Record<TCCUserRole, string> = {
  normal_user: "Trader",
  follower_trader: "Follower",
  verified_trader: "Verified",
  master_trader: "Master Trader",
  mentor: "Mentor",
  admin: "Admin",
  owner: "Owner",
};

const ROLE_CLASS: Record<TCCUserRole, string> = {
  normal_user: "text-white/50 bg-white/5 border-white/10",
  follower_trader: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  verified_trader: "text-green-400 bg-green-500/10 border-green-500/20",
  master_trader: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  mentor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  admin: "text-red-400 bg-red-500/10 border-red-500/20",
  owner: "text-red-400 bg-red-500/15 border-red-500/30",
};

const VIS_ICON: Record<string, string> = {
  public: "🌐",
  private: "🔒",
  followers_only: "👥",
};

const VIS_LABEL: Record<string, string> = {
  public: "Public",
  private: "Private",
  followers_only: "Followers Only",
};

const POST_TYPE_LABEL: Record<CommunityPostType, string> = {
  text: "💬 Text",
  trade_idea: "💡 Trade Idea",
  shared_trade: "📊 Shared Trade",
  academy_completion: "🎓 Academy",
  strategy_share: "📋 Strategy",
  competition_update: "🏆 Competition",
};

// ─────────────────────────────────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────────────────────────────────

function pnlClass(v: number): string {
  return v > 0.01
    ? "text-green-400"
    : v < -0.01
      ? "text-red-400"
      : "text-white/40";
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
      className={`${sz[size]} rounded-2xl bg-gradient-to-br from-green-500/25 to-green-700/15 border-2 border-green-500/30 flex items-center justify-center text-green-300 font-bold shrink-0 select-none`}
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
  color = "text-white",
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="glass border border-white/5 rounded-xl p-4">
      <p className="text-white/40 text-xs truncate mb-1">{label}</p>
      <p className={`text-xl font-bold truncate ${color}`}>{value}</p>
      {sub && (
        <p className="text-white/25 text-xs mt-0.5 leading-tight">{sub}</p>
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
      <p className="text-white/30 text-sm font-medium">{title}</p>
      {sub && (
        <p className="text-white/15 text-xs max-w-xs leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// POST CARD
// ─────────────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: CommunityPost }) {
  return (
    <div className="glass border border-white/5 rounded-xl p-4 hover:border-white/10 transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Chip className="text-white/40 bg-white/5 border-white/10">
          {POST_TYPE_LABEL[post.type]}
        </Chip>
        <span className="text-white/20 text-xs shrink-0">
          {new Date(post.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>

      <p className="text-white/70 text-sm leading-relaxed line-clamp-3 mb-3">
        {post.content}
      </p>

      {post.tradeSnapshot && (
        <div className="flex items-center gap-3 bg-white/3 border border-white/5 rounded-lg px-3 py-2 mb-3 text-xs">
          <span
            className={`font-semibold ${
              post.tradeSnapshot.side === "BUY"
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {post.tradeSnapshot.side}
          </span>
          <span className="text-white/60">
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

      <div className="flex items-center gap-4 text-xs text-white/25">
        <span>❤ {post.likes.length}</span>
        <span>💬 {post.comments.length}</span>
        <span>🔖 {post.savedBy.length}</span>
        <span
          className={`ml-auto ${
            post.visibility === "public"
              ? "text-green-400/40"
              : post.visibility === "followers_only"
                ? "text-amber-400/40"
                : "text-red-400/40"
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
  userId,
  onNavigate,
}: {
  userId: string;
  onNavigate: (path: string) => void;
}) {
  const { myApplication, getActiveRelationships } = useCopyTradingStore();
  const { getMasterByUserId } = useMasterRegistryStore();

  const myMasterProfile = getMasterByUserId(userId);
  const activeRels = getActiveRelationships();

  const isMasterActive = myMasterProfile?.status === "active";
  const isMasterSuspended = myMasterProfile?.status === "suspended";
  const isFollower = activeRels.length > 0;

  let bannerTitle = "👤 Not Participating";
  let bannerDesc = "You are not currently participating in copy trading.";
  let bannerCls = "border-white/5";

  if (isMasterActive) {
    bannerTitle = "🏆 Master Trader";
    bannerDesc =
      "You are an approved master trader. Paper-copy only — no live broker execution.";
    bannerCls = "border-amber-500/20 bg-amber-500/3";
  } else if (isMasterSuspended) {
    bannerTitle = "🚫 Master Trader (Suspended)";
    bannerDesc = "Your master trader status is suspended. Contact TCC admin.";
    bannerCls = "border-red-500/20 bg-red-500/3";
  } else if (isFollower) {
    bannerTitle = `📡 Active Follower — ${activeRels.length} copy relationship${
      activeRels.length > 1 ? "s" : ""
    }`;
    bannerDesc =
      "Copying master traders in paper-copy mode. No real broker execution.";
    bannerCls = "border-green-500/15 bg-green-500/3";
  } else if (myApplication) {
    const statusLabel: Record<string, string> = {
      draft: "📝 Draft Application",
      submitted: "📬 Application Submitted",
      under_review: "🔍 Under Review",
      more_info_required: "❓ More Info Requested",
      approved: "✅ Approved",
      rejected: "❌ Application Rejected",
      suspended: "🚫 Suspended",
    };
    bannerTitle = statusLabel[myApplication.status] ?? myApplication.status;
    bannerDesc = `Application status: ${myApplication.status.replace(
      /_/g,
      " "
    )}.`;
    bannerCls =
      myApplication.status === "submitted" ||
      myApplication.status === "under_review"
        ? "border-blue-500/15 bg-blue-500/3"
        : "border-white/5";
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Status banner */}
      <div className={`glass border rounded-xl p-5 ${bannerCls}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white font-semibold text-sm mb-1">
              {bannerTitle}
            </p>
            <p className="text-white/40 text-xs leading-relaxed">
              {bannerDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("/copy-trading")}
            className="bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 px-4 py-1.5 rounded-lg text-xs font-semibold transition shrink-0"
          >
            Open →
          </button>
        </div>
      </div>

      {/* Master trader profile detail */}
      {myMasterProfile && (
        <div className="glass border border-white/5 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
            Master Trader Profile
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-4">
            {[
              { l: "TCC ID", v: myMasterProfile.tccId },
              { l: "Status", v: myMasterProfile.status },
              {
                l: "Markets",
                v: myMasterProfile.marketsTraded.join(", ") || "—",
              },
              {
                l: "Strategies",
                v: myMasterProfile.strategiesUsed.join(", ") || "—",
              },
              {
                l: "Trust Score",
                v: myMasterProfile.trustScoreStatus.replace(/_/g, " "),
              },
              { l: "Broker", v: "Not connected (paper-copy only)" },
              { l: "Performance", v: "Not verified — local approval only" },
              {
                l: "Approved",
                v: new Date(myMasterProfile.approvedAt).toLocaleDateString(),
              },
            ].map((item) => (
              <div key={item.l} className="flex gap-2">
                <span className="text-white/30 w-24 shrink-0">{item.l}</span>
                <span className="text-white/60 capitalize">{item.v}</span>
              </div>
            ))}
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
            <p className="text-amber-400/70 text-xs leading-relaxed">
              ⚠ Local approval only. Performance not verified. Broker not
              connected. Paper-copy mode only until Phase Alpha.
            </p>
          </div>
        </div>
      )}

      {/* Application status detail */}
      {myApplication && !myMasterProfile && (
        <div className="glass border border-white/5 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
            Application Details
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-3">
            {[
              { l: "TCC ID", v: myApplication.tccId },
              {
                l: "Status",
                v: myApplication.status.replace(/_/g, " "),
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
                <span className="text-white/30 w-24 shrink-0">{item.l}</span>
                <span className="text-white/60 capitalize">{item.v}</span>
              </div>
            ))}
          </div>

          {myApplication.rejectionReason && (
            <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 mt-2">
              <p className="text-red-400 text-xs font-semibold mb-1">
                Rejection Reason
              </p>
              <p className="text-white/50 text-xs">
                {myApplication.rejectionReason}
              </p>
            </div>
          )}

          {myApplication.moreInfoRequest && (
            <div className="bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 mt-2">
              <p className="text-orange-400 text-xs font-semibold mb-1">
                Info Requested
              </p>
              <p className="text-white/50 text-xs">
                {myApplication.moreInfoRequest}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active copy relationships */}
      {activeRels.length > 0 && (
        <div className="glass border border-white/5 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">
            Active Copy Relationships ({activeRels.length})
          </p>

          {activeRels.map((rel) => (
            <div
              key={rel.id}
              className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
            >
              <div>
                <p className="text-white/70 text-sm font-medium">
                  {rel.masterDisplayName}
                </p>
                <p className="text-white/30 text-xs">
                  {rel.mode.replace(/_/g, " ")} · {rel.status}
                </p>
              </div>
              <Chip
                className={
                  rel.status === "active"
                    ? "text-green-400 bg-green-500/10 border-green-500/20"
                    : rel.status === "paused"
                      ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : "text-white/30 bg-white/5 border-white/10"
                }
              >
                {rel.status}
              </Chip>
            </div>
          ))}

          <p className="text-white/15 text-xs mt-3">
            All copy relationships are paper-copy only. No real broker orders
            placed.
          </p>
        </div>
      )}

      {/* Empty state — not participating at all */}
      {!isMasterActive &&
        !isMasterSuspended &&
        !isFollower &&
        !myApplication && (
          <EmptyState
            icon="📡"
            title="Not participating in copy trading yet."
            sub="Apply to become a master trader, or discover master traders to start paper-copy following. Paper-copy mode only."
          />
        )}

      <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
        <p className="text-white/15 text-xs leading-relaxed">
          Copy trading is paper-copy mode only. No real money involved. All data
          is local to this browser. Phase Alpha will require verified broker
          connections and real-time execution.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────

function SettingsTab({
  profile,
  onSave,
}: {
  profile: TCCUserProfile;
  onSave: (updates: Partial<TCCUserProfile>) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [location, setLocation] = useState(profile.location);
  const [profileVisibility, setProfileVisibility] =
    useState<ProfileVisibility>(profile.profileVisibility);
  const [portfolioVisibility, setPortfolioVisibility] =
    useState<PortfolioVisibility>(profile.portfolioVisibility);
  const [experienceLevel, setExperienceLevel] = useState<
    ExperienceLevel | ""
  >(profile.tradingIdentity.experienceLevel);
  const [marketsTraded, setMarketsTraded] = useState(
    profile.tradingIdentity.marketsTraded.join(", ")
  );
  const [symbolsTraded, setSymbolsTraded] = useState(
    profile.tradingIdentity.symbolsTraded.join(", ")
  );
  const [strategiesUsed, setStrategiesUsed] = useState(
    profile.tradingIdentity.strategiesUsed.join(", ")
  );
  const [preferredSessions, setPreferredSessions] = useState(
    profile.tradingIdentity.preferredSessions.join(", ")
  );
  const [website, setWebsite] = useState(profile.socialLinks.website ?? "");
  const [xHandle, setXHandle] = useState(profile.socialLinks.x ?? "");
  const [linkedin, setLinkedin] = useState(
    profile.socialLinks.linkedin ?? ""
  );
  const [youtube, setYoutube] = useState(profile.socialLinks.youtube ?? "");
  const [saved, setSaved] = useState(false);

  const split = (raw: string) =>
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = () => {
    const tradingIdentity: TCCTradingIdentity = {
      marketsTraded: split(marketsTraded),
      symbolsTraded: split(symbolsTraded),
      strategiesUsed: split(strategiesUsed),
      preferredSessions: split(preferredSessions),
      experienceLevel,
    };

    onSave({
      displayName,
      bio,
      location,
      profileVisibility,
      portfolioVisibility,
      tradingIdentity,
      socialLinks: {
        website: website || undefined,
        x: xHandle || undefined,
        linkedin: linkedin || undefined,
        youtube: youtube || undefined,
      },
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inputCls =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 placeholder-white/20 transition";

  const sectionCls = "glass border border-white/5 rounded-xl p-5";

  const VisOption = ({
    value,
    current,
    onChange,
  }: {
    value: ProfileVisibility | PortfolioVisibility;
    current: string;
    onChange: (v: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`w-full text-left px-3 py-2 rounded-lg text-xs border mb-1 transition ${
        current === value
          ? "bg-green-500/20 text-green-400 border-green-500/30"
          : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"
      }`}
    >
      {VIS_ICON[value]} {VIS_LABEL[value]}
    </button>
  );

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* ── Basic info ── */}
      <div className={sectionCls}>
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">
          Basic Information
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-white/40 text-xs mb-1">Display Name</p>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <p className="text-white/40 text-xs mb-1">Bio</p>
            <textarea
              value={bio}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other traders about yourself..."
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <p className="text-white/40 text-xs mb-1">Location</p>
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
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">
          Privacy & Visibility
          <span className="text-white/20 ml-2 normal-case">
            (locally enforced — backend in Phase Alpha)
          </span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/40 text-xs mb-1.5">Profile</p>
            {(["public", "followers_only", "private"] as ProfileVisibility[]).map(
              (v) => (
                <VisOption
                  key={v}
                  value={v}
                  current={profileVisibility}
                  onChange={(x) => setProfileVisibility(x as ProfileVisibility)}
                />
              )
            )}
          </div>

          <div>
            <p className="text-white/40 text-xs mb-1.5">Portfolio</p>
            {(["public", "followers_only", "private"] as PortfolioVisibility[]).map(
              (v) => (
                <VisOption
                  key={v}
                  value={v}
                  current={portfolioVisibility}
                  onChange={(x) =>
                    setPortfolioVisibility(x as PortfolioVisibility)
                  }
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* ── Trading identity ── */}
      <div className={sectionCls}>
        <p className="text-white/50 text-xs uppercase tracking-wider mb-1">
          Trading Identity
        </p>
        <p className="text-white/20 text-xs mb-4 leading-relaxed">
          Flexible — list as many markets, symbols, strategies, or sessions as
          you trade. Use comma-separated values.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-white/40 text-xs mb-1.5">Experience Level</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                ["", "beginner", "intermediate", "advanced", "professional"] as const
              ).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setExperienceLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-xs border capitalize transition ${
                    experienceLevel === lvl
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                  }`}
                >
                  {lvl === "" ? "Not set" : lvl}
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
              <p className="text-white/40 text-xs mb-1">
                {label}
                <span className="text-white/20 ml-1">(comma separated)</span>
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
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">
          Social Links{" "}
          <span className="text-white/20 normal-case">(optional)</span>
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
              <p className="text-white/40 text-xs mb-1">{label}</p>
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
        className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm font-semibold transition"
      >
        {saved ? "✓ Saved!" : "Save Changes"}
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

  // ── Profile ─────────────────────────────────────────────────────────────
  const {
    myProfile,
    initProfile,
    updateProfile,
    getFollowers,
    getFollowing,
  } = useProfileStore();

  // ── Trading data ─────────────────────────────────────────────────────────
  const { closedTrades, positions, balance, equity, floatingPnl } =
    useTradeStore();
  const { entries } = useJournalStore();

  // ── Academy ─────────────────────────────────────────────────────────────
  const { courses, userProgress } = useAcademyStore();

  // ── Strategies — userStrategies is UserStrategyRecord[], NOT Strategy[] ──
  const { strategies, userStrategies } = useStrategyStore();

  // ── Community posts ──────────────────────────────────────────────────────
  const allPosts = useCommunityStore((state) => state.posts);

  // ── Notifications ────────────────────────────────────────────────────────
  const { addNotification } = useNotificationStore();

  // ── Hydration guard ──────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Active tab ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // ── Init profile from auth user ──────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    if (user && !myProfile) {
      initProfile(
        user.id,
        user.tccId ?? "TCC-GL-TRD-XXXXXXXX",
        user.handle ?? user.email
      );
    }
  }, [mounted, user, myProfile, initProfile]);

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
    () => calculateSymbolAnalytics(closedTrades, TCC_SYMBOL_MAP as any),
    [closedTrades]
  );

  const sessionStats = useMemo(
    () => calculateSessionAnalytics(entries),
    [entries]
  );

  const myFollowers = useMemo(
    () => (user ? getFollowers(user.id) : []),
    [user, getFollowers]
  );

  const myFollowing = useMemo(
    () => (user ? getFollowing(user.id) : []),
    [user, getFollowing]
  );

  const myPosts = useMemo(
    () =>
      user
        ? allPosts
            .filter((p) => p.authorId === user.id && !p.isHiddenByAdmin)
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
        : [],
    [allPosts, user]
  );

  const publishedStrategies = useMemo<Strategy[]>(
    () =>
      user
        ? strategies.filter(
            (s: Strategy) =>
              s.type === "creator_published" &&
              s.authorHandle === (user.handle ?? user.email ?? "")
          )
        : [],
    [strategies, user]
  );

  const savedStrategyCount = userStrategies.length;

  const enrolledCourseIds = Object.keys(userProgress);

  const completedCourses = courses.filter((c: Course) => {
    const p = userProgress[c.id];
    return p && p.completedLessons.length >= c.lessons.length;
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

  if (!mounted || !user || !myProfile) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/30 text-sm animate-pulse">
              {!user ? "Redirecting to login..." : "Loading profile..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const ti = myProfile.tradingIdentity;

  const hasIdentity =
    ti.marketsTraded.length > 0 ||
    ti.symbolsTraded.length > 0 ||
    ti.strategiesUsed.length > 0 ||
    ti.preferredSessions.length > 0 ||
    !!ti.experienceLevel;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          {/* ════════════════════════════════════════════════
              PROFILE HEADER
          ════════════════════════════════════════════════ */}
          <div className="glass border-b border-white/5 px-6 py-5">
            <div className="flex items-start gap-6 flex-wrap">
              <Avatar
                name={myProfile.displayName || myProfile.username}
                size="xl"
              />

              <div className="flex-1 min-w-0">
                {/* Name row */}
                <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
                  <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">
                      {myProfile.displayName || myProfile.username}
                    </h1>
                    <p className="text-white/40 text-sm">
                      @{myProfile.username}
                    </p>
                    {myProfile.tccId && (
                      <p className="text-green-400/60 font-mono text-xs mt-0.5">
                        {myProfile.tccId}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip
                      className={`${
                        myProfile.profileVisibility === "public"
                          ? "text-green-400/70 border-green-500/20"
                          : myProfile.profileVisibility === "private"
                            ? "text-red-400/60 border-red-500/20"
                            : "text-amber-400/60 border-amber-500/20"
                      } bg-transparent`}
                    >
                      {VIS_ICON[myProfile.profileVisibility]} Profile{" "}
                      {VIS_LABEL[myProfile.profileVisibility]}
                    </Chip>

                    <button
                      type="button"
                      onClick={() => setActiveTab("settings")}
                      className="bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 px-4 py-1.5 rounded-lg text-xs font-semibold transition"
                    >
                      ✏ Edit Profile
                    </button>
                  </div>
                </div>

                {/* Bio */}
                {myProfile.bio ? (
                  <p className="text-white/55 text-sm mt-2 leading-relaxed max-w-2xl">
                    {myProfile.bio}
                  </p>
                ) : (
                  <p className="text-white/20 text-sm mt-2 italic">
                    No bio yet — add one in Settings
                  </p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap gap-4 mt-2 text-xs text-white/40">
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

                  {myProfile.socialLinks.x && (
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

                  {myProfile.socialLinks.website && (
                    <a
                      href={myProfile.socialLinks.website}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-white transition"
                    >
                      🌐 Website
                    </a>
                  )}

                  {myProfile.socialLinks.linkedin && (
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

                  {myProfile.socialLinks.youtube && (
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
                      className="hover:text-red-400 transition"
                    >
                      YouTube
                    </a>
                  )}
                </div>

                {/* Role badges + social counts */}
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {myProfile.roles.map((role) => (
                    <Chip key={role} className={ROLE_CLASS[role]}>
                      {ROLE_LABEL[role]}
                    </Chip>
                  ))}

                  <div className="h-4 w-px bg-white/10 mx-1" />

                  <div className="flex gap-4 text-xs text-white/50">
                    <span>
                      <span className="text-white font-bold">
                        {myFollowers.length}
                      </span>{" "}
                      followers
                    </span>

                    <span>
                      <span className="text-white font-bold">
                        {myFollowing.length}
                      </span>{" "}
                      following
                    </span>

                    <span>
                      <span className="text-white font-bold">
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
                      ? "bg-green-500/20 text-green-400"
                      : "text-white/40 hover:text-white/60 hover:bg-white/5"
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
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-4">
                    Trading Identity
                  </p>

                  {!hasIdentity ? (
                    <p className="text-white/20 text-sm">
                      No trading identity set yet.{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("settings")}
                        className="text-green-400/60 hover:text-green-400 underline transition"
                      >
                        Add in Settings →
                      </button>
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {ti.experienceLevel && (
                        <div className="flex items-start gap-3">
                          <span className="text-white/30 text-xs w-28 shrink-0 pt-0.5">
                            Experience
                          </span>
                          <Chip className="text-white/70 bg-white/5 border-white/10 capitalize">
                            {ti.experienceLevel}
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
                            <span className="text-white/30 text-xs w-28 shrink-0 pt-0.5">
                              {label}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {items.map((item) => (
                                <Chip
                                  key={item}
                                  className="text-white/60 bg-white/5 border-white/10 capitalize"
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
                              ? "text-green-400"
                              : "text-red-400"
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
                              ? "text-green-400"
                              : "text-red-400"
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
                              ? "text-green-400"
                              : perf.profitFactor >= 1
                                ? "text-amber-400"
                                : "text-red-400"
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
                            ? "text-green-400"
                            : disciplineScore.total >= 50
                              ? "text-amber-400"
                              : "text-red-400"
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
                      <div className="glass border border-green-500/10 bg-green-500/3 rounded-xl p-4">
                        <p className="text-white/40 text-xs mb-2">
                          Best Symbol (Paper)
                        </p>
                        <p className="text-white font-semibold">
                          {bestSymbol.displayName}
                        </p>
                        <p
                          className={`text-sm font-bold mt-1 ${
                            bestSymbol.netPnl >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {bestSymbol.netPnl >= 0 ? "+" : ""}$
                          {bestSymbol.netPnl.toFixed(2)} ·{" "}
                          {bestSymbol.winRate}% WR
                        </p>
                      </div>
                    )}

                    {mostTraded && (
                      <div className="glass border border-white/5 rounded-xl p-4">
                        <p className="text-white/40 text-xs mb-2">
                          Most Traded
                        </p>
                        <p className="text-white font-semibold">
                          {mostTraded.displayName}
                        </p>
                        <p className="text-white/50 text-sm mt-1">
                          {mostTraded.trades} trade
                          {mostTraded.trades !== 1 ? "s" : ""}
                        </p>
                      </div>
                    )}

                    {bestSession && (
                      <div className="glass border border-white/5 rounded-xl p-4">
                        <p className="text-white/40 text-xs mb-2">
                          Best Session (Paper)
                        </p>
                        <p className="text-white font-semibold capitalize">
                          {bestSession.session}
                        </p>
                        <p
                          className={`text-sm font-bold mt-1 ${
                            bestSession.netPnl >= 0
                              ? "text-green-400"
                              : "text-red-400"
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
                  <div className="glass border border-white/5 rounded-xl p-4">
                    <p className="text-white/40 text-xs mb-2">Academy</p>

                    {enrolledCourseIds.length === 0 ? (
                      <p className="text-white/20 text-sm">
                        Not enrolled in any courses yet.
                      </p>
                    ) : (
                      <>
                        <p className="text-white text-sm">
                          {completedCourses.length}/{enrolledCourseIds.length}{" "}
                          courses completed
                        </p>
                        <p className="text-white/30 text-xs mt-0.5">
                          Certificates coming soon
                        </p>
                      </>
                    )}
                  </div>

                  <div className="glass border border-white/5 rounded-xl p-4">
                    <p className="text-white/40 text-xs mb-2">Strategies</p>

                    {publishedStrategies.length === 0 &&
                    savedStrategyCount === 0 ? (
                      <p className="text-white/20 text-sm">
                        No strategies saved or published yet.
                      </p>
                    ) : (
                      <>
                        <p className="text-white text-sm">
                          {publishedStrategies.length} published ·{" "}
                          {savedStrategyCount} saved
                        </p>
                        <p className="text-white/30 text-xs mt-0.5">
                          Local-only
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                  <p className="text-white/15 text-xs leading-relaxed">
                    All stats are derived from local paper trading data only.
                    Not verified. Not broker-connected. Phase Beta — local only.
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════ PORTFOLIO ══════════════════════ */}
            {activeTab === "portfolio" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Portfolio</h2>
                    <p className="text-white/30 text-xs mt-0.5">
                      Paper trading performance · Local data only
                    </p>
                  </div>

                  <Chip
                    className={`${
                      myProfile.portfolioVisibility === "public"
                        ? "text-green-400/70 border-green-500/20"
                        : myProfile.portfolioVisibility === "private"
                          ? "text-red-400/60 border-red-500/20"
                          : "text-amber-400/60 border-amber-500/20"
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
                          color: "text-white",
                        },
                        {
                          label: "Win Rate",
                          value: `${perf.winRate}%`,
                          color:
                            perf.winRate >= 50
                              ? "text-green-400"
                              : "text-red-400",
                          sub: `${perf.wins}W · ${perf.losses}L`,
                        },
                        {
                          label: "Net P&L",
                          value: `${perf.netPnl >= 0 ? "+" : ""}$${
                            perf.netPnl
                          }`,
                          color:
                            perf.netPnl >= 0
                              ? "text-green-400"
                              : "text-red-400",
                          sub: "after 0.01% commission",
                        },
                        {
                          label: "ROI",
                          value: `${perf.roiPercent >= 0 ? "+" : ""}${
                            perf.roiPercent
                          }%`,
                          color:
                            perf.roiPercent >= 0
                              ? "text-green-400"
                              : "text-red-400",
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
                              ? "text-green-400"
                              : perf.profitFactor >= 1
                                ? "text-amber-400"
                                : "text-red-400",
                        },
                        {
                          label: "Avg Duration",
                          value: formatDuration(perf.avgDurationMs),
                          color: "text-white",
                        },
                        {
                          label: "Best Trade",
                          value: `+$${perf.bestTrade}`,
                          color: "text-green-400",
                        },
                        {
                          label: "Worst Trade",
                          value: `$${perf.worstTrade}`,
                          color: "text-red-400",
                        },
                        {
                          label: "Avg Win",
                          value: `+$${perf.avgWin}`,
                          color: "text-green-400",
                          sub: `${perf.wins} wins`,
                        },
                        {
                          label: "Avg Loss",
                          value: `-$${perf.avgLoss}`,
                          color: "text-red-400",
                          sub: `${perf.losses} losses`,
                        },
                        {
                          label: "SL Hits",
                          value: perf.slHits,
                          color: "text-red-400",
                        },
                        {
                          label: "TP Hits",
                          value: perf.tpHits,
                          color: "text-green-400",
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
                      <div className="glass border border-white/5 rounded-xl overflow-hidden">
                        <p className="text-white/40 text-xs uppercase tracking-wider px-5 py-3 border-b border-white/5">
                          Symbol Breakdown
                        </p>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-white/5 bg-white/2">
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
                                    className={`py-3 px-5 text-white/40 ${
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
                                  className="border-b border-white/5 hover:bg-white/2 transition"
                                >
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                      <span>{s.emoji}</span>
                                      <div>
                                        <p className="text-white font-medium">
                                          {s.displayName}
                                        </p>
                                        <p className="text-white/30 capitalize">
                                          {s.category}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  <td className="px-5 py-3 text-right text-white/60">
                                    {s.trades}
                                  </td>

                                  <td
                                    className={`px-5 py-3 text-right font-semibold ${
                                      s.winRate >= 50
                                        ? "text-green-400"
                                        : "text-red-400"
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

                                  <td className="px-5 py-3 text-right text-green-400">
                                    +${s.bestTrade.toFixed(2)}
                                  </td>

                                  <td className="px-5 py-3 text-right text-red-400">
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

                <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                  <p className="text-white/15 text-xs leading-relaxed">
                    Paper trading only. Not broker-verified. Not real money.
                    Portfolio visibility is "{myProfile.portfolioVisibility}" —
                    enforced locally until backend is connected in Phase Alpha.
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════ POSTS ══════════════════════════ */}
            {activeTab === "posts" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white mb-0.5">
                    My Posts
                  </h2>
                  <p className="text-white/30 text-xs">
                    {myPosts.length} post{myPosts.length !== 1 ? "s" : ""} ·
                    Local community only
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
                  <h2 className="text-lg font-bold text-white mb-0.5">
                    Published Strategies
                  </h2>
                  <p className="text-white/30 text-xs">
                    Local-only · Not verified · Creator-published by you
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
                        className="glass border border-white/5 rounded-xl p-5 hover:border-white/10 transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-white font-semibold text-sm leading-snug flex-1 pr-2">
                            {s.title}
                          </h3>
                          <Chip className="text-amber-400 bg-amber-500/10 border-amber-500/20 shrink-0">
                            Not verified
                          </Chip>
                        </div>

                        <p className="text-white/40 text-xs leading-relaxed line-clamp-2 mb-3">
                          {s.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          <Chip className="text-white/30 bg-white/5 border-white/10 capitalize">
                            {s.riskLevel} risk
                          </Chip>

                          <Chip className="text-white/30 bg-white/5 border-white/10">
                            {s.timeframe === "any" ? "Any TF" : s.timeframe}
                          </Chip>

                          <Chip className="text-white/30 bg-white/5 border-white/10 capitalize">
                            {s.assetCategory === "all"
                              ? "All assets"
                              : s.assetCategory}
                          </Chip>

                          {s.reviews.length > 0 && (
                            <Chip className="text-white/30 bg-white/5 border-white/10">
                              {s.reviews.length} review
                              {s.reviews.length !== 1 ? "s" : ""}
                            </Chip>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {savedStrategyCount > 0 && (
                  <div className="p-4 glass border border-white/5 rounded-xl">
                    <p className="text-white/40 text-xs">
                      You also have{" "}
                      <span className="text-white font-semibold">
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
                  <h2 className="text-lg font-bold text-white mb-0.5">
                    Academy Progress
                  </h2>
                  <p className="text-white/30 text-xs">
                    Saved locally per user · Progress persists after refresh
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
                        const progress = userProgress[course.id];

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
                            className="glass border border-white/5 rounded-xl p-5 flex items-start gap-4"
                          >
                            <span className="text-3xl shrink-0 mt-0.5">
                              {course.thumbnail}
                            </span>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-white font-semibold text-sm leading-snug">
                                  {course.title}
                                </p>

                                {done && (
                                  <Chip className="text-green-400 bg-green-500/10 border-green-500/20 shrink-0">
                                    ✓ Completed
                                  </Chip>
                                )}
                              </div>

                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-white/40 text-xs capitalize">
                                  {course.type.replace(/_/g, " ")} ·{" "}
                                  {course.level}
                                </span>

                                <span
                                  className={`text-xs font-semibold ${
                                    done ? "text-green-400" : "text-white/50"
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </div>

                              <div className="w-full bg-white/5 rounded-full h-1.5 mb-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    done ? "bg-green-400" : "bg-green-500/50"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>

                              {done && (
                                <p className="text-amber-400/60 text-xs">
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
                  <h2 className="text-lg font-bold text-white mb-0.5">
                    Copy Trading
                  </h2>
                  <p className="text-white/30 text-xs">
                    Paper-copy mode only · No real broker execution
                  </p>
                </div>

                <CopyTradingTab
                  userId={user.id}
                  onNavigate={(path) => router.push(path)}
                />
              </div>
            )}

            {/* ══════════════ SETTINGS ══════════════════════ */}
            {activeTab === "settings" && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white mb-0.5">
                    Profile Settings
                  </h2>
                  <p className="text-white/30 text-xs">
                    Edit your profile, trading identity, and visibility
                    settings. All data stored locally.
                  </p>
                </div>

                <SettingsTab
                  profile={myProfile}
                  onSave={(updates) => {
                    updateProfile(updates);

                    addNotification({
                      type: "system",
                      priority: "low",
                      title: "✅ Profile Updated",
                      message: "Your profile changes have been saved locally.",
                    });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}