"use client";
/**
 * TCC Social — full search results (/community/search?q=...).
 * The dropdown in CommunitySearch.tsx caps at 8 results per category and
 * links here for "see all" — this page re-runs the same query with a much
 * higher limit and renders real PostCards instead of content snippets.
 */
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCommunityStore, type SearchResults } from "@/store/communityStore";
import PostCard from "@/components/community/PostCard";

const EMPTY: SearchResults = { people: [], posts: [], hashtags: [] };

function SearchResultsBody() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") ?? "";
  const { search, followUser } = useCommunityStore();

  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!q.trim()) { setResults(EMPTY); setLoading(false); return; }
    setLoading(true);
    search(q, 30).then((r) => { setResults(r); setLoading(false); });
  }, [q, search]);

  const hasResults = results.people.length > 0 || results.posts.length > 0 || results.hashtags.length > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto py-6 px-4">
        <button onClick={() => router.push("/community")} className="text-fg-dim hover:text-fg-muted text-xs mb-4">← Back to feed</button>
        <h1 className="text-xl font-bold text-fg mb-1">Search results</h1>
        <p className="text-fg-dim text-sm mb-6">for "{q}"</p>

        {loading ? (
          <p className="text-fg-dim text-sm animate-pulse">Searching…</p>
        ) : !hasResults ? (
          <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-2 text-center">
            <p className="text-4xl">🔍</p>
            <p className="text-fg-muted text-sm font-semibold">No results for "{q}"</p>
            <p className="text-fg-dim text-xs">Try a different search term.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {results.people.length > 0 && (
              <section>
                <h2 className="text-fg-dim text-xs font-semibold uppercase tracking-wide mb-2">People</h2>
                <div className="glass rounded-xl divide-y divide-border">
                  {results.people.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 p-3">
                      <button onClick={() => router.push(`/profile?handle=${u.handle}`)} className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-sm font-bold shrink-0">
                        {u.handle[0]?.toUpperCase()}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-fg text-sm font-semibold truncate">{u.displayName}</p>
                        <p className="text-fg-dim text-xs truncate">@{u.handle} · {u._count.followedBy} followers</p>
                      </div>
                      <button
                        onClick={async () => { setFollowedIds((p) => new Set(p).add(u.id)); await followUser(u.handle); }}
                        disabled={followedIds.has(u.id)}
                        className="btn btn-secondary text-xs !px-3 !py-1.5 shrink-0 disabled:opacity-40"
                      >
                        {followedIds.has(u.id) ? "Following" : "Follow"}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {results.hashtags.length > 0 && (
              <section>
                <h2 className="text-fg-dim text-xs font-semibold uppercase tracking-wide mb-2">Hashtags</h2>
                <div className="glass rounded-xl divide-y divide-border">
                  {results.hashtags.map((h) => (
                    <button
                      key={h.tag}
                      onClick={() => router.push(`/community?tag=${encodeURIComponent(h.tag)}`)}
                      className="w-full flex items-center justify-between p-3 hover:bg-elevated transition text-left"
                    >
                      <span className="text-accent-hover text-sm font-semibold">#{h.tag}</span>
                      <span className="text-fg-dim text-xs">{h.count} posts</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {results.posts.length > 0 && (
              <section>
                <h2 className="text-fg-dim text-xs font-semibold uppercase tracking-wide mb-2">Posts</h2>
                <div className="flex flex-col gap-4">
                  {results.posts.map((post) => <PostCard key={post.id} post={post} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunitySearchPage() {
  return (
    <Suspense fallback={<div className="flex-1 py-16 text-center text-fg-dim text-sm">Loading…</div>}>
      <SearchResultsBody />
    </Suspense>
  );
}
