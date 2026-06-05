"use client";
/**
 * TCC Trader Profile Page — /profile
 *
 * Shows current user's own trading identity and profile.
 * All stats derived from real stores — no fake data.
 *
 * Viewing another user's profile requires a backend (Phase Alpha).
 * This page is the current-user's profile only.
 */
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  useProfileStore,
  TCCUserProfile,
  TCCUserRole,
  ProfileVisibility,
  PortfolioVisibility,
  ExperienceLevel,
  TCCTradingIdentity,
} from "@/store/profileStore";
import { useTradeStore } from "@/store/tradeStore";
import { useJournalStore } from "@/store/journalStore";
import { useAcademyStore } from "@/store/academyStore";
import { useStrategyStore } from "@/store/strategyStore";
import { useCommunityStore } from "@/store/communityStore";
import { useNotificationStore } from "@/store/notificationStore";
import {
  calculatePerformanceOverview,
  calculateDisciplineScore,
  calculateSymbolAnalytics,
  calculateSessionAnalytics,
  formatDuration,
  PAPER_INITIAL_BALANCE,
} from "@/lib/analytics/performance";
import { TCC_SYMBOL_MAP } from "@/lib/markets/symbols";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import ReportButton from "@/components/ReportButton";

// ── Helpers ───────────────────────────────────────────────────────────────

type ProfileTab =
  | "overview"
  | "portfolio"
  | "posts"
  | "strategies"
  | "academy"
  | "settings";

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: "overview",   label: "Overview"   },
  { key: "portfolio",  label: "Portfolio"  },
  { key: "posts",      label: "Posts"      },
  { key: "strategies", label: "Strategies" },
  { key: "academy",    label: "Academy"    },
  { key: "settings",   label: "Settings"   },
];

const ROLE_LABELS: Record<TCCUserRole, string> = {
  normal_user:     "Trader",
  follower_trader: "Follower",
  verified_trader: "Verified Trader",
  master_trader:   "Master Trader",
  mentor:          "Mentor",
  admin:           "Admin",
  owner:           "Owner",
};

const ROLE_COLORS: Record<TCCUserRole, string> = {
  normal_user:     "text-white/50    bg-white/5     border-white/10",
  follower_trader: "text-blue-400    bg-blue-500/10  border-blue-500/20",
  verified_trader: "text-green-400   bg-green-500/10 border-green-500/20",
  master_trader:   "text-amber-400   bg-amber-500/10 border-amber-500/20",
  mentor:          "text-purple-400  bg-purple-500/10 border-purple-500/20",
  admin:           "text-red-400     bg-red-500/10   border-red-500/20",
  owner:           "text-red-400     bg-red-500/15   border-red-500/30",
};

const VISIBILITY_ICONS: Record<ProfileVisibility | PortfolioVisibility, string> = {
  public:          "🌐",
  private:         "🔒",
  followers_only:  "👥",
};

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
      <p className="text-white/40 text-xs mb-1 truncate">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-white/25 text-xs mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

function pnlColor(v: number) {
  return v > 0.01 ? "text-green-400" : v < -0.01 ? "text-red-400" : "text-white/40";
}

function EmptyCard({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="glass border border-white/5 rounded-xl p-8 text-center">
      <p className="text-white/30 text-sm">{message}</p>
      {sub && <p className="text-white/15 text-xs mt-1 leading-relaxed">{sub}</p>}
    </div>
  );
}

// ── Profile Avatar ─────────────────────────────────────────────────────────

