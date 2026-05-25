import { create } from "zustand";

export type PostType = "trade" | "idea" | "lesson" | "win" | "loss";

export interface CommunityPost {
  id: string;
  userId: string;
  handle: string;
  skillLevel: string;
  postType: PostType;
  content: string;
  symbol?: string;
  direction?: "BUY" | "SELL";
  entryPrice?: number;
  exitPrice?: number;
  pnl?: number;
  pnlPct?: number;
  rr?: number;
  strategy?: string;
  chartNote?: string;
  likes: number;
  comments: Comment[];
  liked: boolean;
  saved: boolean;
  verified: boolean;
  timestamp: Date;
}

export interface Comment {
  id: string;
  handle: string;
  content: string;
  timestamp: Date;
}

interface CommunityStore {
  posts: CommunityPost[];
  addPost: (post: Omit<CommunityPost, "id" | "likes" | "comments" | "liked" | "saved" | "timestamp">) => void;
  likePost: (id: string) => void;
  savePost: (id: string) => void;
  addComment: (postId: string, comment: Omit<Comment, "id" | "timestamp">) => void;
}

// Seed data — demo posts
const seedPosts: CommunityPost[] = [
  {
    id: "1", userId: "u1", handle: "goldsniper_fx", skillLevel: "PRO",
    postType: "trade", content: "Clean BOS on XAUUSD H1. Took the retest of the OB, TP at previous high. London session setup. 🎯",
    symbol: "XAUUSD", direction: "BUY", entryPrice: 2334.50, exitPrice: 2356.80, pnl: 223.00, pnlPct: 0.95, rr: 2.8,
    strategy: "SMC", chartNote: "OB retest + BOS confirmation",
    likes: 47, comments: [
      { id: "c1", handle: "trader_raj", content: "Clean entry! What was your SL?", timestamp: new Date(Date.now() - 3600000) },
      { id: "c2", handle: "goldsniper_fx", content: "SL was below the OB, about 8 pips", timestamp: new Date(Date.now() - 1800000) },
    ],
    liked: false, saved: false, verified: true, timestamp: new Date(Date.now() - 7200000),
  },
  {
    id: "2", userId: "u2", handle: "btc_beast", skillLevel: "TRADER",
    postType: "win", content: "BTC breakout above 77k resistance. Held for 4 hours. Never doubted the setup 💪",
    symbol: "BTCUSDT", direction: "BUY", entryPrice: 76800, exitPrice: 78200, pnl: 140.00, pnlPct: 1.82, rr: 3.1,
    strategy: "Breakout", chartNote: "Weekly resistance breakout",
    likes: 31, comments: [], liked: false, saved: false, verified: true,
    timestamp: new Date(Date.now() - 14400000),
  },
  {
    id: "3", userId: "u3", handle: "risk_master_99", skillLevel: "ANALYST",
    postType: "lesson", content: "Lesson learned today: Never trade during CPI release without a wider SL. Got stopped out 3 minutes before the move. News trading requires different risk management. 📚",
    likes: 89, comments: [
      { id: "c3", handle: "newbie_trader", content: "This happened to me too! Thanks for sharing", timestamp: new Date(Date.now() - 900000) },
    ],
    liked: false, saved: false, verified: false, timestamp: new Date(Date.now() - 21600000),
  },
  {
    id: "4", userId: "u4", handle: "eurusd_queen", skillLevel: "PRO",
    postType: "idea", content: "EURUSD watching the 1.0850 level. If we get a rejection here with bearish engulfing on H4, targeting 1.0780. DXY strength supporting this bias. 🔍",
    symbol: "EURUSD", direction: "SELL",
    likes: 23, comments: [], liked: false, saved: false, verified: true,
    timestamp: new Date(Date.now() - 43200000),
  },
];

export const useCommunityStore = create<CommunityStore>((set) => ({
  posts: seedPosts,

  addPost: (post) => {
    const newPost: CommunityPost = {
      ...post,
      id: Date.now().toString(),
      likes: 0,
      comments: [],
      liked: false,
      saved: false,
      timestamp: new Date(),
    };
    set((state) => ({ posts: [newPost, ...state.posts] }));
  },

  likePost: (id) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
      ),
    })),

  savePost: (id) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === id ? { ...p, saved: !p.saved } : p
      ),
    })),

  addComment: (postId, comment) =>
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId ? {
          ...p,
          comments: [...p.comments, { ...comment, id: Date.now().toString(), timestamp: new Date() }]
        } : p
      ),
    })),
}));