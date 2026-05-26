import { create } from "zustand";

export type Division = "ROOKIE" | "SEMI_PRO" | "PRO";
export type CompetitionStatus = "UPCOMING" | "LIVE" | "ENDED";

export interface Participant {
  id: string;
  handle: string;
  skillLevel: string;
  startBalance: number;
  currentBalance: number;
  pnl: number;
  pnlPct: number;
  trades: number;
  winRate: number;
  rank: number;
  badge?: string;
}

export interface Competition {
  id: string;
  name: string;
  division: Division;
  status: CompetitionStatus;
  startDate: Date;
  endDate: Date;
  prizePool: string;
  participants: Participant[];
  description: string;
  rules: string[];
  asset: string;
}

const mockParticipants: Participant[] = [
  { id: "p1", handle: "goldsniper_fx", skillLevel: "PRO", startBalance: 10000, currentBalance: 13450, pnl: 3450, pnlPct: 34.5, trades: 28, winRate: 71.4, rank: 1, badge: "🥇" },
  { id: "p2", handle: "btc_beast", skillLevel: "TRADER", startBalance: 10000, currentBalance: 12800, pnl: 2800, pnlPct: 28.0, trades: 19, winRate: 68.4, rank: 2, badge: "🥈" },
  { id: "p3", handle: "eurusd_queen", skillLevel: "PRO", startBalance: 10000, currentBalance: 11950, pnl: 1950, pnlPct: 19.5, trades: 35, winRate: 62.9, rank: 3, badge: "🥉" },
  { id: "p4", handle: "risk_master_99", skillLevel: "ANALYST", startBalance: 10000, currentBalance: 11200, pnl: 1200, pnlPct: 12.0, trades: 12, winRate: 75.0, rank: 4 },
  { id: "p5", handle: "london_scalper", skillLevel: "TRADER", startBalance: 10000, currentBalance: 10850, pnl: 850, pnlPct: 8.5, trades: 45, winRate: 55.6, rank: 5 },
  { id: "p6", handle: "xau_hunter", skillLevel: "ANALYST", startBalance: 10000, currentBalance: 10420, pnl: 420, pnlPct: 4.2, trades: 8, winRate: 62.5, rank: 6 },
  { id: "p7", handle: "ny_session_pro", skillLevel: "TRADER", startBalance: 10000, currentBalance: 10180, pnl: 180, pnlPct: 1.8, trades: 22, winRate: 54.5, rank: 7 },
  { id: "p8", handle: "smc_trader_in", skillLevel: "LEARNER", startBalance: 10000, currentBalance: 9850, pnl: -150, pnlPct: -1.5, trades: 15, winRate: 46.7, rank: 8 },
];

const mockCompetitions: Competition[] = [
  {
    id: "c1",
    name: "TCC May Sprint 2026",
    division: "PRO",
    status: "LIVE",
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-31"),
    prizePool: "$5,000",
    participants: mockParticipants,
    description: "Monthly sprint competition. Best risk-adjusted returns win. All assets allowed.",
    rules: [
      "Starting balance: $10,000 paper",
      "Max leverage: 1:20",
      "Max daily loss: 5%",
      "Min 10 trades to qualify",
      "No copy trading during competition",
    ],
    asset: "ALL",
  },
  {
    id: "c2",
    name: "Gold League — Q2 2026",
    division: "SEMI_PRO",
    status: "LIVE",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-06-30"),
    prizePool: "$2,500",
    participants: mockParticipants.slice(0, 5),
    description: "Quarterly Gold (XAUUSD) only competition. Specialist traders only.",
    rules: [
      "XAUUSD only",
      "Starting balance: $10,000 paper",
      "Max leverage: 1:10",
      "Max 3 open positions at once",
      "Win rate must be above 40% to qualify",
    ],
    asset: "XAUUSD",
  },
  {
    id: "c3",
    name: "Rookie Qualifier — June 2026",
    division: "ROOKIE",
    status: "UPCOMING",
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-06-30"),
    prizePool: "$500 + Draft Entry",
    participants: [],
    description: "Entry-level competition for new traders. Top 3 get drafted by pro teams.",
    rules: [
      "ROOKIE skill level only",
      "Starting balance: $5,000 paper",
      "Max leverage: 1:5",
      "Educational format — mistakes reviewed by mentors",
      "Top 3 get drafted into pro teams",
    ],
    asset: "ALL",
  },
];

interface CompetitionStore {
  competitions: Competition[];
  activeCompetition: Competition | null;
  setActiveCompetition: (competition: Competition) => void;
  joinCompetition: (competitionId: string, userHandle: string, skillLevel: string) => void;
}

export const useCompetitionStore = create<CompetitionStore>((set, get) => ({
  competitions: mockCompetitions,
  activeCompetition: mockCompetitions[0],

  setActiveCompetition: (competition) => set({ activeCompetition: competition }),

  joinCompetition: (competitionId, userHandle, skillLevel) => {
    set((state) => ({
      competitions: state.competitions.map((c) => {
        if (c.id !== competitionId) return c;
        const alreadyJoined = c.participants.find(p => p.handle === userHandle);
        if (alreadyJoined) return c;
        const newParticipant: Participant = {
          id: Date.now().toString(),
          handle: userHandle,
          skillLevel,
          startBalance: 10000,
          currentBalance: 10000,
          pnl: 0,
          pnlPct: 0,
          trades: 0,
          winRate: 0,
          rank: c.participants.length + 1,
        };
        return { ...c, participants: [...c.participants, newParticipant] };
      }),
    }));
  },
}));