function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm:  "w-8  h-8  text-sm",
    md:  "w-12 h-12 text-lg",
    lg:  "w-16 h-16 text-2xl",
    xl:  "w-24 h-24 text-4xl",
  };
  return (
    <div
      className={`${sizes[size]} rounded-2xl bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center text-green-400 font-bold shrink-0`}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ── Post card (mini) ──────────────────────────────────────────────────────

function MiniPostCard({ post }: { post: ReturnType<typeof useCommunityStore.getState>["posts"][0] }) {
  const typeLabel: Record<string, string> = {
    text:                "💬 Text",
    trade_idea:          "💡 Trade Idea",
    shared_trade:        "📊 Shared Trade",
    academy_completion:  "🎓 Academy",
    strategy_share:      "📋 Strategy",
    competition_update:  "🏆 Competition",
  };

  return (
    <div className="glass border border-white/5 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="text-xs text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
          {typeLabel[post.type] ?? post.type}
        </span>
        <span className="text-white/20 text-xs shrink-0">
          {new Date(post.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className="text-white/70 text-sm leading-relaxed line-clamp-3">{post.content}</p>
      {post.tradeSnapshot && (
        <div className="mt-2 p-2 bg-white/3 border border-white/5 rounded-lg flex items-center gap-3 text-xs">
          <span className={post.tradeSnapshot.side === "BUY" ? "text-green-400" : "text-red-400"}>
            {post.tradeSnapshot.side}
          </span>
          <span className="text-white/60">{post.tradeSnapshot.displayName}</span>
          <span className={`font-bold ml-auto ${pnlColor(post.tradeSnapshot.netPnl)}`}>
            {post.tradeSnapshot.netPnl >= 0 ? "+" : ""}${post.tradeSnapshot.netPnl.toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex items-center gap-4 mt-3 text-xs text-white/30">
        <span>❤ {post.likes.length}</span>
        <span>💬 {post.comments.length}</span>
        <span>🔖 {post.savedBy.length}</span>
      </div>
    </div>
  );
}

// ── Settings form ─────────────────────────────────────────────────────────

function SettingsTab({ profile, onSave }: { profile: TCCUserProfile; onSave: (updates: Partial<TCCUserProfile>) => void }) {
  const [form, setForm] = useState({
    displayName:         profile.displayName,
    bio:                 profile.bio,
    location:            profile.location,
    profileVisibility:   profile.profileVisibility   as ProfileVisibility,
    portfolioVisibility: profile.portfolioVisibility as PortfolioVisibility,
    experienceLevel:     profile.tradingIdentity.experienceLevel as ExperienceLevel | "",
    marketsTraded:       profile.tradingIdentity.marketsTraded.join(", "),
    strategiesUsed:      profile.tradingIdentity.strategiesUsed.join(", "),
    preferredSessions:   profile.tradingIdentity.preferredSessions.join(", "),
    website:   profile.socialLinks.website   ?? "",
    x:         profile.socialLinks.x         ?? "",
    linkedin:  profile.socialLinks.linkedin  ?? "",
    youtube:   profile.socialLinks.youtube   ?? "",
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const tradingIdentity: TCCTradingIdentity = {
      marketsTraded:     form.marketsTraded.split(",").map(s => s.trim()).filter(Boolean),
      symbolsTraded:     profile.tradingIdentity.symbolsTraded,
      strategiesUsed:    form.strategiesUsed.split(",").map(s => s.trim()).filter(Boolean),
      preferredSessions: form.preferredSessions.split(",").map(s => s.trim()).filter(Boolean),
      experienceLevel:   form.experienceLevel,
    };
    onSave({
      displayName:         form.displayName,
      bio:                 form.bio,
      location:            form.location,
      profileVisibility:   form.profileVisibility,
      portfolioVisibility: form.portfolioVisibility,
      tradingIdentity,
      socialLinks: {
        website:  form.website  || undefined,
        x:        form.x        || undefined,
        linkedin: form.linkedin || undefined,
        youtube:  form.youtube  || undefined,
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="glass border border-white/5 rounded-xl p-5">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Basic Information</p>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-white/40 text-xs mb-1">Display Name</p>
            <input value={form.displayName}
              onChange={e => setForm({ ...form, displayName: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Bio</p>
            <textarea value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              rows={3}
              placeholder="Tell other traders about yourself..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-white/25 placeholder-white/20" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Location</p>
            <input value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. London, UK"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
          </div>
        </div>
      </div>

      <div className="glass border border-white/5 rounded-xl p-5">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Privacy & Visibility</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/40 text-xs mb-1.5">Profile Visibility</p>
            {(["public","followers_only","private"] as ProfileVisibility[]).map(v => (
              <button key={v} onClick={() => setForm({ ...form, profileVisibility: v })}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border mb-1 transition ${form.profileVisibility === v ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"}`}>
                {VISIBILITY_ICONS[v]} {v.replace(/_/g, " ")}
              </button>
            ))}
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1.5">Portfolio Visibility</p>
            {(["public","followers_only","private"] as PortfolioVisibility[]).map(v => (
              <button key={v} onClick={() => setForm({ ...form, portfolioVisibility: v })}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border mb-1 transition ${form.portfolioVisibility === v ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"}`}>
                {VISIBILITY_ICONS[v]} {v.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass border border-white/5 rounded-xl p-5">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Trading Identity</p>
        <p className="text-white/20 text-xs mb-4 leading-relaxed">
          Define your trading identity — be as flexible or specific as you like.
          You can trade multiple markets, use multiple strategies, and trade in multiple sessions.
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-white/40 text-xs mb-1">Experience Level</p>
            <div className="flex gap-2 flex-wrap">
              {(["","beginner","intermediate","advanced","professional"] as const).map(level => (
                <button key={level} onClick={() => setForm({ ...form, experienceLevel: level })}
                  className={`px-3 py-1.5 rounded-lg text-xs border capitalize transition ${form.experienceLevel === level ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
                  {level === "" ? "Not set" : level}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Markets Traded <span className="text-white/20">(comma separated)</span></p>
            <input value={form.marketsTraded}
              onChange={e => setForm({ ...form, marketsTraded: e.target.value })}
              placeholder="e.g. Crypto, Forex, Gold"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Strategies Used <span className="text-white/20">(comma separated)</span></p>
            <input value={form.strategiesUsed}
              onChange={e => setForm({ ...form, strategiesUsed: e.target.value })}
              placeholder="e.g. SMC, Price Action, EMA Crossover"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
          </div>
          <div>
            <p className="text-white/40 text-xs mb-1">Preferred Sessions <span className="text-white/20">(comma separated)</span></p>
            <input value={form.preferredSessions}
              onChange={e => setForm({ ...form, preferredSessions: e.target.value })}
              placeholder="e.g. London, New York"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
          </div>
        </div>
      </div>

      <div className="glass border border-white/5 rounded-xl p-5">
        <p className="text-white/50 text-xs uppercase tracking-wider mb-4">Social Links <span className="text-white/20 normal-case">(optional)</span></p>
        <div className="flex flex-col gap-3">
          {[
            { label: "Website", key: "website" as const, placeholder: "https://yoursite.com" },
            { label: "X / Twitter", key: "x" as const, placeholder: "@handle" },
            { label: "LinkedIn", key: "linkedin" as const, placeholder: "linkedin.com/in/handle" },
            { label: "YouTube", key: "youtube" as const, placeholder: "youtube.com/@channel" },
          ].map(field => (
            <div key={field.key}>
              <p className="text-white/40 text-xs mb-1">{field.label}</p>
              <input value={form[field.key]}
                onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25 placeholder-white/20" />
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave}
        className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 py-3 rounded-xl text-sm font-semibold transition">
        {saved ? "✓ Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    myProfile, initProfile, updateProfile,
    getFollowers, getFollowing,
  } = useProfileStore();
  const {
    closedTrades, positions, balance, equity, floatingPnl,
  } = useTradeStore();
  const { entries }       = useJournalStore();
  const { courses, userProgress } = useAcademyStore();
  const { publishedStrategies, userStrategies } = useStrategyStore();
  const { getUserPosts }  = useCommunityStore();
  const { addNotification } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // Initialize profile from auth data
  useEffect(() => {
    if (user) {
      initProfile(user.id, user.tccId || "TCC-GL-TRD-XXXXXXXX", user.handle || user.email);
    }
  }, [user, initProfile]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  // ── Derived stats ───────────────────────────────────────────────────────

  const perf = useMemo(() => {
    if (closedTrades.length === 0) return null;
    return calculatePerformanceOverview(
      closedTrades, balance, equity, floatingPnl, positions
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

  const myPosts             = user ? getUserPosts(user.id) : [];
  const myFollowers         = user ? getFollowers(user.id) : [];
  const myFollowing         = user ? getFollowing(user.id) : [];
  const enrolledCourses     = Object.keys(userProgress);
  const completedCourses    = courses.filter(c => {
    const p = userProgress[c.id];
    return p && p.completedLessons.length >= c.lessons.length;
  });
  const savedStrategyCount  = userStrategies.length;

  const bestSymbol = symbolStats.length > 0
    ? symbolStats.reduce((best, s) => s.netPnl > best.netPnl ? s : best, symbolStats[0])
    : null;

  const mostTradedSymbol = symbolStats.length > 0
    ? symbolStats.reduce((most, s) => s.trades > most.trades ? s : most, symbolStats[0])
    : null;

  const bestSession = sessionStats.length > 0
    ? sessionStats.reduce((best, s) => s.netPnl > best.netPnl ? s : best, sessionStats[0])
    : null;

  // ── Render ──────────────────────────────────────────────────────────────

  if (!user || !myProfile) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/30 text-sm animate-pulse">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">

          {/* ── Profile Header ─────────────────────────────────────────── */}
          <div className="glass border-b border-white/5 p-6">
            <div className="flex items-start gap-6">

              {/* Avatar */}
              <Avatar name={myProfile.displayName || myProfile.username} size="xl" />

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      {myProfile.displayName || myProfile.username}
                    </h1>
                    <p className="text-white/40 text-sm mt-0.5">@{myProfile.username}</p>
                    {myProfile.tccId && (
                      <p className="text-green-400/60 font-mono text-xs mt-0.5">{myProfile.tccId}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      myProfile.profileVisibility === "public" ? "text-green-400/60 border-green-500/20"
                      : myProfile.profileVisibility === "private" ? "text-red-400/60 border-red-500/20"
                      : "text-amber-400/60 border-amber-500/20"
                    }`}>
                      {VISIBILITY_ICONS[myProfile.profileVisibility]} Profile {myProfile.profileVisibility.replace(/_/g, " ")}
                    </span>
                    <button onClick={() => setActiveTab("settings")}
                      className="bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 px-4 py-1.5 rounded-lg text-xs font-semibold transition">
                      ✏ Edit Profile
                    </button>
                  </div>
                </div>

                {/* Bio */}
                {myProfile.bio ? (
                  <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-2xl">{myProfile.bio}</p>
                ) : (
                  <p className="text-white/20 text-sm mt-3 italic">No bio yet — add one in Settings</p>
                )}

                {/* Meta row */}
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-white/40">
                  {myProfile.location && <span>📍 {myProfile.location}</span>}
                  <span>📅 Joined {new Date(myProfile.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
                  {myProfile.socialLinks.x        && <a href={`https://x.com/${myProfile.socialLinks.x.replace("@","")}`} target="_blank" rel="noreferrer" className="text-blue-400/60 hover:text-blue-400">𝕏 {myProfile.socialLinks.x}</a>}
                  {myProfile.socialLinks.website  && <a href={myProfile.socialLinks.website} target="_blank" rel="noreferrer" className="text-white/50 hover:text-white">🌐 Website</a>}
                </div>

                {/* Roles + Stats row */}
                <div className="flex items-center gap-4 mt-4 flex-wrap">
                  {myProfile.roles.map(role => (
                    <span key={role} className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}>
                      {ROLE_LABELS[role]}
                    </span>
                  ))}
                  <div className="h-4 w-px bg-white/10" />
                  <div className="flex gap-4 text-xs">
                    <span className="text-white/60"><span className="text-white font-bold">{myFollowers.length}</span> followers</span>
                    <span className="text-white/60"><span className="text-white font-bold">{myFollowing.length}</span> following</span>
                    <span className="text-white/60"><span className="text-white font-bold">{myPosts.length}</span> posts</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 mt-5 overflow-x-auto">
              {PROFILE_TABS.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    activeTab === tab.key
                      ? "bg-green-500/20 text-green-400"
                      : "text-white/40 hover:text-white/60 hover:bg-white/5"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tab content ────────────────────────────────────────────── */}
          <div className="p-6">

            {/* ══ OVERVIEW ═══════════════════════════════════════════════ */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-6">

                {/* Trading identity */}
                <div className="glass border border-white/5 rounded-xl p-5">
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Trading Identity</p>
                  {(myProfile.tradingIdentity.marketsTraded.length === 0 &&
                    myProfile.tradingIdentity.strategiesUsed.length === 0 &&
                    myProfile.tradingIdentity.preferredSessions.length === 0 &&
                    !myProfile.tradingIdentity.experienceLevel) ? (
                    <p className="text-white/20 text-sm">
                      No trading identity set yet.{" "}
                      <button onClick={() => setActiveTab("settings")} className="text-green-400/60 hover:text-green-400 underline">
                        Add in Settings →
                      </button>
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {myProfile.tradingIdentity.experienceLevel && (
                        <div>
                          <p className="text-white/30 text-xs mb-2">Experience</p>
                          <span className="text-xs px-2 py-1 rounded-full border text-white/70 bg-white/5 border-white/10 capitalize">
                            {myProfile.tradingIdentity.experienceLevel}
                          </span>
                        </div>
                      )}
                      {myProfile.tradingIdentity.marketsTraded.length > 0 && (
                        <div>
                          <p className="text-white/30 text-xs mb-2">Markets</p>
                          <div className="flex flex-wrap gap-1">
                            {myProfile.tradingIdentity.marketsTraded.map(m => (
                              <span key={m} className="text-xs bg-blue-500/10 text-blue-400/80 border border-blue-500/20 px-2 py-0.5 rounded-full">{m}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {myProfile.tradingIdentity.strategiesUsed.length > 0 && (
                        <div>
                          <p className="text-white/30 text-xs mb-2">Strategies</p>
                          <div className="flex flex-wrap gap-1">
                            {myProfile.tradingIdentity.strategiesUsed.map(s => (
                              <span key={s} className="text-xs bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/20 px-2 py-0.5 rounded-full">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {myProfile.tradingIdentity.preferredSessions.length > 0 && (
                        <div>
                          <p className="text-white/30 text-xs mb-2">Sessions</p>
                          <div className="flex flex-wrap gap-1">
                            {myProfile.tradingIdentity.preferredSessions.map(s => (
                              <span key={s} className="text-xs bg-amber-500/10 text-amber-400/80 border border-amber-500/20 px-2 py-0.5 rounded-full capitalize">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick stats from real data */}
                {closedTrades.length === 0 ? (
                  <EmptyCard
                    message="No paper trading data yet."
                    sub="Open the Dashboard, place and close paper trades to see your performance stats here."
                  />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    <StatCard label="Closed Trades" value={closedTrades.length} />
                    {perf && (
                      <>
                        <StatCard label="Win Rate" value={`${perf.winRate}%`}
                          color={perf.winRate >= 50 ? "text-green-400" : "text-red-400"}
                          sub={`${perf.wins}W · ${perf.losses}L`} />
                        <StatCard label="Net P&L" value={`${perf.netPnl >= 0 ? "+" : ""}$${perf.netPnl}`}
                          color={perf.netPnl >= 0 ? "text-green-400" : "text-red-400"}
                          sub="paper trading" />
                        <StatCard label="Profit Factor" value={perf.profitFactor === 999 ? "∞" : perf.profitFactor}
                          color={perf.profitFactor >= 1.5 ? "text-green-400" : perf.profitFactor >= 1 ? "text-amber-400" : "text-red-400"} />
                        <StatCard label="Avg Duration" value={formatDuration(perf.avgDurationMs)} />
                      </>
                    )}
                    {disciplineScore.hasEnoughData && (
                      <StatCard label="Discipline" value={`${disciplineScore.total}/100`}
                        color={disciplineScore.total >= 70 ? "text-green-400" : disciplineScore.total >= 50 ? "text-amber-400" : "text-red-400"}
                        sub={`Grade ${disciplineScore.grade}`} />
                    )}
                  </div>
                )}

                {/* Derived insights */}
                {closedTrades.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {bestSymbol && (
                      <div className="glass border border-green-500/10 bg-green-500/3 rounded-xl p-4">
                        <p className="text-white/40 text-xs mb-2">Best Symbol (Paper)</p>
                        <p className="text-white font-semibold">{bestSymbol.displayName}</p>
                        <p className={`text-sm font-bold mt-1 ${bestSymbol.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {bestSymbol.netPnl >= 0 ? "+" : ""}${bestSymbol.netPnl.toFixed(2)} · {bestSymbol.winRate}% WR
                        </p>
                      </div>
                    )}
                    {mostTradedSymbol && (
                      <div className="glass border border-white/5 rounded-xl p-4">
                        <p className="text-white/40 text-xs mb-2">Most Traded Symbol</p>
                        <p className="text-white font-semibold">{mostTradedSymbol.displayName}</p>
                        <p className="text-white/50 text-sm mt-1">{mostTradedSymbol.trades} trades</p>
                      </div>
                    )}
                    {bestSession && (
                      <div className="glass border border-white/5 rounded-xl p-4">
                        <p className="text-white/40 text-xs mb-2">Best Session (Paper)</p>
                        <p className="text-white font-semibold capitalize">{bestSession.session}</p>
                        <p className={`text-sm font-bold mt-1 ${bestSession.netPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {bestSession.netPnl >= 0 ? "+" : ""}${bestSession.netPnl.toFixed(2)} · {bestSession.winRate}% WR
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Academy/strategy summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="glass border border-white/5 rounded-xl p-4">
                    <p className="text-white/40 text-xs mb-3">Academy Progress</p>
                    {enrolledCourses.length === 0 ? (
                      <p className="text-white/20 text-sm">Not enrolled in any courses yet.</p>
                    ) : (
                      <div>
                        <p className="text-white text-sm">{completedCourses.length}/{enrolledCourses.length} courses completed</p>
                        <p className="text-white/30 text-xs mt-1">Certificates coming soon</p>
                      </div>
                    )}
                  </div>
                  <div className="glass border border-white/5 rounded-xl p-4">
                    <p className="text-white/40 text-xs mb-3">Strategies</p>
                    {savedStrategyCount === 0 && publishedStrategies.length === 0 ? (
                      <p className="text-white/20 text-sm">No strategies saved or published yet.</p>
                    ) : (
                      <div>
                        <p className="text-white text-sm">{publishedStrategies.length} published · {savedStrategyCount} saved</p>
                        <p className="text-white/30 text-xs mt-1">Local-only until backend connected</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                  <p className="text-white/15 text-xs leading-relaxed">
                    All stats are derived from your local paper trading data only. No stats are verified or broker-connected.
                    This is Phase Beta — paper trading only.
                  </p>
                </div>
              </div>
            )}

            {/* ══ PORTFOLIO ═════════════════════════════════════════════ */}
            {activeTab === "portfolio" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Portfolio</h2>
                    <p className="text-white/30 text-xs mt-0.5">Real paper trading performance · Local data only</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      myProfile.portfolioVisibility === "public" ? "text-green-400/60 border-green-500/20"
                      : myProfile.portfolioVisibility === "private" ? "text-red-400/60 border-red-500/20"
                      : "text-amber-400/60 border-amber-500/20"
                    }`}>
                      {VISIBILITY_ICONS[myProfile.portfolioVisibility]} {myProfile.portfolioVisibility.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {closedTrades.length === 0 ? (
                  <EmptyCard
                    message="No closed paper trades yet."
                    sub="Close paper trades from the Dashboard. Portfolio analytics appear here automatically."
                  />
                ) : perf ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      <StatCard label="Total Trades"  value={perf.totalTrades} />
                      <StatCard label="Win Rate"       value={`${perf.winRate}%`}
                        color={perf.winRate >= 50 ? "text-green-400" : "text-red-400"}
                        sub={`${perf.wins}W · ${perf.losses}L · ${perf.breakevens}BE`} />
                      <StatCard label="Net P&L"        value={`${perf.netPnl >= 0 ? "+" : ""}$${perf.netPnl}`}
                        color={perf.netPnl >= 0 ? "text-green-400" : "text-red-400"}
                        sub="after 0.01% simulated commission" />
                      <StatCard label="ROI"            value={`${perf.roiPercent >= 0 ? "+" : ""}${perf.roiPercent}%`}
                        color={perf.roiPercent >= 0 ? "text-green-400" : "text-red-400"}
                        sub={`from $${PAPER_INITIAL_BALANCE.toLocaleString()} paper start`} />
                      <StatCard label="Profit Factor"  value={perf.profitFactor === 999 ? "∞" : perf.profitFactor}
                        color={perf.profitFactor >= 1.5 ? "text-green-400" : perf.profitFactor >= 1 ? "text-amber-400" : "text-red-400"} />
                      <StatCard label="Avg Duration"   value={formatDuration(perf.avgDurationMs)} />
                      <StatCard label="Best Trade"     value={`+$${perf.bestTrade}`}  color="text-green-400" />
                      <StatCard label="Worst Trade"    value={`$${perf.worstTrade}`}  color="text-red-400"   />
                      <StatCard label="Avg Win"        value={`+$${perf.avgWin}`}     color="text-green-400" sub={`${perf.wins} wins`} />
                      <StatCard label="Avg Loss"       value={`-$${perf.avgLoss}`}    color="text-red-400"   sub={`${perf.losses} losses`} />
                      <StatCard label="SL Hits"        value={perf.slHits}            color="text-red-400"   />
                      <StatCard label="TP Hits"        value={perf.tpHits}            color="text-green-400" />
                    </div>

                    {symbolStats.length > 0 && (
                      <div className="glass border border-white/5 rounded-xl overflow-hidden">
                        <p className="text-white/40 text-xs uppercase tracking-wider px-5 py-3 border-b border-white/5">Symbol Breakdown</p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                              <th className="text-left px-5 py-3 text-white/40">Symbol</th>
                              <th className="text-right px-5 py-3 text-white/40">Trades</th>
                              <th className="text-right px-5 py-3 text-white/40">Win Rate</th>
                              <th className="text-right px-5 py-3 text-white/40">Net P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {symbolStats.map(s => (
                              <tr key={s.symbolId} className="border-b border-white/5 hover:bg-white/2">
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2">
                                    <span>{s.emoji}</span>
                                    <span className="text-white font-medium">{s.displayName}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-right text-white/60">{s.trades}</td>
                                <td className={`px-5 py-3 text-right ${s.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>{s.winRate}%</td>
                                <td className={`px-5 py-3 text-right font-bold ${pnlColor(s.netPnl)}`}>
                                  {s.netPnl >= 0 ? "+" : ""}${s.netPnl.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : null}

                <div className="p-3 bg-white/2 border border-white/5 rounded-xl">
                  <p className="text-white/15 text-xs leading-relaxed">
                    Portfolio data is from local paper trading only. Not broker-verified. Not real money.
                    Portfolio visibility is "{myProfile.portfolioVisibility}" — other users {
                      myProfile.portfolioVisibility === "private" ? "cannot see your portfolio"
                      : myProfile.portfolioVisibility === "followers_only" ? "must follow you to see your portfolio"
                      : "can see your portfolio"
                    } (requires backend in Phase Alpha).
                  </p>
                </div>
              </div>
            )}

            {/* ══ POSTS ═════════════════════════════════════════════════ */}
            {activeTab === "posts" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">My Posts</h2>
                  <p className="text-white/30 text-xs">{myPosts.length} post{myPosts.length !== 1 ? "s" : ""} · Local community feed</p>
                </div>
                {myPosts.length === 0 ? (
                  <EmptyCard
                    message="No posts yet."
                    sub="Share your first trading thought, trade idea, or journal lesson in Community."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {myPosts.map(post => <MiniPostCard key={post.id} post={post} />)}
                  </div>
                )}
              </div>
            )}

            {/* ══ STRATEGIES ════════════════════════════════════════════ */}
            {activeTab === "strategies" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Published Strategies</h2>
                  <p className="text-white/30 text-xs">Strategies you've published to the Marketplace · Local only</p>
                </div>
                {publishedStrategies.length === 0 ? (
                  <EmptyCard
                    message="No published strategies yet."
                    sub="Create and publish a strategy in the Strategy Marketplace."
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {publishedStrategies.map(strategy => (
                      <div key={strategy.id} className="glass border border-white/5 rounded-xl p-5">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-white font-semibold text-sm">{strategy.title}</h3>
                          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0 ml-2">
                            {strategy.performanceStatus === "unverified" ? "Not verified" : strategy.performanceStatus}
                          </span>
                        </div>
                        <p className="text-white/40 text-xs leading-relaxed line-clamp-2">{strategy.description}</p>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full capitalize">{strategy.riskLevel} risk</span>
                          <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">{strategy.timeframe}</span>
                          {strategy.reviews.length > 0 && (
                            <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                              {strategy.reviews.length} review{strategy.reviews.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══ ACADEMY ═══════════════════════════════════════════════ */}
            {activeTab === "academy" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">Academy Progress</h2>
                  <p className="text-white/30 text-xs">Your course enrollments and progress · Saved locally</p>
                </div>
                {enrolledCourses.length === 0 ? (
                  <EmptyCard
                    message="Not enrolled in any courses yet."
                    sub="Visit the Academy to enroll in official TCC courses and free educational resources."
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {courses.filter(c => enrolledCourses.includes(c.id)).map(course => {
                      const progress = userProgress[course.id];
                      const pct = course.lessons.length > 0
                        ? Math.round((progress.completedLessons.length / course.lessons.length) * 100)
                        : 0;
                      const completed = pct === 100;
                      return (
                        <div key={course.id} className="glass border border-white/5 rounded-xl p-5 flex items-center gap-4">
                          <span className="text-3xl shrink-0">{course.thumbnail}</span>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-1">
                              <p className="text-white font-semibold text-sm">{course.title}</p>
                              {completed && (
                                <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full shrink-0 ml-2">✓ Completed</span>
                              )}
                            </div>
                            <div className="flex justify-between mb-1.5">
                              <span className="text-white/40 text-xs capitalize">{course.type.replace(/_/g, " ")} · {course.level}</span>
                              <span className={`text-xs ${completed ? "text-green-400" : "text-white/50"}`}>{pct}%</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${completed ? "bg-green-400" : "bg-green-500/50"}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                            {course.certificateStatus === "coming_soon" && completed && (
                              <p className="text-amber-400/60 text-xs mt-1">🏆 Certificate coming soon</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ══ SETTINGS ══════════════════════════════════════════════ */}
            {activeTab === "settings" && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white mb-1">Profile Settings</h2>
                  <p className="text-white/30 text-xs">Edit your profile, trading identity, and visibility settings.</p>
                </div>
                <SettingsTab
                  profile={myProfile}
                  onSave={(updates) => {
                    updateProfile(updates);
                    addNotification({
                      type:     "system",
                      priority: "low",
                      title:    "✅ Profile Updated",
                      message:  "Your profile changes have been saved locally.",
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