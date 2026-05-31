import { create } from "zustand";

export type StrategyAsset = "XAUUSD" | "EURUSD" | "BTCUSDT" | "ALL" | "GBPUSD" | "NASDAQ";
export type StrategyTimeframe = "M1" | "M5" | "M15" | "H1" | "H4" | "D1";
export type StrategyRisk = "LOW" | "MEDIUM" | "HIGH";
export type PricingModel = "free" | "one-time" | "subscription";

export interface StrategyReview {
  id: string;
  handle: string;
  rating: number;
  comment: string;
  timestamp: Date;
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
  createdAt: Date;
}

export interface UserStrategy {
  strategyId: string;
  active: boolean;
  purchasedAt: Date;
}

const mockStrategies: Strategy[] = [
  {
    id: "s1",
    title: "SMC Gold Sniper — XAUUSD",
    description: "A complete SMC-based strategy for XAUUSD. Uses order blocks, liquidity sweeps, and BOS confirmation for high-probability entries. Designed for London and NY sessions.",
    authorHandle: "goldsniper_fx",
    authorTccId: "TCC-GL-TRD-00000001",
    asset: "XAUUSD", timeframe: "H1", riskLevel: "MEDIUM",
    pricingModel: "subscription", price: 29,
    winRate: 68.4, profitFactor: 2.8, maxDrawdown: 4.2,
    totalTrades: 342, avgRR: 2.1, monthlyReturn: 8.5,
    tags: ["SMC", "XAUUSD", "Order Blocks", "London Session"],
    rules: ["Only trade during London or NY session", "Minimum 1:2 RR required", "Max 1% risk per trade", "No trading before high-impact news"],
    entryConditions: ["Price sweeps liquidity (EQH/EQL)", "BOS confirmed on H1", "Order block identified on M15", "Price returns to OB in discount zone"],
    exitConditions: ["TP at next liquidity level", "SL below OB with buffer", "Trail SL after 1:1 reached"],
    reviews: [
      { id: "r1", handle: "trader_raj", rating: 5, comment: "Best XAUUSD strategy I've used. Clear rules, consistent results.", timestamp: new Date(Date.now() - 86400000 * 3) },
      { id: "r2", handle: "london_scalper", rating: 4, comment: "Solid strategy. Takes time to master but worth it.", timestamp: new Date(Date.now() - 86400000 * 7) },
    ],
    purchased: false, verified: true, version: "v2.1",
    createdAt: new Date("2026-01-15"),
  },
  {
    id: "s2",
    title: "Risk-First EMA Pullback",
    description: "A disciplined EMA pullback strategy with strict risk rules. Uses 20/50 EMA alignment, RSI confirmation, and defined risk parameters. Works on any major forex pair.",
    authorHandle: "risk_master_99",
    authorTccId: "TCC-GL-TRD-00000004",
    asset: "ALL", timeframe: "H4", riskLevel: "LOW",
    pricingModel: "free", price: 0,
    winRate: 62.1, profitFactor: 2.1, maxDrawdown: 2.8,
    totalTrades: 198, avgRR: 1.8, monthlyReturn: 4.2,
    tags: ["EMA", "Pullback", "Low Risk", "Forex"],
    rules: ["20 EMA above 50 EMA for bullish bias", "RSI between 40-60 for entry", "Max 0.5% risk per trade", "No more than 2 open trades"],
    entryConditions: ["HTF trend confirmed with EMA alignment", "Price pulls back to 20 EMA", "RSI shows bullish divergence", "Engulfing candle at EMA touch"],
    exitConditions: ["TP at previous swing high", "SL below 50 EMA", "Exit if EMA cross occurs"],
    reviews: [
      { id: "r3", handle: "newbie_trader", rating: 5, comment: "Perfect for beginners. Clear and simple rules.", timestamp: new Date(Date.now() - 86400000 * 2) },
    ],
    purchased: false, verified: true, version: "v1.3",
    createdAt: new Date("2026-02-01"),
  },
  {
    id: "s3",
    title: "BTC Breakout Machine",
    description: "Crypto-specific breakout strategy for BTCUSDT. Identifies key resistance levels, volume confirmation, and momentum entries. Works best during US market hours.",
    authorHandle: "btc_beast",
    authorTccId: "TCC-GL-TRD-00000002",
    asset: "BTCUSDT", timeframe: "H1", riskLevel: "HIGH",
    pricingModel: "one-time", price: 49,
    winRate: 58.3, profitFactor: 2.4, maxDrawdown: 8.1,
    totalTrades: 124, avgRR: 2.8, monthlyReturn: 11.2,
    tags: ["Bitcoin", "Breakout", "Momentum", "Crypto"],
    rules: ["Only trade confirmed breakouts", "Volume must be 1.5x average", "Max 2% risk per trade", "No entries during weekend"],
    entryConditions: ["Price breaks key resistance with volume", "RSI above 60 on breakout candle", "No major news within 2 hours", "BTC dominance > 45%"],
    exitConditions: ["TP at 2x breakout candle size", "SL below breakout candle low", "Exit if price returns into range"],
    reviews: [
      { id: "r4", handle: "crypto_king", rating: 4, comment: "High win rate on bull markets. Be careful in ranging markets.", timestamp: new Date(Date.now() - 86400000 * 5) },
    ],
    purchased: false, verified: true, version: "v1.0",
    createdAt: new Date("2026-03-10"),
  },
  {
    id: "s4",
    title: "EURUSD Fundamental Confluence",
    description: "Combines macro fundamentals with technical analysis for EURUSD. DXY correlation, economic calendar integration, and key level confluence for swing trades.",
    authorHandle: "eurusd_queen",
    authorTccId: "TCC-GL-TRD-00000003",
    asset: "EURUSD", timeframe: "D1", riskLevel: "LOW",
    pricingModel: "subscription", price: 19,
    winRate: 64.7, profitFactor: 1.9, maxDrawdown: 3.1,
    totalTrades: 89, avgRR: 1.6, monthlyReturn: 3.8,
    tags: ["EURUSD", "Fundamentals", "DXY", "Swing Trading"],
    rules: ["Check DXY correlation before entry", "No trades against weekly bias", "Max 3 swing trades open", "Avoid trading during ECB/Fed weeks"],
    entryConditions: ["Weekly bias confirmed by DXY", "Price at key S/R on D1", "Economic calendar checked", "HTF structure supports direction"],
    exitConditions: ["TP at weekly swing high/low", "SL above/below key level", "Exit before major news event"],
    reviews: [],
    purchased: false, verified: true, version: "v1.1",
    createdAt: new Date("2026-02-20"),
  },
];

