/**
 * TCC Strategy Store
 *
 * Canonical types (aligned with actual codebase):
 *   StrategyRisk:    "LOW" | "MEDIUM" | "HIGH"
 *   StrategyPricing: "free" | "one-time" | "subscription"
 *   assetCategory:   replaces "assetClass"
 *   riskManagement:  replaces "riskManagementRules"
 *   disclaimer:      replaces "performanceDisclaimer"
 *   linkedCourseId:  replaces "linkedAcademyCourseId"
 *   pricingModel:    replaces "isPaid"
 *   StrategyReview uses "handle" (not authorHandle) and "timestamp" (not createdAt)
 *   UserStrategyRecord: { strategyId, savedAt?, savedToPlaybook, active }
 *   userStrategies: UserStrategyRecord[] — NOT Strategy[]
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

// ── Types ─────────────────────────────────────────────────────────────────

export type StrategyType      = "official" | "educational_template" | "creator_published";
export type PerformanceStatus = "unverified" | "self_reported" | "verified";
export type StrategyRisk      = "LOW" | "MEDIUM" | "HIGH";
export type StrategyPricing   = "free" | "one-time" | "subscription";

export interface StrategyReview {
  id:        string;
  handle:    string;
  rating:    number;
  comment:   string;
  timestamp: number;
}

export interface Strategy {
  id:                string;
  title:             string;
  description:       string;
  type:              StrategyType;
  authorHandle:      string;
  authorTccId?:      string;
  asset:             string;
  assetCategory:     string;   // "all" | "crypto" | "forex" | "commodity" | "index"
  timeframe:         string;   // "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1" | "any"
  riskLevel:         StrategyRisk;
  pricingModel:      StrategyPricing;
  price:             number;
  isFeatured:        boolean;
  performanceStatus: PerformanceStatus;
  winRate?:          number;
  profitFactor?:     number;
  maxDrawdown?:      number;
  totalTrades?:      number;
  avgRR?:            number;
  monthlyReturn?:    number;
  rules:             string[];
  entryConditions:   string[];
  exitConditions:    string[];
  riskManagement:    string[];
  tags:              string[];
  reviews:           StrategyReview[];
  verified:          boolean;
  version:           string;
  disclaimer:        string;
  linkedCourseId?:   string;
  createdAt:         number;
  updatedAt:         number;
}

export interface UserStrategyRecord {
  strategyId:      string;
  savedAt?:        number;
  savedToPlaybook: boolean;
  active:          boolean;
}

// ── Static catalog ────────────────────────────────────────────────────────
// Always starts here; reviews and creator-published strategies are persisted
// on top of this catalog via onRehydrateStorage.

const STRATEGY_CATALOG: Strategy[] = [
  // ── OFFICIAL TCC ─────────────────────────────────────────────────────

  {
    id:               "official-risk-template",
    title:            "TCC Risk Management Template",
    description:
      "The official TCC risk management framework. Use this as the foundation for any strategy. Defines lot sizing, stop loss rules, daily loss limits, and position management principles.",
    type:             "official",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "any",
    riskLevel:        "LOW",
    pricingModel:     "free",
    price:            0,
    isFeatured:       true,
    performanceStatus: "unverified",
    rules: [
      "Never risk more than 1% of your account per trade",
      "Set a stop loss on every single trade — no exceptions",
      "Maximum 3% total risk across all open positions",
      "Stop trading for the day after hitting 2% daily loss",
      "Minimum 1:1.5 risk-to-reward before entering a trade",
      "Never move stop loss to a worse position",
    ],
    entryConditions: [
      "Risk:reward ratio is at least 1:1.5",
      "Stop loss placement is logical (below structure, not arbitrary)",
      "Position size is calculated correctly before entry",
      "Daily loss limit has not been hit",
    ],
    exitConditions: [
      "Price hits your pre-defined stop loss",
      "Price hits your pre-defined take profit",
      "Setup is invalidated by new price action",
    ],
    riskManagement: [
      "Calculate lot size using: account × 1% ÷ SL distance",
      "Use TCC paper trading to practise position sizing first",
      "Journal every trade and review weekly",
    ],
    tags:          ["risk management", "official", "foundation", "must-read"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "This is a risk management framework, not a trade signal system. Following this does not guarantee profits.",
    linkedCourseId: "tcc-risk-101",
    createdAt:     1700000000000,
    updatedAt:     1700000000000,
  },

  {
    id:               "official-pre-trade",
    title:            "TCC Pre-Trade Checklist",
    description:
      "A systematic pre-trade checklist to run through before opening any paper trade on TCC. Covers bias, structure, risk, session, and psychological state. Use this before every single trade.",
    type:             "official",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "any",
    riskLevel:        "LOW",
    pricingModel:     "free",
    price:            0,
    isFeatured:       true,
    performanceStatus: "unverified",
    rules: [
      "Complete ALL items before entering a trade",
      "If any item fails, do not trade",
    ],
    entryConditions: [
      "✅ HTF (daily/H4) bias is clear",
      "✅ Entry timeframe aligns with HTF bias",
      "✅ Key level or zone identified for entry",
      "✅ Stop loss placed at logical structural level",
      "✅ Risk:reward is at least 1:1.5",
      "✅ Position size is calculated",
      "✅ Not trading within 30 minutes of high-impact news",
      "✅ Emotional state is calm and neutral",
      "✅ Daily loss limit not reached",
    ],
    exitConditions: [
      "Trade triggers according to plan",
      "Do not adjust the plan after entry without valid reason",
    ],
    riskManagement: [
      "Journal the checklist adherence in your TCC journal after closing",
      "Review adherence weekly in the Behavior analytics tab",
    ],
    tags:          ["checklist", "official", "discipline", "pre-trade"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "A checklist aids discipline but does not guarantee trade outcomes.",
    linkedCourseId: "tcc-101",
    createdAt:     1700000001000,
    updatedAt:     1700000001000,
  },

  // ── EDUCATIONAL TEMPLATES ─────────────────────────────────────────────

  {
    id:               "strat-ma-crossover",
    title:            "Moving Average Crossover",
    description:
      "A classic educational strategy using two Exponential Moving Averages (EMA 20 and EMA 50). When the fast EMA crosses above the slow EMA, it suggests bullish momentum. For educational and paper trading learning only.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "H1",
    riskLevel:        "MEDIUM",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Use EMA 20 (fast) and EMA 50 (slow) on H1 chart",
      "Only trade in the direction of the crossover",
      "Do not trade in choppy or ranging markets",
      "Always use a stop loss below the most recent swing low (BUY) or above swing high (SELL)",
      "Risk maximum 1% per trade",
    ],
    entryConditions: [
      "EMA 20 crosses above EMA 50 → potential BUY setup",
      "EMA 20 crosses below EMA 50 → potential SELL setup",
      "Price is clearly trending (not sideways/choppy)",
    ],
    exitConditions: [
      "Take profit at next significant resistance (BUY) or support (SELL)",
      "Exit if EMA crossover reverses in opposite direction",
      "Stop loss below swing low for BUY / above swing high for SELL",
    ],
    riskManagement: [
      "Do not enter after a large move has already occurred",
      "Filter signals using HTF trend direction",
    ],
    tags:          ["EMA", "moving average", "crossover", "trend following", "beginner"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. Moving average crossovers are lagging indicators. No verified performance data. Paper trade only.",
    linkedCourseId: "res-ma-crossover",
    createdAt:     1700000002000,
    updatedAt:     1700000002000,
  },

  {
    id:               "strat-support-resistance",
    title:            "Support & Resistance Breakout",
    description:
      "One of the most fundamental approaches in technical analysis. Trade the breakout of a significant support or resistance level, or the bounce from it. An educational framework for understanding how price interacts with key levels.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "H1",
    riskLevel:        "MEDIUM",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Only trade levels with at least 2 previous touches",
      "Wait for confirmation before entering (close above/below the level)",
      "Set stop loss on the other side of the level",
      "Target the next key level for take profit",
      "Do not force trades at weak or unclear levels",
    ],
    entryConditions: [
      "Price has touched the level at least twice previously",
      "For breakout: candle closes convincingly above resistance / below support",
      "For bounce: price approaches level with momentum, shows rejection candle",
    ],
    exitConditions: [
      "Take profit at the next major support or resistance level",
      "Stop loss on the wrong side of the breached level",
      "Exit if breakout reverses back through the level (false breakout)",
    ],
    riskManagement: [
      "Wait for candle close confirmation, not just a wick",
      "Be aware of false breakouts — they are very common",
    ],
    tags:          ["support", "resistance", "breakout", "bounce", "technical analysis"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. False breakouts are common. No verified performance data. Paper trade this extensively before considering real capital.",
    linkedCourseId: "res-support-resistance",
    createdAt:     1700000003000,
    updatedAt:     1700000003000,
  },

  {
    id:               "strat-fibonacci",
    title:            "Fibonacci Pullback",
    description:
      "An educational strategy using Fibonacci retracement levels as potential entry zones during a pullback within an established trend. The 38.2%, 50%, and 61.8% levels are most commonly used. For learning only.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "H4",
    riskLevel:        "MEDIUM",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Only trade in the direction of the dominant trend",
      "Draw Fibonacci from swing low to swing high for uptrend (reverse for downtrend)",
      "Look for entry confirmation at key Fibonacci levels",
      "Target the 100% extension (previous swing high) for take profit",
    ],
    entryConditions: [
      "Clear trend established on H4 or higher timeframe",
      "Price pulls back to 38.2%, 50%, or 61.8% Fibonacci level",
      "Rejection candle or SMC confirmation at the Fibonacci level",
    ],
    exitConditions: [
      "Take profit at 100% extension (previous swing high/low)",
      "Partial exit at 50% extension for partial profit management",
      "Stop loss below 78.6% level (invalidation of Fibonacci thesis)",
    ],
    riskManagement: [
      "Fibonacci levels work better with additional confluence",
      "Avoid during high-impact news events",
    ],
    tags:          ["fibonacci", "pullback", "retracement", "trend", "intermediate"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. Fibonacci levels are areas of interest, not guaranteed reversal points. No verified performance data.",
    linkedCourseId: "res-fibonacci",
    createdAt:     1700000004000,
    updatedAt:     1700000004000,
  },

  {
    id:               "strat-trend-following",
    title:            "Trend Following (EMA Ribbon)",
    description:
      "An educational approach to trend following using multiple EMAs (20, 50, 100, 200). When shorter EMAs are above longer EMAs, the trend is bullish. Trade pullbacks to the ribbon.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "D1",
    riskLevel:        "LOW",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Trade on D1 or H4 timeframe only",
      "Only trade when all EMAs (20, 50, 100, 200) are in alignment",
      "Enter on pullbacks to the EMA ribbon, not at the extreme",
      "Trail stop loss below previous swing low as trend develops",
    ],
    entryConditions: [
      "EMA 20 > EMA 50 > EMA 100 > EMA 200 (bullish alignment)",
      "EMA 20 < EMA 50 < EMA 100 < EMA 200 (bearish alignment)",
      "Price pulls back to touch EMA 20 or EMA 50",
      "Bullish rejection candle at the EMA for long / bearish for short",
    ],
    exitConditions: [
      "Stop loss below EMA 50 or previous swing low",
      "Trail stop as trade develops",
      "Exit when EMAs begin to lose alignment",
    ],
    riskManagement: [
      "Trend following requires patience — do not rush entries",
      "Drawdowns in between trends are normal and expected",
    ],
    tags:          ["trend following", "EMA ribbon", "pullback", "daily", "swing trading"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. Trend following strategies perform well in trending markets and poorly in ranging ones. No verified performance data.",
    createdAt:     1700000005000,
    updatedAt:     1700000005000,
  },

  {
    id:               "strat-mean-reversion",
    title:            "Mean Reversion (Bollinger Bands)",
    description:
      "An educational mean reversion approach using Bollinger Bands. When price extends significantly from the mean (middle band), it tends to revert. Trade the return to the mean. Works best in ranging markets.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "H1",
    riskLevel:        "HIGH",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Only use in clearly ranging (non-trending) markets",
      "Look for price touching or piercing the outer Bollinger Band",
      "Require a reversal candle before entry",
      "Target the middle band as take profit",
      "Strict stop loss on the other side of the outer band",
    ],
    entryConditions: [
      "Market is clearly ranging (price oscillating between support and resistance)",
      "Price has touched or pierced the upper band (short) or lower band (long)",
      "A pin bar, doji, or engulfing candle signals reversal at the band",
    ],
    exitConditions: [
      "Take profit at the middle Bollinger Band (20 EMA)",
      "Stop loss outside the Bollinger Band extreme",
      "Exit immediately if trend starts forming",
    ],
    riskManagement: [
      "NEVER use in trending markets — this is the biggest risk of mean reversion",
      "Reduce position size compared to trend strategies due to higher risk",
    ],
    tags:          ["mean reversion", "Bollinger Bands", "ranging", "contrarian", "intermediate"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. Mean reversion strategies can experience large losses in strongly trending markets. High risk rating. No verified performance data.",
    createdAt:     1700000006000,
    updatedAt:     1700000006000,
  },

  {
    id:               "strat-smc-template",
    title:            "SMC Order Block Approach (Educational)",
    description:
      "An educational template for Smart Money Concepts (SMC) trading. Identifies order blocks after a Break of Structure (BOS) and enters on price return to the order block zone. Complex — requires significant screen time.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "H1",
    riskLevel:        "MEDIUM",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Identify HTF (D1/H4) bias first",
      "Identify a Break of Structure (BOS) on H1",
      "Mark the order block (last opposing candle before BOS)",
      "Wait for price to return to the order block",
      "Enter on OB touch with a small risk",
      "SL: just below/above the order block",
      "TP: next liquidity pool or previous high/low",
    ],
    entryConditions: [
      "HTF trend is established and clear",
      "BOS confirmed on entry timeframe (H1)",
      "Valid order block identified (institutional candle before BOS)",
      "Price pulls back to the OB zone",
      "Rejection candle or FVG mitigated within OB",
    ],
    exitConditions: [
      "TP at the next liquidity pool or equal highs/lows",
      "SL just below/above the order block with small buffer",
      "Invalidation: price closes significantly through the order block",
    ],
    riskManagement: [
      "Minimum 1:2 risk-to-reward",
      "Do not force OB entries — be selective",
      "Mark levels BEFORE price arrives, not after",
    ],
    tags:          ["SMC", "order blocks", "BOS", "liquidity", "price action"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. SMC concepts require significant screen time and practice to apply correctly. No verified performance data. High learning curve.",
    linkedCourseId: "tcc-smc-201",
    createdAt:     1700000007000,
    updatedAt:     1700000007000,
  },

  {
    id:               "strat-price-action",
    title:            "Price Action & Candlestick Patterns",
    description:
      "An educational strategy using pure price action — no indicators. Read candlestick formations, key levels, and market structure to find high-probability entry zones.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "H4",
    riskLevel:        "MEDIUM",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Use no indicators — price and levels only",
      "Identify key support and resistance levels first",
      "Look for strong rejection candles at key levels",
      "Trade with the dominant trend direction where possible",
    ],
    entryConditions: [
      "Price has reached a key structural level",
      "A rejection candlestick pattern forms at the level (pin bar, engulfing, hammer)",
      "The pattern is on H4 or higher timeframe for higher reliability",
      "Level has been tested at least twice before",
    ],
    exitConditions: [
      "Stop loss behind the tail of the rejection candle",
      "Take profit at the next key level",
      "Exit if a new rejection candle forms against the position",
    ],
    riskManagement: [
      "Context is everything — a pin bar in a trend is different from one in a range",
      "Confluence of level + pattern + trend increases probability",
    ],
    tags:          ["price action", "candlesticks", "pin bar", "engulfing", "no indicators"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. Price action is subjective and requires significant practice. No verified performance data.",
    linkedCourseId: "tcc-price-action-101",
    createdAt:     1700000008000,
    updatedAt:     1700000008000,
  },

  {
    id:               "strat-breakout-momentum",
    title:            "Breakout & Momentum Strategy",
    description:
      "An educational approach to trading price breakouts with momentum confirmation. When price breaks through a significant level with strong momentum, it often continues in that direction. For educational purposes only.",
    type:             "educational_template",
    authorHandle:     "TCC",
    asset:            "All",
    assetCategory:    "all",
    timeframe:        "H1",
    riskLevel:        "HIGH",
    pricingModel:     "free",
    price:            0,
    isFeatured:       false,
    performanceStatus: "unverified",
    rules: [
      "Only trade breakouts from well-defined levels (not arbitrary price points)",
      "Wait for candle close ABOVE/BELOW the level — no anticipation",
      "Volume should be above average at the breakout candle",
      "Look for a brief retest of the broken level before entry — safer",
    ],
    entryConditions: [
      "Price breaks through a clear, tested resistance or support level",
      "Breakout candle closes beyond the level with strong body",
      "No major opposing level within 1:1.5 RR distance",
    ],
    exitConditions: [
      "Stop loss just below the broken level (for long breakout)",
      "Take profit at the next significant resistance",
      "If price returns back below the level — exit immediately (false breakout)",
    ],
    riskManagement: [
      "False breakouts are extremely common — risk management is critical",
      "Reduce position size vs standard setups due to higher false positive rate",
    ],
    tags:          ["breakout", "momentum", "volume", "continuation", "high risk"],
    reviews:       [],
    verified:      false,
    version:       "1.0",
    disclaimer:
      "Educational template only. Breakout strategies have a high false breakout rate. No verified performance data. High risk rating.",
    createdAt:     1700000009000,
    updatedAt:     1700000009000,
  },
];

// ── Store interface ───────────────────────────────────────────────────────

interface StrategyStore {
  strategies:     Strategy[];
  userStrategies: UserStrategyRecord[];

  saveStrategy:    (strategyId: string) => void;
  unsaveStrategy:  (strategyId: string) => void;
  togglePlaybook:  (strategyId: string) => void;
  isSaved:         (strategyId: string) => boolean;
  isInPlaybook:    (strategyId: string) => boolean;

  addReview: (
    strategyId: string,
    review: Omit<StrategyReview, "id" | "timestamp">
  ) => void;

  publishStrategy: (
    strategy: Omit<Strategy, "id" | "reviews" | "createdAt" | "updatedAt">
  ) => void;

  updateStrategyNotes: (strategyId: string, notes: string) => void;

  // Convenience: returns strategies + user-published (all in strategies[])
  getAllStrategies: () => Strategy[];
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useStrategyStore = create<StrategyStore>()(
  persist(
    (set, get) => ({
      strategies:     STRATEGY_CATALOG,
      userStrategies: [],

      saveStrategy: (strategyId) => {
        if (get().userStrategies.find((r) => r.strategyId === strategyId)) return;
        set((state) => ({
          userStrategies: [
            ...state.userStrategies,
            {
              strategyId,
              savedAt:         Date.now(),
              savedToPlaybook: false,
              active:          false,
            },
          ],
        }));
      },

      unsaveStrategy: (strategyId) =>
        set((state) => ({
          userStrategies: state.userStrategies.filter(
            (r) => r.strategyId !== strategyId
          ),
        })),

      togglePlaybook: (strategyId) =>
        set((state) => ({
          userStrategies: state.userStrategies.map((r) =>
            r.strategyId !== strategyId
              ? r
              : { ...r, savedToPlaybook: !r.savedToPlaybook }
          ),
        })),

      isSaved: (strategyId) =>
        !!get().userStrategies.find((r) => r.strategyId === strategyId),

      isInPlaybook: (strategyId) =>
        !!get().userStrategies.find(
          (r) => r.strategyId === strategyId && r.savedToPlaybook
        ),

      addReview: (strategyId, reviewInput) => {
        const review: StrategyReview = {
          id:        `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          handle:    reviewInput.handle,
          rating:    reviewInput.rating,
          comment:   reviewInput.comment,
          timestamp: Date.now(),
        };
        set((state) => ({
          strategies: state.strategies.map((s) =>
            s.id !== strategyId
              ? s
              : { ...s, reviews: [review, ...s.reviews], updatedAt: Date.now() }
          ),
        }));
      },

      publishStrategy: (strategyData) => {
        const newStrategy: Strategy = {
          ...strategyData,
          id:        `creator_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          reviews:   [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          strategies: [newStrategy, ...state.strategies],
        }));
      },

      updateStrategyNotes: (_strategyId, _notes) => {
        // Notes stored in UserStrategyRecord — extend UserStrategyRecord if needed
        // Currently a no-op placeholder for future notes field
      },

      getAllStrategies: () => get().strategies,
    }),
    {
      name:    "strategy",
      storage: createJSONStorage(() => getUserScopedStorage("strategy")),
      partialize: (state) => ({
        // Persist only user records + published strategies + reviews
        userStrategies: state.userStrategies,
        // Persist creator_published strategies + review patches for catalog
        strategies: state.strategies.map((s) =>
          s.type === "creator_published"
            ? s  // persist full creator strategy
            : { id: s.id, reviews: s.reviews }  // persist only reviews for catalog
        ),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Rebuild strategies from catalog + persisted reviews + creator strategies
        const reviewMap: Record<string, StrategyReview[]> = {};
        const creatorStrategies: Strategy[] = [];

        if (Array.isArray(state.strategies)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          state.strategies.forEach((s: any) => {
            if (s.id && s.reviews) reviewMap[s.id] = s.reviews;
            if (s.type === "creator_published" && s.title) {
              creatorStrategies.push(s as Strategy);
            }
          });
        }

        state.strategies = [
          ...STRATEGY_CATALOG.map((s) => ({
            ...s,
            reviews: reviewMap[s.id] ?? [],
          })),
          ...creatorStrategies,
        ];
      },
    }
  )
);