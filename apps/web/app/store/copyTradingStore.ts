import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export type CopyMode = "auto" | "manual" | "notify";
export type CopyStatus = "active" | "paused" | "stopped" | "risk_locked" | "margin_insufficient";

export interface MasterTrader {
  id: string;
  handle: string;
  tccId: string;
  skillLevel: string;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  avgRR: number;
  totalTrades: number;
  monthlyReturn: number;
  traderTrustScore: number;
  specialty: string;
  followers: number;
  verified: boolean;
  broker: string;
}

export interface CopyRelationship {
  id: string;
  followerId: string;
  followerHandle: string;
  masterId: string;
  masterHandle: string;
  status: CopyStatus;
  copyMode: CopyMode;
  capitalAllocation: number;
  riskPercent: number;
  maxLot: number;
  maxDailyLoss: number;
  maxOpenTrades: number;
  copyMultiplier: number;
  minRR: number;
  totalCopiedTrades: number;
  totalCopiedPnl: number;
  consentedAt: number;
  broker: string;
}

export interface CopyTrade {
  id: string;
  masterId: string;
  masterHandle: string;
  symbol: string;
  direction: "BUY" | "SELL";
  masterLot: number;
  followerLot: number;
  entryPrice: number;
  sl: number;
  tp: number;
  rrRatio: number;
  slDistance: number;
  riskAmount: number;
  status: "pending" | "copied" | "skipped" | "blocked";
  blockReason?: string;
  pnl?: number;
  timestamp: number;
}

const mockMasters: MasterTrader[] = [
  { id: "m1", handle: "goldsniper_fx", tccId: "TCC-GL-TRD-00000001", skillLevel: "PRO", winRate: 71.4, profitFactor: 2.8, maxDrawdown: 4.2, avgRR: 2.1, totalTrades: 284, monthlyReturn: 8.5, traderTrustScore: 92, specialty: "XAUUSD", followers: 234, verified: true, broker: "TCC Paper" },
  { id: "m2", handle: "btc_beast", tccId: "TCC-GL-TRD-00000002", skillLevel: "TRADER", winRate: 68.4, profitFactor: 2.1, maxDrawdown: 6.1, avgRR: 1.8, totalTrades: 156, monthlyReturn: 6.2, traderTrustScore: 84, specialty: "BTCUSDT", followers: 128, verified: true, broker: "TCC Paper" },
  { id: "m3", handle: "eurusd_queen", tccId: "TCC-GL-TRD-00000003", skillLevel: "PRO", winRate: 62.9, profitFactor: 1.9, maxDrawdown: 3.8, avgRR: 1.6, totalTrades: 412, monthlyReturn: 4.8, traderTrustScore: 88, specialty: "EURUSD", followers: 189, verified: true, broker: "TCC Paper" },
  { id: "m4", handle: "risk_master_99", tccId: "TCC-GL-TRD-00000004", skillLevel: "ANALYST", winRate: 75.0, profitFactor: 3.2, maxDrawdown: 2.1, avgRR: 2.8, totalTrades: 98, monthlyReturn: 3.9, traderTrustScore: 95, specialty: "XAUUSD/EURUSD", followers: 312, verified: true, broker: "TCC Paper" },
];

interface CopyTradingStore {
  masters: MasterTrader[];
  relationships: CopyRelationship[];
  copyTrades: CopyTrade[];
  setupRelationship: (relationship: Omit<CopyRelationship, "id" | "totalCopiedTrades" | "totalCopiedPnl" | "consentedAt">) => void;
  updateRelationshipStatus: (id: string, status: CopyStatus) => void;
  addCopyTrade: (trade: Omit<CopyTrade, "id" | "timestamp">) => void;
  setAiReport: (competitionId: string, participantId: string, report: string) => void;
  calculateFollowerLot: (master: MasterTrader, relationship: CopyRelationship, masterLot: number, slDistance: number, entryPrice: number) => {
    proportionalLot: number; riskBasedLot: number; multiplierLot: number; finalLot: number; riskAmount: number;
  };
}

export const useCopyTradingStore = create<CopyTradingStore>()(
  persist(
    (set, get) => ({
      masters: mockMasters,
      relationships: [],
      copyTrades: [],

      setupRelationship: (relationship) => {
        const newRel: CopyRelationship = {
          ...relationship,
          id: Date.now().toString(),
          totalCopiedTrades: 0,
          totalCopiedPnl: 0,
          consentedAt: Date.now(),
        };
        set((state) => ({ relationships: [...state.relationships, newRel] }));
      },

      updateRelationshipStatus: (id, status) =>
        set((state) => ({
          relationships: state.relationships.map(r => r.id === id ? { ...r, status } : r),
        })),

      addCopyTrade: (trade) => {
        const newTrade: CopyTrade = { ...trade, id: Date.now().toString(), timestamp: Date.now() };
        set((state) => ({ copyTrades: [newTrade, ...state.copyTrades] }));
      },

      setAiReport: (_cid, _pid, _report) => {}, // Competition AI report — handled in competitionStore

      calculateFollowerLot: (master, relationship, masterLot, slDistance, entryPrice) => {
        const valuePerPoint = entryPrice * 0.0001;
        const slValuePerLot = slDistance * valuePerPoint;
        const riskAmount = relationship.capitalAllocation * (relationship.riskPercent / 100);
        const proportionalLot = masterLot * (relationship.capitalAllocation / (master.totalTrades * 100));
        const riskBasedLot = slValuePerLot > 0 ? riskAmount / slValuePerLot : 0;
        const multiplierLot = masterLot * relationship.copyMultiplier;
        const finalLot = Math.min(
          proportionalLot > 0 ? proportionalLot : 999,
          riskBasedLot > 0 ? riskBasedLot : 999,
          multiplierLot,
          relationship.maxLot
        );
        return {
          proportionalLot: parseFloat(proportionalLot.toFixed(4)),
          riskBasedLot: parseFloat(riskBasedLot.toFixed(4)),
          multiplierLot: parseFloat(multiplierLot.toFixed(4)),
          finalLot: parseFloat(Math.max(finalLot, 0.01).toFixed(4)),
          riskAmount: parseFloat(riskAmount.toFixed(2)),
        };
      },
    }),
    {
      name: "copy-trading",
      storage: createJSONStorage(() => getUserScopedStorage("copy-trading")),
      partialize: (state) => ({
        relationships: state.relationships,
        copyTrades: state.copyTrades,
      }),
    }
  )
);