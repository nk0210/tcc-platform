import { create } from "zustand";

export type Emotion = "confident" | "fearful" | "greedy" | "hesitant" | "neutral" | "frustrated";
export type Session = "london" | "newyork" | "asian" | "sydney" | "unknown";
export type EntryQuality = "good" | "early" | "late" | "missed" | "impulsive";
export type Strategy = "smc" | "ema_pullback" | "breakout" | "reversal" | "scalp" | "news" | "fibonacci" | "support_resistance" | "other";
export type MarketStructure = "bullish" | "bearish" | "ranging" | "choppy";

export interface JournalEntry {
  id: string;
  tradeId: string;
  symbol: string;
  direction: "BUY" | "SELL";
  entryPrice: number;
  exitPrice?: number;
  lots: number;
  sl?: number;
  tp?: number;
  rrRatio?: number;
  pnl?: number;
  fees?: number;
  session: Session;
  timeframe: string;
  emotion: Emotion;
  confidenceLevel: number;
  stressLevel: number;
  entryQuality: EntryQuality;
  followedPlan: boolean | null;
  strategy: Strategy;
  marketStructure: MarketStructure;
  notes: string;
  whatWentRight: string;
  whatWentWrong: string;
  lessonLearned: string;
  tags: string[];
  aiAnalysis: string;
  aiLoading: boolean;
  disciplineScore?: number;
  timestamp: Date;
}

interface JournalStore {
  entries: JournalEntry[];
  addEntry: (entry: Omit<JournalEntry, "id" | "aiAnalysis" | "aiLoading" | "timestamp">) => string;
  updateAiAnalysis: (id: string, analysis: string) => void;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => void;
}

export function detectSession(): Session {
  const hour = new Date().getUTCHours();
  if (hour >= 7 && hour < 16) return "london";
  if (hour >= 13 && hour < 22) return "newyork";
  if (hour >= 0 && hour < 9) return "asian";
  if (hour >= 22 || hour < 2) return "sydney";
  return "unknown";
}

export const useJournalStore = create<JournalStore>((set) => ({
  entries: [], // No seed data — only real TCC trades

  addEntry: (entry) => {
    const id = Date.now().toString();
    set((state) => ({
      entries: [{
        ...entry,
        id,
        aiAnalysis: "",
        aiLoading: false,
        timestamp: new Date(),
      }, ...state.entries],
    }));
    return id;
  },

  updateAiAnalysis: (id, analysis) =>
    set((state) => ({
      entries: state.entries.map(e =>
        e.id === id ? { ...e, aiAnalysis: analysis, aiLoading: false } : e
      ),
    })),

  updateEntry: (id, updates) =>
    set((state) => ({
      entries: state.entries.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),
}));