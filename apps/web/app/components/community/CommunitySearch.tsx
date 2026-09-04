"use client";
/**
 * TCC Social — debounced search over people, posts, and hashtags.
 * One request per pause in typing, never one per keystroke.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useCommunityStore, type SearchResults } from "@/store/communityStore";

const DEBOUNCE_MS = 350;

export default function CommunitySearch({ onHashtagSelect }: { onHashtagSelect: (tag: string) => void }) {
  const { search } = useCommunityStore();
  const router = useRouter();

  const [query, setQuery]     = useState("");
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>({ people: [], posts: [], hashtags: [] });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ people: [], posts: [], hashtags: [] }); setLoading(false); return; }
    const data = await search(q);
    setResults(data);
    setLoading(false);
  }, [search]);

  const handleChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults({ people: [], posts: [], hashtags: [] }); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const hasResults = results.people.length > 0 || results.posts.length > 0 || results.hashtags.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-dim text-sm pointer-events-none">🔍</span>
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search TCC Community…"
          className="w-full bg-elevated border border-border rounded-full pl-9 pr-3 py-2 text-fg text-sm focus:outline-none focus:border-accent placeholder-fg-dim"
        />
      </div>

      {open && hasQuery && (
        <div className="glass absolute top-full left-0 right-0 mt-2 rounded-xl max-h-[70vh] overflow-y-auto z-30" style={{ boxShadow: "var(--shadow-elevated)" }}>
          {loading && <p className="text-fg-dim text-xs px-4 py-3 animate-pulse">Searching…</p>}

          {!loading && !hasResults && (
            <p className="text-fg-dim text-xs px-4 py-4 text-center">No results found. Try another search.</p>
          )}

          {!loading && results.people.length > 0 && (
            <div className="p-2 border-b border-border">
              <p className="text-fg-dim text-[10px] uppercase tracking-wide px-2 mb-1">People</p>
              {results.people.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setOpen(false); router.push(`/profile?handle=${u.handle}`); }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-elevated transition text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-hover text-xs font-bold shrink-0">
                    {u.handle[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-fg text-xs font-semibold truncate">{u.displayName}</p>
                    <p className="text-fg-dim text-xs truncate">@{u.handle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && results.hashtags.length > 0 && (
            <div className="p-2 border-b border-border">
              <p className="text-fg-dim text-[10px] uppercase tracking-wide px-2 mb-1">Hashtags</p>
              {results.hashtags.map((h) => (
                <button
                  key={h.tag}
                  onClick={() => { setOpen(false); onHashtagSelect(h.tag); }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-elevated transition text-left"
                >
                  <span className="text-accent-hover text-xs font-medium">#{h.tag}</span>
                  <span className="text-fg-dim text-xs">{h.count} posts</span>
                </button>
              ))}
            </div>
          )}

          {!loading && results.posts.length > 0 && (
            <div className="p-2">
              <p className="text-fg-dim text-[10px] uppercase tracking-wide px-2 mb-1">Posts</p>
              {results.posts.map((p) => (
                <div key={p.id} className="px-2 py-2 rounded-lg hover:bg-elevated transition">
                  <p className="text-fg-muted text-xs line-clamp-2">
                    <span className="text-fg font-semibold">@{p.author.handle}</span>: {p.content}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!loading && hasQuery && (
            <button
              onClick={() => { setOpen(false); router.push(`/community/search?q=${encodeURIComponent(query.trim())}`); }}
              className="w-full text-center px-3 py-2.5 text-xs text-accent-hover hover:bg-elevated transition border-t border-border font-medium"
            >
              See all results for "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
