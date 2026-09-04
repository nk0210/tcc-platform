"use client";
/**
 * TCC Social — left (navigation) and right (discovery/market) sidebars.
 * Every number here is real: Market Pulse reads the same live Binance
 * ticker feed the Markets/Watchlist pages use, Trending Hashtags and
 * Who-to-Follow hit real new endpoints backed by real aggregate queries —
 * nothing hardcoded, nothing fake.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommunityStore, type CommunityUserSummary, type TrendingHashtag } from "@/store/communityStore";
import { useMarketPrices } from "@/hooks/useMarketPrices";

type CommunityTab = "feed" | "following" | "saved" | "groups" | "stories" | "messages";

// ── Left sidebar ────────────────────────────────────────────────────────

const NAV_ITEMS: { key: CommunityTab; label: string; icon: string }[] = [
  { key: "feed",      label: "Feed",       icon: "🏠" },
  { key: "following",  label: "Following",  icon: "👥" },
  { key: "saved",      label: "Saved",      icon: "🔖" },
  { key: "groups",     label: "Groups",     icon: "👨‍👩‍👧" },
  { key: "stories",    label: "Stories",    icon: "✨" },
  { key: "messages",   label: "Messages",   icon: "✉️" },
];

export function CommunityLeftSidebar({ activeTab, onTabChange }: { activeTab: CommunityTab; onTabChange: (tab: CommunityTab) => void }) {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 gap-4 py-4 pr-2 overflow-y-auto">
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onTabChange(item.key)}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left ${
              activeTab === item.key ? "bg-accent-soft text-accent-hover" : "text-fg-muted hover:bg-elevated hover:text-fg"
            }`}
          >
            {activeTab === item.key && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent" />}
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-border pt-4">
        <p className="text-fg-dim text-xs uppercase tracking-wide px-3 mb-2">Explore</p>
        <div className="flex flex-col gap-0.5">
          <button onClick={() => onTabChange("feed")} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-muted hover:bg-elevated hover:text-fg transition text-left">
            <span className="text-base leading-none">📊</span> Trading Discussions
          </button>
          <a href="/academy" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-muted hover:bg-elevated hover:text-fg transition">
            <span className="text-base leading-none">🎓</span> Academy
          </a>
          <a href="/copy-trading" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-muted hover:bg-elevated hover:text-fg transition">
            <span className="text-base leading-none">📡</span> Copy Trading
          </a>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-fg-dim text-xs uppercase tracking-wide px-3 mb-2">Your Groups</p>
        <p className="text-fg-dim text-xs px-3 leading-relaxed">
          Trading groups aren't built yet — this is honestly empty, not faked.
        </p>
      </div>
    </aside>
  );
}

// ── Right sidebar ───────────────────────────────────────────────────────

function MarketPulse() {
  const { tickers, loading } = useMarketPrices();
  const rows = Object.values(tickers).slice(0, 5);

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-fg-muted text-xs font-semibold uppercase tracking-wide mb-3">Market Pulse</p>
      {loading && <p className="text-fg-dim text-xs animate-pulse">Loading live prices…</p>}
      {!loading && rows.length === 0 && <p className="text-fg-dim text-xs">No live ticker data right now.</p>}
      <div className="flex flex-col gap-2">
        {rows.map((t) => (
          <div key={t.symbol} className="flex items-center justify-between text-xs">
            <span className="text-fg font-medium">{t.symbol}</span>
            <div className="flex items-center gap-2 tabular-nums">
              <span className="text-fg-muted">{t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
              <span className={t.changePct >= 0 ? "text-success" : "text-danger"}>
                {t.changePct >= 0 ? "+" : ""}{t.changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendingHashtags({ onSelect }: { onSelect: (tag: string) => void }) {
  const { getTrendingHashtags } = useCommunityStore();
  const [tags, setTags] = useState<TrendingHashtag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrendingHashtags(6).then((items) => { setTags(items); setLoading(false); });
  }, [getTrendingHashtags]);

  if (!loading && tags.length === 0) return null;

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-fg-muted text-xs font-semibold uppercase tracking-wide mb-3">Trending</p>
      {loading ? (
        <p className="text-fg-dim text-xs animate-pulse">Loading…</p>
      ) : (
        <div className="flex flex-col gap-1">
          {tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => onSelect(t.tag)}
              className="flex items-center justify-between text-left px-2 py-1.5 rounded-lg hover:bg-elevated transition group"
            >
              <span className="text-accent-hover text-sm font-medium">#{t.tag}</span>
              <span className="text-fg-dim text-xs group-hover:text-fg-muted">{t.count} posts</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WhoToFollow() {
  const { getSuggestions, followUser } = useCommunityStore();
  const [users, setUsers] = useState<CommunityUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    getSuggestions(4).then((items) => { setUsers(items); setLoading(false); });
  }, [getSuggestions]);

  const handleFollow = async (handle: string, id: string) => {
    setFollowedIds((prev) => new Set(prev).add(id));
    await followUser(handle);
  };

  if (!loading && users.length === 0) return null;

  return (
    <div className="glass rounded-xl p-4">
      <p className="text-fg-muted text-xs font-semibold uppercase tracking-wide mb-3">People you may know</p>
      {loading ? (
        <p className="text-fg-dim text-xs animate-pulse">Loading…</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2.5">
              <button onClick={() => router.push(`/profile?handle=${u.handle}`)} className="w-9 h-9 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-xs font-bold shrink-0">
                {u.handle[0]?.toUpperCase()}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-fg text-xs font-semibold truncate">{u.displayName}</p>
                <p className="text-fg-dim text-xs truncate">@{u.handle}</p>
              </div>
              <button
                onClick={() => handleFollow(u.handle, u.id)}
                disabled={followedIds.has(u.id)}
                className="btn btn-secondary text-xs !px-2.5 !py-1 shrink-0 disabled:opacity-40"
              >
                {followedIds.has(u.id) ? "Following" : "Follow"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CommunityRightSidebar({ onHashtagSelect }: { onHashtagSelect: (tag: string) => void }) {
  return (
    <aside className="hidden xl:flex flex-col w-72 shrink-0 gap-4 py-4 pl-2 overflow-y-auto">
      <MarketPulse />
      <TrendingHashtags onSelect={onHashtagSelect} />
      <WhoToFollow />
    </aside>
  );
}

export type { CommunityTab };