interface StrategyStore {
  strategies: Strategy[];
  userStrategies: UserStrategy[];
  purchaseStrategy: (strategyId: string) => void;
  addReview: (strategyId: string, review: Omit<StrategyReview, "id" | "timestamp">) => void;
  publishStrategy: (strategy: Omit<Strategy, "id" | "reviews" | "purchased" | "createdAt" | "version">) => void;
}

export const useStrategyStore = create<StrategyStore>((set) => ({
  strategies: mockStrategies,
  userStrategies: [],

  purchaseStrategy: (strategyId) => {
    set((state) => ({
      strategies: state.strategies.map(s => s.id === strategyId ? { ...s, purchased: true } : s),
      userStrategies: [...state.userStrategies, { strategyId, active: true, purchasedAt: new Date() }],
    }));
  },

  addReview: (strategyId, review) => {
    set((state) => ({
      strategies: state.strategies.map(s => s.id === strategyId ? {
        ...s,
        reviews: [...s.reviews, { ...review, id: Date.now().toString(), timestamp: new Date() }],
      } : s),
    }));
  },

  publishStrategy: (strategy) => {
    const newStrategy: Strategy = {
      ...strategy,
      id: Date.now().toString(),
      reviews: [],
      purchased: true,
      createdAt: new Date(),
      version: "v1.0",
    };
    set((state) => ({ strategies: [newStrategy, ...state.strategies] }));
  },
}));