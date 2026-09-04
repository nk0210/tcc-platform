"use client";
/**
 * TCC Social — /community
 *
 * Three-column social-network layout (left nav, feed, right discovery)
 * built on the existing API-backed communityStore.ts. Groups/Stories/
 * Messages have no backend at all yet (audited — no Prisma models exist)
 * so they stay honest "coming soon" panels, same as before this redesign,
 * just visually consistent with everything else now.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCommunityStore, type CommunityPostType, type FeedSort } from "@/store/communityStore";
import { useAuthStore } from "@/store/authStore";
import PostCard from "@/components/community/PostCard";
import PostComposer from "@/components/community/PostComposer";
import CommunitySearch from "@/components/community/CommunitySearch";
import { CommunityLeftSidebar, CommunityRightSidebar, type CommunityTab } from "@/components/community/CommunitySidebars";

const POST_TYPE_LABELS: Record<CommunityPostType, string> = {
  TEXT:                "Thoughts",
  TRADE_IDEA:          "Trade Ideas",
  SHARED_TRADE:        "Shared Trades",
  ACADEMY_COMPLETION:  "Academy",
  STRATEGY_SHARE:      "Strategies",
  COMPETITION_UPDATE:  "Competition",
};

function ComingSoonPanel({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="glass rounded-xl flex flex-col items-center justify-center py-16 px-6 gap-3 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="text-fg font-semibold text-sm">{title}</p>
      <p className="text-fg-dim text-xs max-w-sm leading-relaxed">{description}</p>
      <span className="badge badge-neutral mt-1">No fake data shown — real backend not built yet</span>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass rounded-xl p-5 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-elevated" />
            <div className="flex-1">
              <div className="h-3 w-32 bg-elevated rounded mb-2" />
              <div className="h-2 w-20 bg-elevated rounded" />
            </div>
          </div>
          <div className="h-3 w-full bg-elevated rounded mb-2" />
          <div className="h-3 w-3/4 bg-elevated rounded" />
        </div>
      ))}
    </div>
  );
}

export default function CommunityPage() {
  const { user } = useAuthStore();
  const {
    posts, feedType, tag, sort, setFeedType, setFilters, isLoading, isInitialized, hasMore, loadMore, error,
  } = useCommunityStore();
  const router = useRouter();

  const [activeTab, setActiveTab]       = useState<CommunityTab>("feed");
  const [filterType, setFilterType]     = useState<CommunityPostType | "all">("all");
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  // Map the left-nav tab onto the store's feedType — "feed" and "following"
  // are real distinct queries; groups/stories/messages have no feed at all.
  useEffect(() => {
    if (activeTab === "feed"      && feedType !== "global")    setFeedType("global");
    if (activeTab === "following" && feedType !== "following") setFeedType("following");
    if (activeTab === "saved"     && feedType !== "saved")     setFeedType("saved");
  }, [activeTab, feedType, setFeedType]);

  const visiblePosts = useMemo(
    () => (filterType === "all" ? posts : posts.filter((p) => p.type === filterType)),
    [posts, filterType]
  );

  const handleHashtagSelect = (t: string) => {
    setActiveTab("feed");
    setFilters({ tag: tag === t ? null : t });
  };

  const handleSortChange = (s: FeedSort) => setFilters({ sort: s });

  // True infinite scroll: observe a sentinel below the last post and load
  // the next page as soon as it enters the viewport, instead of requiring
  // a manual "Load more" click.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, activeTab, feedType]);

  if (!user) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto flex gap-4 px-4">
        <CommunityLeftSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main column */}
        <main className="flex-1 min-w-0 max-w-2xl mx-auto py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="shrink-0">
              <h1 className="text-xl font-bold text-fg">TCC Social</h1>
              <p className="text-fg-dim text-xs mt-0.5">The trader's community — real posts, real data</p>
            </div>
            {(activeTab === "feed" || activeTab === "following") && (
              <button onClick={() => setShowComposer((s) => !s)} className="btn btn-primary text-sm !px-4 !py-2 shrink-0">
                {showComposer ? "Cancel" : "+ Post"}
              </button>
            )}
          </div>

          <div className="mb-4">
            <CommunitySearch onHashtagSelect={handleHashtagSelect} />
          </div>

          {(activeTab === "feed" || activeTab === "following") && (
            <>
              {showComposer && <PostComposer onPost={() => setShowComposer(false)} onCancel={() => setShowComposer(false)} />}

              {/* Sort tabs */}
              <div className="flex items-center gap-1 bg-elevated rounded-lg p-1 mb-3 w-fit">
                {(["latest", "trending"] as FeedSort[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSortChange(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition ${
                      sort === s ? "bg-accent text-white" : "text-fg-dim hover:text-fg-muted"
                    }`}
                  >
                    {s === "latest" ? "🕐 Latest" : "🔥 Trending"}
                  </button>
                ))}
              </div>

              {/* Active hashtag filter */}
              {tag && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="badge badge-accent">#{tag}</span>
                  <button onClick={() => setFilters({ tag: null })} className="text-fg-dim hover:text-fg-muted text-xs">✕ clear</button>
                </div>
              )}

              {/* Type filter */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                <button
                  onClick={() => setFilterType("all")}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    filterType === "all" ? "bg-accent-soft text-accent-hover border-accent/30" : "text-fg-dim border-border hover:border-border-strong bg-elevated"
                  }`}
                >All</button>
                {(Object.keys(POST_TYPE_LABELS) as CommunityPostType[]).map((ft) => (
                  <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      filterType === ft ? "bg-accent-soft text-accent-hover border-accent/30" : "text-fg-dim border-border hover:border-border-strong bg-elevated"
                    }`}
                  >{POST_TYPE_LABELS[ft]}</button>
                ))}
              </div>

              {!isInitialized || (isLoading && posts.length === 0) ? (
                <FeedSkeleton />
              ) : error ? (
                <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-3">
                  <p className="text-danger text-sm">{error}</p>
                  <button onClick={() => useCommunityStore.getState().init()} className="btn btn-secondary text-xs">Try again</button>
                </div>
              ) : visiblePosts.length === 0 ? (
                <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                  <p className="text-4xl">🌎</p>
                  <p className="text-fg-muted text-sm font-semibold">No posts yet</p>
                  <p className="text-fg-dim text-xs max-w-xs leading-relaxed">
                    Be the first to share a trading thought, idea, or lesson.
                  </p>
                  {!showComposer && (
                    <button onClick={() => setShowComposer(true)} className="btn btn-primary text-xs !px-4 !py-2 mt-1">Create a post</button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {visiblePosts.map((post) => (
                    <PostCard key={post.id} post={post} onHashtagClick={handleHashtagSelect} />
                  ))}
                  {hasMore && (
                    <div ref={sentinelRef} className="flex justify-center py-3">
                      {isLoading && <p className="text-fg-dim text-xs animate-pulse">Loading more…</p>}
                    </div>
                  )}
                  {!hasMore && (
                    <p className="text-fg-dim text-xs text-center py-2">You're all caught up 🎉</p>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "saved" && (
            isLoading ? <FeedSkeleton /> : posts.length === 0 ? (
              <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-3 text-center">
                <p className="text-4xl">🔖</p>
                <p className="text-fg-muted text-sm">No saved posts yet.</p>
                <p className="text-fg-dim text-xs">Tap the bookmark icon on any post to save it here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {posts.map((post) => <PostCard key={post.id} post={post} onHashtagClick={handleHashtagSelect} />)}
              </div>
            )
          )}

          {activeTab === "groups" && (
            <ComingSoonPanel icon="👨‍👩‍👧" title="Groups" description="Trading groups — public and private communities, group feeds, and group challenges. No backend exists for this yet." />
          )}
          {activeTab === "stories" && (
            <ComingSoonPanel icon="✨" title="Stories" description="Short-lived trading insights and updates. No backend exists for this yet." />
          )}
          {activeTab === "messages" && (
            <ComingSoonPanel icon="✉️" title="Direct Messages" description="Real-time messaging between traders. No backend exists for this yet." />
          )}
        </main>

        <CommunityRightSidebar onHashtagSelect={handleHashtagSelect} />
      </div>
    </div>
  );
}
