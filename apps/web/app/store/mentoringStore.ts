import { create } from "zustand";

export type SessionStatus = "upcoming" | "completed" | "cancelled";
export type ReviewStatus = "pending" | "reviewed";

export interface MentorProfile {
  id: string;
  handle: string;
  tccId: string;
  specialty: string[];
  bio: string;
  verifiedPnl: number;
  winRate: number;
  students: number;
  rating: number;
  totalReviews: number;
  hourlyRate: number;
  languages: string[];
  availability: string;
  badges: string[];
  completionRate: number;
}

export interface Session {
  id: string;
  mentorId: string;
  mentorHandle: string;
  studentHandle: string;
  topic: string;
  scheduledAt: Date;
  duration: number;
  status: SessionStatus;
  meetingUrl: string;
  notes?: string;
  price: number;
}

export interface TradeReview {
  id: string;
  mentorHandle: string;
  studentHandle: string;
  tradeSymbol: string;
  tradeDirection: string;
  entryPrice: number;
  mentorComment: string;
  rating: number;
  improvements: string[];
  strengths: string[];
  timestamp: Date;
  status: ReviewStatus;
}

export interface Pod {
  id: string;
  name: string;
  mentorHandle: string;
  description: string;
  members: number;
  maxMembers: number;
  isPrivate: boolean;
  price: number;
  tags: string[];
  joined: boolean;
}

const mockMentors: MentorProfile[] = [
  {
    id: "m1", handle: "goldsniper_fx", tccId: "TCC-GL-MNT-00000001",
    specialty: ["XAUUSD", "SMC", "Forex"],
    bio: "10+ years trading XAUUSD. Taught 500+ students. Specializing in SMC, order blocks, and liquidity concepts. Full-time trader and educator.",
    verifiedPnl: 48500, winRate: 71.4, students: 234, rating: 4.9,
    totalReviews: 186, hourlyRate: 50, languages: ["English", "Hindi"],
    availability: "Mon-Fri, London & NY Session",
    badges: ["🥇 Gold Sniper", "📊 SMC Specialist", "✓ Verified Pro"],
    completionRate: 96,
  },
  {
    id: "m2", handle: "risk_master_99", tccId: "TCC-GL-MNT-00000002",
    specialty: ["Risk Management", "Psychology", "XAUUSD", "EURUSD"],
    bio: "Former institutional risk analyst. Now helping retail traders survive and thrive. My students average 18 months of consistent profitability.",
    verifiedPnl: 32800, winRate: 75.0, students: 312, rating: 4.9,
    totalReviews: 241, hourlyRate: 40, languages: ["English"],
    availability: "Weekdays, Any Session",
    badges: ["🛡 Risk Master", "🧠 Psychology Coach", "✓ Verified Pro"],
    completionRate: 98,
  },
  {
    id: "m3", handle: "btc_beast", tccId: "TCC-GL-MNT-00000003",
    specialty: ["Bitcoin", "Crypto", "On-chain Analysis"],
    bio: "Crypto native since 2017. Survived 3 bear markets. Teaching crypto-specific risk management, on-chain analysis, and cycle investing.",
    verifiedPnl: 28400, winRate: 68.4, students: 128, rating: 4.7,
    totalReviews: 94, hourlyRate: 35, languages: ["English"],
    availability: "Weekends + NY Session",
    badges: ["₿ BTC Specialist", "📈 Cycle Trader"],
    completionRate: 91,
  },
  {
    id: "m4", handle: "eurusd_queen", tccId: "TCC-GL-MNT-00000004",
    specialty: ["EURUSD", "GBPUSD", "Forex Fundamentals"],
    bio: "Forex trader for 7 years. Focus on macro fundamentals + technical confluence. London session specialist with consistent monthly returns.",
    verifiedPnl: 21600, winRate: 62.9, students: 189, rating: 4.8,
    totalReviews: 143, hourlyRate: 30, languages: ["English", "French"],
    availability: "London Session Only",
    badges: ["💱 Forex Queen", "🏙 London Specialist"],
    completionRate: 94,
  },
];

const mockPods: Pod[] = [
  { id: "p1", name: "Gold Hunters Den", mentorHandle: "goldsniper_fx", description: "Private XAUUSD trading group. Daily analysis, live trade alerts, and weekly review sessions.", members: 48, maxMembers: 50, isPrivate: true, price: 29, tags: ["XAUUSD", "SMC", "Daily Alerts"], joined: false },
  { id: "p2", name: "Risk Masters Circle", mentorHandle: "risk_master_99", description: "Focus on risk management and trading psychology. Monthly 1:1 reviews included.", members: 67, maxMembers: 100, isPrivate: false, price: 19, tags: ["Risk", "Psychology", "Accountability"], joined: false },
  { id: "p3", name: "Crypto Cycle Traders", mentorHandle: "btc_beast", description: "On-chain analysis, macro crypto cycles, and altcoin rotation strategies.", members: 34, maxMembers: 75, isPrivate: false, price: 15, tags: ["Bitcoin", "Crypto", "On-chain"], joined: false },
];

const mockReviews: TradeReview[] = [
  {
    id: "r1", mentorHandle: "goldsniper_fx", studentHandle: "guest",
    tradeSymbol: "XAUUSD", tradeDirection: "BUY", entryPrice: 2334.50,
    mentorComment: "Good entry at the OB retest. However, your SL was too tight — you got stopped out before the move. Next time give the trade room to breathe. The setup was valid, execution needs refinement.",
    rating: 7, improvements: ["Wider SL placement", "Wait for candle close confirmation", "Check HTF bias first"],
    strengths: ["Correct OB identification", "Good RR target", "Traded in session"],
    timestamp: new Date(Date.now() - 86400000), status: "reviewed",
  },
];

interface MentoringStore {
  mentors: MentorProfile[];
  sessions: Session[];
  tradeReviews: TradeReview[];
  pods: Pod[];
  bookSession: (session: Omit<Session, "id" | "meetingUrl">) => void;
  joinPod: (podId: string) => void;
  leavePod: (podId: string) => void;
  requestReview: (review: Omit<TradeReview, "id" | "timestamp" | "status" | "mentorComment" | "rating" | "improvements" | "strengths">) => void;
}

export const useMentoringStore = create<MentoringStore>((set) => ({
  mentors: mockMentors,
  sessions: [],
  tradeReviews: mockReviews,
  pods: mockPods,

  bookSession: (session) => {
    const newSession: Session = {
      ...session,
      id: Date.now().toString(),
      meetingUrl: `https://meet.tcc.app/session-${Date.now()}`,
    };
    set((state) => ({ sessions: [...state.sessions, newSession] }));
  },

  joinPod: (podId) =>
    set((state) => ({
      pods: state.pods.map(p => p.id === podId ? { ...p, joined: true, members: p.members + 1 } : p),
    })),

  leavePod: (podId) =>
    set((state) => ({
      pods: state.pods.map(p => p.id === podId ? { ...p, joined: false, members: p.members - 1 } : p),
    })),

  requestReview: (review) => {
    const newReview: TradeReview = {
      ...review,
      id: Date.now().toString(),
      timestamp: new Date(),
      status: "pending",
      mentorComment: "Review pending — mentor will respond within 24 hours.",
      rating: 0,
      improvements: [],
      strengths: [],
    };
    set((state) => ({ tradeReviews: [newReview, ...state.tradeReviews] }));
  },
}));