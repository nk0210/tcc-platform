/**
 * TCC Strategy Store
 *
 * Strategy types:
 * - educational_template: Famous strategies for learning reference only.
 *   No verified performance claims. Free. For paper trading education.
 * - creator_published: Strategies published by community members.
 *   Performance is self-reported — not independently verified.
 * - official: TCC-curated frameworks (placeholder for future).
 *
 * Performance status:
 * - unverified: No performance data (educational templates)
 * - self_reported: Creator-claimed performance, not independently verified
 * - verified: Independently verified (not yet implemented in Beta)
 *
 * No fake win rates for educational templates.
 * No fake "10,000 students bought this."
 * No guaranteed profit claims.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

// ── Types ─────────────────────────────────────────────────────────────────

export type StrategyType       = "official" | "educational_template" | "creator_published";
export type PerformanceStatus  = "unverified" | "self_reported" | "verified";
export type StrategyRisk       = "LOW" | "MEDIUM" | "HIGH";
export type StrategyPricing    = "free" | "one-time" | "subscription";

export interface StrategyReview {
  id: string;
  handle: string;
  rating: number;       // 1-5
  comment: string;
  timestamp: number;
}

export interface Strategy {
  id: string;
  title: string;
  description: string;
  type: StrategyType;
  authorHandle: string;
  authorTccId?: string;
  asset: string;
  assetCategory: "crypto" | "forex" | "commodity" | "index" | "all";
  timeframe: string;
  riskLevel: StrategyRisk;
  pricingModel: StrategyPricing;
  price: number;
  isFeatured: boolean;
  performanceStatus: PerformanceStatus;
  // Performance metrics — ONLY shown if performanceStatus is "self_reported" or "verified"
  // For "unverified" (educational templates): these are undefined
  winRate?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  totalTrades?: number;
  avgRR?: number;
  monthlyReturn?: number;
  rules: string[];
  entryConditions: string[];
  exitConditions: string[];
  riskManagement: string[];
  tags: string[];
  reviews: StrategyReview[];
  verified: boolean;
  version: string;
  disclaimer: string;             // Shown on all strategies
  linkedCourseId?: string;        // Cross-link to Academy
  createdAt: number;
  updatedAt: number;
}

export interface UserStrategyRecord {
  strategyId: string;
  savedAt?: number;
  savedToPlaybook: boolean;
  active: boolean;
}

// ── Educational disclaimer (reused) ───────────────────────────────────────
const EDU_DISCLAIMER =
  "Educational template only. For learning and reference. No verified performance data. " +
  "Past results (if shown as examples) do not predict future performance. Not financial advice. " +
  "Always use proper risk management when paper trading.";

const CREATOR_DISCLAIMER =
  "Creator-published strategy. Performance data is self-reported by the creator and has NOT been " +
  "independently verified by TCC. Use for educational purposes. Paper trade before committing real capital. Not financial advice.";

// ── Strategy data ─────────────────────────────────────────────────────────

const TCC_STRATEGIES: Strategy[] = [

  // ══════════════════════════════════════════════════════════════════════
  //  EDUCATIONAL TEMPLATES — Famous strategies for learning reference
  //  No performance claims. Free. Educational only.
  // ══════════════════════════════════════════════════════════════════════

  {
    id: "edu_ma_cross",
    title: "Moving Average Crossover",
    description: "One of the most widely known technical analysis frameworks. Uses two moving averages of different periods to identify potential trend direction changes. This is an educational reference template — not a guaranteed trading system.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H1 / H4",
    riskLevel: "LOW",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "Use a fast MA (e.g., 9 EMA) and a slow MA (e.g., 21 EMA)",
      "Only trade BUY when fast MA crosses above slow MA",
      "Only trade SELL when fast MA crosses below slow MA",
      "Wait for candle close above/below both MAs before entering",
      "Place stop loss below/above the most recent swing high or low",
      "Maximum 1-2% risk per trade regardless of signal",
    ],
    entryConditions: [
      "Fast MA has crossed slow MA within the last 3 candles",
      "Price is above both MAs (for BUY) or below both MAs (for SELL)",
      "Not in extreme overbought/oversold territory (check RSI optionally)",
    ],
    exitConditions: [
      "Take profit at 2x the distance of your stop loss (minimum)",
      "Exit if MA crossover reverses in the opposite direction",
      "Trail stop loss as price moves in your favor",
    ],
    riskManagement: [
      "Maximum 1-2% account risk per trade",
      "Stop loss mandatory — no exceptions",
      "Avoid during high-impact news events",
      "This strategy suffers in sideways/choppy markets",
    ],
    tags: ["Moving Average", "Trend Following", "Beginner", "Educational"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_tech_analysis",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_sr",
    title: "Support & Resistance Trading",
    description: "The most foundational price action approach. Identifies key horizontal levels where price has historically reacted and uses them for trade entries and exits. Educational reference template.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H1 / H4 / D1",
    riskLevel: "MEDIUM",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "Identify key S&R levels using swing highs and lows on H4 or D1",
      "Wait for price to reach the level, not chase it",
      "Look for a rejection candle (pin bar, engulfing) as confirmation",
      "Trade in the direction of the higher timeframe trend",
      "Never buy resistance in a strong downtrend",
      "Never sell support in a strong uptrend",
    ],
    entryConditions: [
      "Price has touched a key S&R level",
      "Rejection candlestick pattern confirmed (not anticipated)",
      "Level has been tested 2+ times historically",
      "Higher timeframe trend aligns with the trade direction",
    ],
    exitConditions: [
      "TP at next major S&R level in trade direction",
      "SL just beyond the S&R level (if breached, setup is invalid)",
      "Exit if price closes through the level with strong momentum",
    ],
    riskManagement: [
      "Maximum 1-2% risk per trade",
      "SL placed beyond the S&R level, not at it",
      "Wider levels need smaller lot sizes",
      "False breakouts are common — always use SL",
    ],
    tags: ["Price Action", "Support", "Resistance", "Educational", "Beginner"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_tech_analysis",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_breakout",
    title: "Breakout Trading",
    description: "Trading price breaks above key resistance or below key support, ideally with volume confirmation. Educational reference — false breakouts are common and must be managed with strict stops.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H1 / H4",
    riskLevel: "MEDIUM",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "Identify consolidation range or key resistance level first",
      "Wait for a candle to close above resistance (not just wick through)",
      "Enter on the first pullback after breakout — not the initial spike",
      "Stop loss below the breakout level",
      "Risk-reward minimum 1:2 before entering",
    ],
    entryConditions: [
      "Candle has closed convincingly beyond the key level",
      "Price pulls back toward the broken level (now support/resistance flip)",
      "Momentum indicators support the direction",
    ],
    exitConditions: [
      "TP at measured move: height of consolidation = target",
      "Exit if price closes back inside the range (false breakout)",
      "Trail stop after 1:1 is achieved",
    ],
    riskManagement: [
      "False breakouts are very common — always use SL",
      "Avoid breakout trades during news events",
      "Volume confirmation is stronger signal (crypto markets)",
      "1-2% risk maximum",
    ],
    tags: ["Breakout", "Momentum", "Volume", "Educational", "Intermediate"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_tech_analysis",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_fib",
    title: "Fibonacci Pullback",
    description: "Using Fibonacci retracement levels (38.2%, 50%, 61.8%) to identify pullback entry zones in trending markets. Works best in clearly trending conditions. Educational reference template.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H1 / H4",
    riskLevel: "MEDIUM",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "First confirm a clear trend with higher highs/lows or structure",
      "Draw Fibonacci from the most recent significant swing low to swing high (for uptrend)",
      "Wait for price to pull back to the 38.2%, 50%, or 61.8% zone",
      "Look for rejection candlestick confirmation at the zone",
      "Stop loss below the 78.6% level or swing low",
    ],
    entryConditions: [
      "Clear uptrend or downtrend established on H4 or D1",
      "Price has pulled back to a Fibonacci cluster zone",
      "Rejection candle confirmed (not anticipated)",
      "Zone aligns with other confluence (S&R, order block, etc.)",
    ],
    exitConditions: [
      "TP at the previous high (uptrend) or previous low (downtrend)",
      "TP at Fibonacci extensions: 127.2%, 161.8%",
      "Exit if price closes below SL level",
    ],
    riskManagement: [
      "Fibonacci alone is not enough — always combine with price action",
      "61.8% is the strongest retracement level (Fibonacci 'golden ratio')",
      "If 61.8% breaks, trend may have reversed — exit",
      "1-2% max risk per trade",
    ],
    tags: ["Fibonacci", "Pullback", "Trend", "Educational", "Intermediate"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_advanced",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_trend",
    title: "Trend Following System",
    description: "A systematic approach to identifying and following established trends across multiple timeframes. Mechanical rules reduce emotion. Works best in trending markets, struggles in ranges.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H4 / D1",
    riskLevel: "LOW",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "Trade only in the direction of the D1 trend",
      "D1 uptrend = only BUY entries on H4",
      "D1 downtrend = only SELL entries on H4",
      "Entry on pullback to 20 EMA on entry timeframe",
      "Trail stop loss using 50 EMA on entry timeframe",
      "Stay out of the market when DI trend is unclear or ranging",
    ],
    entryConditions: [
      "D1 shows clear trend with 3+ consecutive structure points",
      "Price pulls back to 20 EMA without breaking structure",
      "RSI pulls back from extreme and begins turning in trend direction",
    ],
    exitConditions: [
      "Exit when price closes below 50 EMA in an uptrend",
      "Exit when structure is broken (lower low in uptrend)",
      "Trail stop to protect profits — let winners run",
    ],
    riskManagement: [
      "Never fight the D1 trend",
      "Trend following has many small losses, few large wins — be patient",
      "Missing entries is fine — there will always be another",
      "1% risk per trade — wide stops are normal with trend following",
    ],
    tags: ["Trend Following", "Multi-Timeframe", "Systematic", "Educational", "Intermediate"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_advanced",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_mr",
    title: "Mean Reversion (Advanced)",
    description: "Counter-trend approach trading the hypothesis that price tends to revert to its statistical mean. Higher risk — goes against the trend. Educational reference for advanced traders only.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H1",
    riskLevel: "HIGH",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "ONLY use in clearly ranging, sideways markets — NOT in trends",
      "RSI must be above 75 for short or below 25 for long",
      "Price must be touching upper or lower Bollinger Band (2 std dev)",
      "Enter against the short-term move ONLY at extremes",
      "Tight stop loss — mean reversion has many losing trades",
      "Smaller position size than trend trades",
    ],
    entryConditions: [
      "Market is in defined range on H4 (not trending)",
      "RSI extreme reading at band touch",
      "No high-impact news in next 4 hours",
      "Previous mean reversion at this extreme has worked recently",
    ],
    exitConditions: [
      "TP at the middle Bollinger Band (20 SMA)",
      "Exit immediately if price continues beyond the band",
      "Do not hold mean reversion trades overnight in trending conditions",
    ],
    riskManagement: [
      "THIS IS A HIGH-RISK APPROACH — only advanced traders",
      "Going against the trend means you can be right on direction but wrong on timing",
      "Reduce position size by 50% vs normal trades",
      "Accept 60%+ losing trades — the winners need to be much larger",
    ],
    tags: ["Mean Reversion", "Counter-Trend", "Advanced", "High Risk", "Educational"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_advanced",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_smc",
    title: "SMC Educational Framework",
    description: "Educational introduction to Smart Money Concepts. Order blocks, liquidity pools, BOS, CHOCH, and FVG explained as a learning framework. Not a trading signal service.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "XAUUSD, Forex, Crypto",
    assetCategory: "all",
    timeframe: "H1 / H4",
    riskLevel: "MEDIUM",
    pricingModel: "free",
    price: 0,
    isFeatured: true,
    performanceStatus: "unverified",
    rules: [
      "Start with D1 bias: is price in discount or premium?",
      "Identify the most recent BOS or CHOCH on H4",
      "Drop to H1 for order block identification",
      "Wait for liquidity sweep before entry",
      "Enter on rejection from order block only after sweep",
      "SL below/above order block with buffer",
    ],
    entryConditions: [
      "HTF BOS/CHOCH aligned with trade direction",
      "Liquidity pool swept (stop hunt confirmed)",
      "Price has returned to a valid order block",
      "Fair value gap present between swing and entry zone",
    ],
    exitConditions: [
      "TP at next liquidity pool (equal highs/lows above/below)",
      "TP at opposite premium/discount zone",
      "Exit if order block is fully violated (3+ candle closes through it)",
    ],
    riskManagement: [
      "Maximum 1% risk per trade",
      "Not every OB will hold — SL is non-negotiable",
      "SMC requires significant screen time to develop eye for structure",
      "Paper trade SMC setups for minimum 3 months before real capital",
    ],
    tags: ["SMC", "Order Blocks", "Liquidity", "XAUUSD", "Educational", "Intermediate"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_rm",
    title: "Risk Management Framework",
    description: "Not a trading strategy — a risk management system. Position sizing formulas, stop loss placement logic, daily loss limits, and risk-reward requirements. Apply this to any strategy.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "All Timeframes",
    riskLevel: "LOW",
    pricingModel: "free",
    price: 0,
    isFeatured: true,
    performanceStatus: "unverified",
    rules: [
      "Maximum 1-2% account risk per trade — never exceed this",
      "Calculate lot size BEFORE entering: Risk $ ÷ (SL pips × pip value)",
      "Minimum 1:2 risk-reward ratio before entering any trade",
      "Daily loss limit: 3-5% of account — stop trading when hit",
      "Maximum 3 open positions simultaneously",
      "Never add to a losing position",
    ],
    entryConditions: [
      "Risk-reward is at least 1:2",
      "Stop loss level is logical (beyond structure, not arbitrary)",
      "Daily loss limit not yet reached",
      "Not trading against D1 trend without strong reason",
    ],
    exitConditions: [
      "Exit at predefined TP — do not move it further",
      "Do not remove SL — ever",
      "Trail SL after 1:1 is achieved to protect capital",
    ],
    riskManagement: [
      "This IS the risk management framework",
      "Apply these rules to every other strategy you use",
      "Risk management > strategy selection in determining long-term results",
      "No profitable strategy survives poor risk management",
    ],
    tags: ["Risk Management", "Position Sizing", "All Markets", "Educational", "Beginner"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_risk",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_pa",
    title: "Price Action Basics",
    description: "Reading raw candlestick charts without indicators. Understanding what buyers and sellers are doing at each candle. The foundation of all discretionary trading approaches.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H1 / H4",
    riskLevel: "MEDIUM",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "Understand what each candlestick communicates about supply/demand",
      "Look for confluence: candle pattern + key level + trend direction",
      "Rejection wicks show where price was rejected from — pay attention",
      "Body size matters: large body = strong momentum",
      "Wait for the candle to CLOSE before making decisions",
    ],
    entryConditions: [
      "Strong rejection candle at a key level",
      "Candle close confirms the rejection (not just a wick)",
      "Multiple timeframe alignment present",
      "Previous candle context supports the direction",
    ],
    exitConditions: [
      "TP at the next major price action resistance/support",
      "Exit if a strong opposing candle closes against your position",
      "SL behind the rejection candle with buffer",
    ],
    riskManagement: [
      "1-2% risk per trade",
      "Price action is discretionary — subjectivity is a challenge",
      "Journal all your price action reads to identify your biases",
      "Paper trade extensively before relying on PA in real trading",
    ],
    tags: ["Price Action", "Candlesticks", "No Indicators", "Educational", "Beginner"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_tech_analysis",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "edu_rsi_div",
    title: "RSI Divergence",
    description: "Using RSI divergence (price and momentum disagreement) to identify potential trend weakness or reversal. Educational reference — divergence alone is not a complete strategy.",
    type: "educational_template",
    authorHandle: "TCC Academy",
    asset: "All Markets",
    assetCategory: "all",
    timeframe: "H1",
    riskLevel: "MEDIUM",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "unverified",
    rules: [
      "Bearish divergence: price makes higher high, RSI makes lower high",
      "Bullish divergence: price makes lower low, RSI makes higher low",
      "Only use divergence with other confluence — not in isolation",
      "Wait for price action confirmation before entering",
      "Divergence signals momentum weakening, not reversal guarantee",
    ],
    entryConditions: [
      "Clear RSI divergence on H1 at a key S&R or order block level",
      "Price action confirmation: rejection candle at the divergence level",
      "HTF trend not strongly opposing the trade",
    ],
    exitConditions: [
      "TP at next S&R level or Fibonacci target",
      "SL beyond the divergence swing (high/low)",
      "Exit if divergence resolves without reversal (extended divergence)",
    ],
    riskManagement: [
      "Divergence alone has low reliability — always combine with confluence",
      "1-2% risk maximum",
      "Hidden divergence (trend continuation) vs regular divergence (reversal) — learn the difference",
    ],
    tags: ["RSI", "Divergence", "Momentum", "Educational", "Intermediate"],
    reviews: [],
    verified: false,
    version: "edu-1.0",
    disclaimer: EDU_DISCLAIMER,
    linkedCourseId: "c_tech_analysis",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // ══════════════════════════════════════════════════════════════════════
  //  CREATOR-PUBLISHED STRATEGIES — Self-reported performance
  //  Not independently verified. Use with caution.
  // ══════════════════════════════════════════════════════════════════════

  {
    id: "s1",
    title: "SMC Gold Sniper — XAUUSD",
    description: "Creator-published SMC-based strategy for XAUUSD specifically. Uses order blocks, liquidity sweeps, and BOS confirmation for entries. Performance data is self-reported.",
    type: "creator_published",
    authorHandle: "goldsniper_fx",
    authorTccId: "TCC-GL-TRD-00000001",
    asset: "XAUUSD",
    assetCategory: "commodity",
    timeframe: "H1",
    riskLevel: "MEDIUM",
    pricingModel: "subscription",
    price: 29,
    isFeatured: false,
    performanceStatus: "self_reported",
    winRate: 68.4,
    profitFactor: 2.8,
    maxDrawdown: 4.2,
    totalTrades: 342,
    avgRR: 2.1,
    monthlyReturn: 8.5,
    rules: [
      "Only trade during London or NY session",
      "Minimum 1:2 risk-reward required",
      "Max 1% risk per trade",
      "No trading 30 min before/after major news",
    ],
    entryConditions: [
      "Price sweeps liquidity on H4",
      "BOS confirmed on H1",
      "Order block identified on M15",
      "Price returns to OB zone with rejection",
    ],
    exitConditions: [
      "TP at next liquidity pool",
      "SL below OB with 10-pip buffer",
    ],
    riskManagement: [
      "1% max risk",
      "No trade without SL",
      "Stop after 2 consecutive losses",
    ],
    tags: ["SMC", "XAUUSD", "Order Blocks", "London Session"],
    reviews: [],
    verified: false,
    version: "v2.1",
    disclaimer: CREATOR_DISCLAIMER,
    linkedCourseId: "c1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "s2",
    title: "Risk-First EMA Pullback",
    description: "Creator-published disciplined EMA pullback strategy with strict risk rules. Works on any major forex pair according to the creator. Performance is self-reported, not verified.",
    type: "creator_published",
    authorHandle: "risk_master_99",
    authorTccId: "TCC-GL-TRD-00000004",
    asset: "All Forex Majors",
    assetCategory: "forex",
    timeframe: "H4",
    riskLevel: "LOW",
    pricingModel: "free",
    price: 0,
    isFeatured: false,
    performanceStatus: "self_reported",
    winRate: 62.1,
    profitFactor: 2.1,
    maxDrawdown: 2.8,
    totalTrades: 198,
    avgRR: 1.8,
    monthlyReturn: 4.2,
    rules: [
      "20 EMA must be above 50 EMA for bullish bias",
      "RSI between 40-60 for pullback entries",
      "Max 0.5% risk per trade on this strategy",
      "Only major forex pairs: EUR/USD, GBP/USD, AUD/USD",
    ],
    entryConditions: [
      "HTF trend aligned with EMA structure",
      "Price pulls back to 20 EMA",
      "RSI between 40-55 on pullback (not at extreme)",
    ],
    exitConditions: [
      "TP at previous swing high/low",
      "SL below 50 EMA",
    ],
    riskManagement: [
      "0.5% max risk (conservative)",
      "No trade if daily 3% loss limit reached",
    ],
    tags: ["EMA", "Pullback", "Low Risk", "Forex", "Conservative"],
    reviews: [],
    verified: false,
    version: "v1.3",
    disclaimer: CREATOR_DISCLAIMER,
    linkedCourseId: "c_tech_analysis",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  {
    id: "s3",
    title: "BTC Breakout Machine",
    description: "Creator-published crypto-specific breakout strategy for BTCUSDT. Volume confirmation required. High risk — breakouts can fail. Performance data is self-reported by the creator.",
    type: "creator_published",
    authorHandle: "btc_beast",
    authorTccId: "TCC-GL-TRD-00000002",
    asset: "BTCUSDT",
    assetCategory: "crypto",
    timeframe: "H1",
    riskLevel: "HIGH",
    pricingModel: "one-time",
    price: 49,
    isFeatured: false,
    performanceStatus: "self_reported",
    winRate: 58.3,
    profitFactor: 2.4,
    maxDrawdown: 8.1,
    totalTrades: 124,
    avgRR: 2.8,
    monthlyReturn: 11.2,
    rules: [
      "Only trade confirmed breakouts with volume",
      "Volume must be above 20-period average on breakout candle",
      "Enter on first pullback after breakout — not initial move",
      "High risk tolerance required — 8%+ drawdown is possible",
    ],
    entryConditions: [
      "Price breaks key resistance with strong volume",
      "RSI above 60 on breakout confirmation",
      "First pullback to broken resistance (now support)",
    ],
    exitConditions: [
      "TP at 2x breakout candle size measured move",
      "SL below breakout candle low with buffer",
    ],
    riskManagement: [
      "1-2% max risk per trade",
      "False breakouts are common in crypto — SL always active",
      "Reduce size on weekends (lower crypto liquidity)",
    ],
    tags: ["Bitcoin", "Breakout", "Crypto", "Volume", "High Risk"],
    reviews: [],
    verified: false,
    version: "v1.0",
    disclaimer: CREATOR_DISCLAIMER,
    linkedCourseId: "c4",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ── Store ─────────────────────────────────────────────────────────────────

interface StrategyStore {
  strategies: Strategy[];
  userStrategies: UserStrategyRecord[];

  saveStrategy:        (strategyId: string) => void;
  unsaveStrategy:      (strategyId: string) => void;
  togglePlaybook:      (strategyId: string) => void;
  isSaved:             (strategyId: string) => boolean;
  isInPlaybook:        (strategyId: string) => boolean;
  addReview:           (strategyId: string, review: Omit<StrategyReview, "id" | "timestamp">) => void;
  publishStrategy:     (strategy: Omit<Strategy, "id" | "reviews" | "createdAt" | "updatedAt">) => void;

  // Legacy compatibility
  purchaseStrategy:    (strategyId: string) => void;
}

export const useStrategyStore = create<StrategyStore>()(
  persist(
    (set, get) => ({
      strategies:     TCC_STRATEGIES,
      userStrategies: [],

      saveStrategy: (strategyId) => {
        const existing = get().userStrategies.find(u => u.strategyId === strategyId);
        if (existing) return;
        set(state => ({
          userStrategies: [
            ...state.userStrategies,
            { strategyId, savedAt: Date.now(), savedToPlaybook: false, active: true },
          ],
        }));
      },

      unsaveStrategy: (strategyId) => {
        set(state => ({
          userStrategies: state.userStrategies.filter(u => u.strategyId !== strategyId),
        }));
      },

      togglePlaybook: (strategyId) => {
        const existing = get().userStrategies.find(u => u.strategyId === strategyId);
        if (!existing) {
          // Auto-save when adding to playbook
          set(state => ({
            userStrategies: [
              ...state.userStrategies,
              { strategyId, savedAt: Date.now(), savedToPlaybook: true, active: true },
            ],
          }));
        } else {
          set(state => ({
            userStrategies: state.userStrategies.map(u =>
              u.strategyId !== strategyId ? u : { ...u, savedToPlaybook: !u.savedToPlaybook }
            ),
          }));
        }
      },

      isSaved: (strategyId) => {
        return !!get().userStrategies.find(u => u.strategyId === strategyId);
      },

      isInPlaybook: (strategyId) => {
        return !!get().userStrategies.find(u => u.strategyId === strategyId && u.savedToPlaybook);
      },

      addReview: (strategyId, review) => {
        set(state => ({
          strategies: state.strategies.map(s =>
            s.id !== strategyId ? s : {
              ...s,
              reviews: [
                ...s.reviews,
                { ...review, id: Date.now().toString(), timestamp: Date.now() },
              ],
              updatedAt: Date.now(),
            }
          ),
        }));
      },

      publishStrategy: (strategy) => {
        const newS: Strategy = {
          ...strategy,
          id:       `creator_${Date.now()}`,
          reviews:  [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(state => ({ strategies: [newS, ...state.strategies] }));
      },

      // Legacy: purchase = save
      purchaseStrategy: (strategyId) => get().saveStrategy(strategyId),
    }),
    {
      name:       "strategy",
      storage:    createJSONStorage(() => getUserScopedStorage("strategy")),
      partialize: (state) => ({ userStrategies: state.userStrategies }),
    }
  )
);