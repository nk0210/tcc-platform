/**
 * TCC Journal Store
 *
 * Entries are created automatically from closed paper trades.
 * Users can then edit entries to add emotion, notes, and tags.
 * No seed/fake data. All entries come from real user actions.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";
import { ClosedTrade } from "@/store/tradeStore";

export type Emotion = "confident" | "fearful" | "greedy" | "hesitant" | "neutral" | "frustrated";
export type Session = "london" | "newyork" | "asian" | "sydney" | "unknown";
export type EntryQuality = "good" | "early" | "late" | "missed" | "impulsive" | "unknown";
export type Strategy = "smc" | "ema_pullback" | "breakout" | "reversal" | "scalp" | "news" | "fibonacci" | "support_resistance" | "other";
export type MarketStructure = "bullish" | "bearish" | "ranging" | "choppy" | "unknown";
export type TradeResult = "win" | "loss" | "breakeven";

export interface JournalEntry {
  id: string;
  // Auto-populated from closed trade
  positionId?: string;
  symbol: string;
  displayName: string;
  side: "BUY" | "SELL";
  lotSize: number;
  entryPrice: number;
  exitPrice?: number;
  grossPnl?: number;
  netPnl?: number;
  result?: TradeResult;
  openedAt?: string;
  closedAt?: string;
  durationMs?: number;
  closeReason?: "manual" | "stop_loss" | "take_profit";
  // User-filled fields (initially empty/default)
  emotion: Emotion;
  confidenceLevel: number;   // 1-10
  stressLevel: number;       // 1-10
  entryQuality: EntryQuality;
  followedPlan: boolean | null;
  strategy: Strategy;
  marketStructure: MarketStructure;
  session: Session;
  timeframe: string;
  notes: string;
  whatWentRight: string;
  whatWentWrong: string;
  lessonLearned: string;
  tags: string[];
  // AI analysis (populated via Groq if configured)
  aiAnalysis: string;
  aiLoading: boolean;
  // Metadata
  createdAt: number; // ms timestamp
  updatedAt: number;
}

interface JournalStore {
  entries: JournalEntry[];
  addEntryFromClosedTrade: (trade: ClosedTrade) => JournalEntry;
  addEntry: (entry: Omit<JournalEntry, "id" | "aiAnalysis" | "aiLoading" | "createdAt" | "updatedAt">) => string;
  updateEntry: (id: string, updates: Partial<JournalEntry>) => void;
  updateAiAnalysis: (id: string, analysis: string) => void;
  deleteEntry: (id: string) => void;
}

export function detectSession(): Session {
  const hour = new Date().getUTCHours();
  if (hour >= 7 && hour < 16) return "london";
  if (hour >= 13 && hour < 22) return "newyork";
  if (hour >= 0 && hour < 9) return "asian";
  if (hour >= 22 || hour < 2) return "sydney";
  return "unknown";
}

function determineResult(netPnl?: number): TradeResult {
  if (netPnl === undefined || netPnl === null) return "breakeven";
  if (netPnl > 0.01) return "win";
  if (netPnl < -0.01) return "loss";
  return "breakeven";
}

export const useJournalStore = create<JournalStore>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntryFromClosedTrade: (trade) => {
        const now = Date.now();
        const id = `journal_${now}_${Math.random().toString(36).slice(2, 7)}`;

        const entry: JournalEntry = {
          id,
          positionId: trade.positionId,
          symbol: trade.symbol,
          displayName: trade.displayName,
          side: trade.side,
          lotSize: trade.lotSize,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          grossPnl: trade.grossPnl,
          netPnl: trade.netPnl,
          result: determineResult(trade.netPnl),
          openedAt: trade.openedAt,
          closedAt: trade.closedAt,
          durationMs: trade.durationMs,
          closeReason: trade.closeReason,
          // User-fill defaults
          emotion: "neutral",
          confidenceLevel: 5,
          stressLevel: 5,
          entryQuality: "unknown",
          followedPlan: null,
          strategy: "other",
          marketStructure: "unknown",
          session: detectSession(),
          timeframe: "1H",
          notes: "",
          whatWentRight: "",
          whatWentWrong: "",
          lessonLearned: "",
          tags: [],
          // AI
          aiAnalysis: "",
          aiLoading: false,
          // Meta
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({ entries: [entry, ...state.entries] }));
        return entry;
      },

      addEntry: (entry) => {
        const now = Date.now();
        const id = `journal_${now}_${Math.random().toString(36).slice(2, 7)}`;
        const newEntry: JournalEntry = {
          ...entry,
          id,
          aiAnalysis: "",
          aiLoading: false,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ entries: [newEntry, ...state.entries] }));
        return id;
      },

      updateEntry: (id, updates) => {
        set((state) => ({
          entries: state.entries.map(e =>
            e.id !== id ? e : { ...e, ...updates, updatedAt: Date.now() }
          ),
        }));
      },

      updateAiAnalysis: (id, analysis) => {
        set((state) => ({
          entries: state.entries.map(e =>
            e.id !== id ? e : { ...e, aiAnalysis: analysis, aiLoading: false, updatedAt: Date.now() }
          ),
        }));
      },

      deleteEntry: (id) => {
        set((state) => ({ entries: state.entries.filter(e => e.id !== id) }));
      },
    }),
    {
      name: "journal",
      storage: createJSONStorage(() => getUserScopedStorage("journal")),
    }
  )
);