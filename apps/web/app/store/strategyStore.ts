import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export type StrategyAsset = "XAUUSD" | "EURUSD" | "BTCUSDT" | "ALL" | "GBPUSD" | "NASDAQ";
export type StrategyTimeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";
export type StrategyRisk = "LOW" | "MEDIUM" | "HIGH";
export type PricingModel = "free" | "one-time" | "subscription";

export interface StrategyReview {
  id: string;
  handle: string;
  rating: number;
  comment: string;
  timestamp: number;
}

export interface Strategy {
  id: string;
  title: string;
  description: string;
  authorHandle: string;
  authorTccId: string;
  asset: StrategyAsset;
  timeframe: StrategyTimeframe;
  riskLevel: StrategyRisk;
  pricingModel: PricingModel;
  price: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  totalTrades: number;
  avgRR: number;
  monthlyReturn: number;
  tags: string[];
  rules: string[];
  entryConditions: string[];
  exitConditions: string[];
  reviews: StrategyReview[];
  purchased: boolean;
  verified: boolean;
  version: string;
  createdAt: number;
}

export interface UserStrategy {
  strategyId: string;
  active: boolean;
  purchasedAt: number;
}

const mockStrategies: Strategy[] = [
  {
    id: "s1", title: "SMC Gold Sniper — XAUUSD",
    description: "Complete SMC-based strategy for XAUUSD. Uses order blocks, liquidity sweeps, and BOS confirmation.",
    authorHandle: "goldsniper_fx", authorTccId: "TCC-GL-TRD-00000001",
    asset: "XAUUSD", timeframe: "H1", riskLevel: "MEDIUM",
    pricingModel: "subscription", price: 29,
    winRate: 68.4, profitFactor: 2.8, maxDrawdown: 4.2, totalTrades: 342, avgRR: 2.1, monthlyReturn: 8.5,
    tags: ["SMC", "XAUUSD", "Order Blocks", "London Session"],
    rules: ["Only trade during London or NY session", "Minimum 1:2 RR required", "Max 1% risk per trade"],
    entryConditions: ["Price sweeps liquidity", "BOS confirmed on H1", "Order block on M15", "Price returns to OB"],
    exitConditions: ["TP at next liquidity level", "SL below OB with buffer"],
    reviews: [], purchased: false, verified: true, version: "v2.1", createdAt: Date.now(),
  },
  {
    id: "s2", title: "Risk-First EMA Pullback",
    description: "Disciplined EMA pullback strategy with strict risk rules. Works on any major forex pair.",
    authorHandle: "risk_master_99", authorTccId: "TCC-GL-TRD-00000004",
    asset: "ALL", timeframe: "H4", riskLevel: "LOW",
    pricingModel: "free", price: 0,
    winRate: 62.1, profitFactor: 2.1, maxDrawdown: 2.8, totalTrades: 198, avgRR: 1.8, monthlyReturn: 4.2,
    tags: ["EMA", "Pullback", "Low Risk", "Forex"],
    rules: ["20 EMA above 50 EMA for bullish bias", "RSI between 40-60", "Max 0.5% risk"],
    entryConditions: ["HTF trend with EMA alignment", "Price pulls back to 20 EMA", "RSI bullish divergence"],
    exitConditions: ["TP at previous swing high", "SL below 50 EMA"],
    reviews: [], purchased: false, verified: true, version: "v1.3", createdAt: Date.now(),
  },
  {
    id: "s3", title: "BTC Breakout Machine",
    description: "Crypto-specific breakout strategy for BTCUSDT. Volume confirmation and momentum entries.",
    authorHandle: "btc_beast", authorTccId: "TCC-GL-TRD-00000002",
    asset: "BTCUSDT", timeframe: "H1", riskLevel: "HIGH",
    pricingModel: "one-time", price: 49,
    winRate: 58.3, profitFactor: 2.4, maxDrawdown: 8.1, totalTrades: 124, avgRR: 2.8, monthlyReturn: 11.2,
    tags: ["Bitcoin", "Breakout", "Momentum", "Crypto"],
    rules: ["Only trade confirmed breakouts", "Volume must be 1.5x average"],
    entryConditions: ["Price breaks key resistance with volume", "RSI above 60"],
    exitConditions: ["TP at 2x breakout candle size", "SL below breakout candle low"],
    reviews: [], purchased: false, verified: true, version: "v1.0", createdAt: Date.now(),
  },
];

interface StrategyStore {
  strategies: Strategy[];
  userStrategies: UserStrategy[];
  purchaseStrategy: (strategyId: string) => void;
  addReview: (strategyId: string, review: Omit<StrategyReview, "id" | "timestamp">) => void;
  publishStrategy: (strategy: Omit<Strategy, "id" | "reviews" | "purchased" | "createdAt" | "version">) => void;
}

export const useStrategyStore = create<StrategyStore>()(
  persist(
    (set) => ({
      strategies: mockStrategies,
      userStrategies: [],

      purchaseStrategy: (strategyId) => {
        set((state) => ({
          strategies: state.strategies.map(s => s.id === strategyId ? { ...s, purchased: true } : s),
          userStrategies: [...state.userStrategies, { strategyId, active: true, purchasedAt: Date.now() }],
        }));
      },

      addReview: (strategyId, review) => {
        set((state) => ({
          strategies: state.strategies.map(s =>
            s.id === strategyId
              ? { ...s, reviews: [...s.reviews, { ...review, id: Date.now().toString(), timestamp: Date.now() }] }
              : s
          ),
        }));
      },

      publishStrategy: (strategy) => {
        set((state) => ({
          strategies: [{
            ...strategy,
            id: Date.now().toString(),
            reviews: [],
            purchased: true,
            createdAt: Date.now(),
            version: "v1.0",
          }, ...state.strategies],
        }));
      },
    }),
    {
      name: "strategy",
      storage: createJSONStorage(() => getUserScopedStorage("strategy")),
      partialize: (state) => ({
        userStrategies: state.userStrategies,
        strategies: state.strategies.map(s => ({
          id: s.id,
          purchased: s.purchased,
          reviews: s.reviews,
        })),
      }),
    }
  )
);