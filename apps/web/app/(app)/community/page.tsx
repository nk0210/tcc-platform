"use client";
/**
 * TCC Social — /community
 *
 * Three-column social-network layout (left nav, feed, right discovery)
 * built on the existing API-backed communityStore.ts, plus dedicated
 * subsystems for groups, stories, DMs, and blocked/muted management.
 */
import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCommunityStore, type CommunityPostType, type FeedSort, type CommunityPost } from "@/store/communityStore";
import { useAuthStore } from "@/store/authStore";
import PostCard from "@/components/community/PostCard";
import PostComposer from "@/components/community/PostComposer";
import CommunitySearch from "@/components/community/CommunitySearch";
import GroupsPanel from "@/components/community/GroupsPanel";
import StoriesPanel, { StoryRail } from "@/components/community/StoriesPanel";
import MessagesPanel from "@/components/community/MessagesPanel";
import PrivacyPanel from "@/components/community/PrivacyPanel";
import { CommunityLeftSidebar, CommunityRightSidebar, type CommunityTab } from "@/components/community/CommunitySidebars";

const POST_TYPE_LABELS: Record<CommunityPostType, string> = {
  TEXT:                "Thoughts",
  TRADE_IDEA:          "Trade Ideas",
  SHARED_TRADE:        "Shared Trades",
  ACADEMY_COMPLETION:  "Academy",
  STRATEGY_SHARE:      "Strategies",
  COMPETITION_UPDATE:  "Competition",
};

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

/** The post the ?post=<id> deep link (share links, repost "view original"
 *  clicks) resolves to. Fetched directly via getPost rather than filtered
 *  out of the feed, since the linked post may not be on the current page
 *  — or any page — of the viewer's feed. */
function SinglePostView({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { getPost } = useCommunityStore();
  const [post, setPost] = useState<CommunityPost | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getPost(postId).then((p) => { if (!cancelled) setPost(p); });
    return () => { cancelled = true; };
  }, [postId, getPost]);

  return (
    <div className="mb-4">
      <button onClick={onClose} className="text-fg-dim hover:text-fg-muted text-xs mb-3">← Back to feed</button>
      {post === undefined ? (
        <FeedSkeleton />
      ) : post === null ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center py-12 gap-2 text-center">
          <p className="text-3xl">🔍</p>
          <p className="text-fg-muted text-sm font-semibold">Post not found</p>
          <p className="text-fg-dim text-xs">It may have been deleted, or you don't have permission to view it.</p>
        </div>
      ) : (
        <PostCard post={post} />
      )}
    </div>
  );
}

function CommunityPageBody() {
  const { user } = useAuthStore();
  const {
    posts, feedType, tag, sort, setFeedType, setFilters, isLoading, isInitialized, hasMore, loadMore, error,
  } = useCommunityStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab]       = useState<CommunityTab>("feed");
  const [filterType, setFilterType]     = useState<CommunityPostType | "all">("all");
  const [showComposer, setShowComposer] = useState(false);

  const postParam = searchParams.get("post");
  const tagParam  = searchParams.get("tag");

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  // A ?tag= link (from the full search results page, or shared externally)
  // applies its filter once on load, same as clicking a hashtag in-app.
  useEffect(() => {
    if (tagParam) setFilters({ tag: tagParam });
  }, [tagParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map the left-nav tab onto the store's feedType — "feed" and "following"
  // are real distinct queries; groups/stories/messages/privacy have no feed.
  useEffect(() => {
    if (activeTab === "feed"      && feedType !== "global")    setFeedType("global");
    if (activeTab === "following" && feedType !== "following") setFeedType("following");
    if (activeTab === "saved"     && feedType !== "saved")     setFeedType("saved");
  }, [activeTab, feedType, setFeedType]);

  const visiblePosts = useMemo(
    () => (filterType === "all" ? posts : posts.filter((p) => p.type === filterType)),
    [posts, filterType]
  );

  const handleHashtagSelect = useCallback((t: string) => {
    setActiveTab("feed");
    setFilters({ tag: tag === t ? null : t });
  }, [tag, setFilters]);

  const handleSortChange = (s: FeedSort) => setFilters({ sort: s });

  const clearPostParam = () => router.push("/community");

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
            {(activeTab === "feed" || activeTab === "following") && !postParam && (
              <button onClick={() => setShowComposer((s) => !s)} className="btn btn-primary text-sm !px-4 !py-2 shrink-0">
                {showComposer ? "Cancel" : "+ Post"}
              </button>
            )}
          </div>

          <div className="mb-4">
            <CommunitySearch onHashtagSelect={handleHashtagSelect} />
          </div>

          {postParam ? (
            <SinglePostView postId={postParam} onClose={clearPostParam} />
          ) : (
            <>
              {(activeTab === "feed" || activeTab === "following") && (
                <>
                  {activeTab === "feed" && <StoryRail />}
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

              {activeTab === "groups"   && <GroupsPanel />}
              {activeTab === "stories"  && <StoriesPanel />}
              {activeTab === "messages" && <MessagesPanel />}
              {activeTab === "privacy"  && <PrivacyPanel />}
            </>
          )}
        </main>

        <CommunityRightSidebar onHashtagSelect={handleHashtagSelect} />
      </div>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="flex-1 py-16 text-center text-fg-dim text-sm">Loading…</div>}>
      <CommunityPageBody />
    </Suspense>
  );
}
