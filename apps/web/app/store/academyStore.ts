/**
 * TCC Academy Store
 *
 * - No fake ratings (rating field removed)
 * - No fake enrolled count (enrolled field removed)
 * - Certificate status is honest: unavailable / coming_soon / earned
 * - Courses linked to strategy templates via linkedStrategyIds
 * - Progress persisted user-scoped via getUserScopedStorage
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

// ── Types ─────────────────────────────────────────────────────────────────

export type CourseType       = "official" | "free_resource" | "creator_published";
export type CourseLevel      = "beginner" | "intermediate" | "advanced";
export type CourseCertStatus = "unavailable" | "coming_soon" | "earned";
export type CourseCategory   = "fundamentals" | "technical" | "smc" | "risk" | "psychology" | "crypto" | "forex" | "strategy";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  description: string;
  keyPoints: string[];
  quizQuestions?: QuizQuestion[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  type: CourseType;
  level: CourseLevel;
  category: CourseCategory;
  instructor: string;
  instructorHandle: string;
  thumbnail: string;
  lessons: Lesson[];
  totalDuration: string;
  isFree: boolean;
  price: number;
  tags: string[];
  certificateAvailable: boolean;    // If false, show "Certificate not available"
  linkedStrategyIds: string[];       // Cross-link to strategy marketplace
  createdAt: number;
  // NOTE: No rating, no enrolled count — these would be fake data.
}

export interface UserProgress {
  courseId: string;
  completedLessons: string[];
  quizScores: Record<string, number>;
  certificateEarned: boolean;
  enrolledAt: number;
  lastWatchedLesson?: string;
}

// ── Courses data (no fake ratings or enrolled counts) ────────────────────

const TCC_COURSES: Course[] = [
  // ── BEGINNER PATH ─────────────────────────────────────────────────────
  {
    id: "c_fundamentals",
    title: "Trading Fundamentals",
    description: "Start here. Understand what trading is, how markets work, who the participants are, and what paper trading means. No prior knowledge required.",
    type: "official",
    level: "beginner",
    category: "fundamentals",
    instructor: "TCC Academy",
    instructorHandle: "tcc_academy",
    thumbnail: "📘",
    totalDuration: "1h 40m",
    isFree: true,
    price: 0,
    tags: ["Beginner", "Markets", "Paper Trading", "Order Types"],
    certificateAvailable: false,
    linkedStrategyIds: [],
    createdAt: Date.now(),
    lessons: [
      { id: "l1", title: "What is Trading?", duration: "8:00", description: "An honest look at what financial market trading is, and what it is not. Understanding speculation vs investing.", keyPoints: ["Markets allow buying and selling of financial instruments", "Speculative trading ≠ investing", "Most retail traders lose — why honesty matters", "Paper trading is a safe way to learn"] },
      { id: "l2", title: "How Markets Work", duration: "12:00", description: "Supply, demand, liquidity, and why prices move. Who actually moves the markets.", keyPoints: ["Price is determined by supply and demand", "Market participants: retail, institutional, market makers", "Liquidity — why some markets move faster", "Market sessions: Asian, London, New York"] },
      { id: "l3", title: "Order Types Explained", duration: "10:00", description: "Market orders, limit orders, stop orders, and stop-limit orders — what they are and when to use them.", keyPoints: ["Market orders — execute immediately at best price", "Limit orders — execute at your specified price", "Stop loss — protect your capital automatically", "Take profit — lock in gains automatically"] },
      { id: "l4", title: "Reading Price Charts", duration: "15:00", description: "Introduction to candlestick charts. What each candle tells you about buyer/seller behavior.", keyPoints: ["OHLC: Open, High, Low, Close", "Candlestick anatomy and color", "Bullish vs bearish candles", "Timeframes: M1 to Monthly"], quizQuestions: [
        { id: "q1", question: "What does OHLC stand for?", options: ["Open, High, Low, Close", "Order, Hold, Limit, Cancel", "Only Highly Liquid Currency", "Open, Hold, Lock, Close"], correctIndex: 0 },
        { id: "q2", question: "A bullish candlestick closes:", options: ["Below its open", "At its high", "Above its open", "At its low"], correctIndex: 2 },
      ]},
      { id: "l5", title: "Introduction to Risk Management", duration: "10:00", description: "Why protecting capital is more important than making profits. The foundation of sustainable trading.", keyPoints: ["You can be wrong 60% of the time and still profit", "Never risk more than 1-2% per trade", "Stop loss is not optional — it is required", "Paper trading lets you learn without real losses"] },
      { id: "l6", title: "Paper Trading on TCC", duration: "5:00", description: "How to use TCC's paper trading system to practice safely. What is simulated and what is not.", keyPoints: ["TCC paper mode uses real live prices (crypto)", "P&L calculations are internal paper models", "Journal every trade — it is how you improve", "Paper performance does not guarantee real performance"] },
    ],
  },

  {
    id: "c_tech_analysis",
    title: "Technical Analysis Foundations",
    description: "Learn the core tools of technical analysis: support and resistance, moving averages, trend identification, and momentum indicators. Educational reference only.",
    type: "official",
    level: "beginner",
    category: "technical",
    instructor: "TCC Academy",
    instructorHandle: "tcc_academy",
    thumbnail: "📈",
    totalDuration: "2h 15m",
    isFree: true,
    price: 0,
    tags: ["Technical Analysis", "Indicators", "Support & Resistance", "Beginner"],
    certificateAvailable: false,
    linkedStrategyIds: ["edu_ma_cross", "edu_sr", "edu_breakout", "edu_pa", "edu_rsi_div"],
    createdAt: Date.now(),
    lessons: [
      { id: "l1", title: "Trend Identification", duration: "14:00", description: "How to identify uptrends, downtrends, and sideways markets using price structure.", keyPoints: ["Higher highs + higher lows = uptrend", "Lower highs + lower lows = downtrend", "Trend is your edge — trade with it, not against it", "Multiple timeframe confirmation"] },
      { id: "l2", title: "Support & Resistance", duration: "18:00", description: "The most fundamental concept in technical analysis. How to identify, draw, and use S&R levels.", keyPoints: ["Support: price level where buyers step in", "Resistance: price level where sellers step in", "Old resistance becomes new support (and vice versa)", "Round numbers often act as psychological S&R"], quizQuestions: [
        { id: "q1", question: "When price breaks above resistance, that level typically becomes:", options: ["New resistance", "New support", "Irrelevant", "A stop loss level"], correctIndex: 1 },
      ]},
      { id: "l3", title: "Moving Averages", duration: "16:00", description: "Simple and exponential moving averages — what they measure, how to use them, and their limitations.", keyPoints: ["MA smooths price to identify trend direction", "SMA vs EMA — speed vs smoothness", "200 MA: long-term trend reference", "MA crossovers as entry signals (educational example)"] },
      { id: "l4", title: "RSI and Momentum", duration: "14:00", description: "Using the Relative Strength Index to identify overbought/oversold conditions and divergence.", keyPoints: ["RSI above 70: overbought (not a guaranteed sell signal)", "RSI below 30: oversold (not a guaranteed buy signal)", "RSI divergence: price vs momentum disagreement", "No indicator is perfect — combine with context"] },
      { id: "l5", title: "Volume Analysis Basics", duration: "12:00", description: "Why volume matters and how it confirms or questions price movement.", keyPoints: ["High volume confirms trend strength", "Low volume on breakout = weak move", "Volume spikes at key reversals", "Volume is harder to fake than price"] },
      { id: "l6", title: "Candlestick Patterns", duration: "20:00", description: "Key candlestick patterns and what they may indicate about buyer/seller balance.", keyPoints: ["Engulfing patterns", "Doji — indecision", "Pin bars / hammer and shooting star", "These are signals, not guarantees"] },
    ],
  },

  {
    id: "c_risk",
    title: "Risk Management Mastery",
    description: "The single most important skill in trading. Position sizing, stop loss placement, risk-reward ratios, and daily loss rules. No profitable strategy works without this.",
    type: "official",
    level: "beginner",
    category: "risk",
    instructor: "TCC Academy",
    instructorHandle: "tcc_academy",
    thumbnail: "🛡",
    totalDuration: "1h 55m",
    isFree: true,
    price: 0,
    tags: ["Risk Management", "Position Sizing", "Stop Loss", "Capital Protection"],
    certificateAvailable: false,
    linkedStrategyIds: ["edu_rm"],
    createdAt: Date.now(),
    lessons: [
      { id: "l1", title: "The 1% Rule", duration: "10:00", description: "Why risking 1-2% per trade preserves your account through losing streaks.", keyPoints: ["At 1% risk: 10 consecutive losses = 9.5% drawdown", "At 10% risk: 10 consecutive losses = 65% drawdown", "Losing streaks are inevitable — plan for them", "Your job is to survive, then grow"] },
      { id: "l2", title: "Position Sizing Formula", duration: "14:00", description: "How to calculate exact lot sizes based on account balance, stop loss distance, and risk percentage.", keyPoints: ["Risk Amount = Balance × Risk%", "Lot Size = Risk Amount / (SL distance × pip value)", "Always calculate BEFORE opening a trade", "TCC paper mode helps you practice this in real-time"] },
      { id: "l3", title: "Stop Loss Placement", duration: "16:00", description: "Where to place stop losses logically — based on market structure, not arbitrary distances.", keyPoints: ["SL goes beyond structure, not randomly placed", "No SL = gambling, not trading", "Wider SL with smaller lot = same risk, more room", "Adjust lot size to keep risk consistent"] },
      { id: "l4", title: "Risk-Reward Ratios", duration: "12:00", description: "Why a 1:2 minimum risk-reward changes your profitability math dramatically.", keyPoints: ["1:2 RR: win rate only needs to be >33% to be profitable", "1:1 RR: needs >50% win rate — much harder", "Chasing trades with poor RR destroys profitability", "Set TP before entering — not during panic"], quizQuestions: [
        { id: "q1", question: "With a 1:2 risk-reward ratio, what minimum win rate is needed to break even?", options: ["50%", "40%", "33%", "25%"], correctIndex: 2 },
      ]},
      { id: "l5", title: "Daily Loss Limits", duration: "8:00", description: "Why daily loss limits prevent spiral drawdowns and protect your psychology.", keyPoints: ["Set a daily loss limit (e.g. 3% of account)", "When hit: STOP trading for the day", "Revenge trading after losses amplifies damage", "In funded challenges, daily DD limits are hard rules"] },
    ],
  },

  // ── INTERMEDIATE PATH ───────────────────────────────────────────────────
  {
    id: "c1",
    title: "Smart Money Concepts (SMC) Masterclass",
    description: "Complete SMC framework — order blocks, liquidity, BOS, CHOCH, FVG, and premium/discount zones. Educational reference for the institutional approach to price action.",
    type: "official",
    level: "intermediate",
    category: "smc",
    instructor: "TCC Academy",
    instructorHandle: "tcc_academy",
    thumbnail: "📊",
    totalDuration: "4h 20m",
    isFree: true,
    price: 0,
    tags: ["SMC", "XAUUSD", "Order Blocks", "Institutional"],
    certificateAvailable: false,
    linkedStrategyIds: ["edu_smc"],
    createdAt: Date.now(),
    lessons: [
      { id: "l1", title: "What is Smart Money?", duration: "12:00", description: "Understanding institutional trading concepts vs retail trading approaches.", keyPoints: ["Institutional traders = banks, hedge funds, market makers", "Smart money leaves footprints in price action", "This is an educational framework, not a guaranteed system", "Order flow thinking vs indicator thinking"] },
      { id: "l2", title: "Market Structure — BOS & CHOCH", duration: "18:00", description: "Break of structure (BOS) and change of character (CHOCH) explained step by step.", keyPoints: ["BOS: trend continues — price breaks previous high/low", "CHOCH: trend reversal signal — structure shifts", "Not every BOS/CHOCH leads to a strong move", "Confirm with higher timeframe context"], quizQuestions: [
        { id: "q1", question: "What does BOS stand for?", options: ["Break of Structure", "Buy or Sell", "Bearish Open Signal", "Base of Support"], correctIndex: 0 },
        { id: "q2", question: "CHOCH indicates a potential:", options: ["Trend continuation", "Trend reversal", "Sideways market", "Volume spike"], correctIndex: 1 },
      ]},
      { id: "l3", title: "Order Blocks & Breaker Blocks", duration: "22:00", description: "Identifying institutional order zones for high-probability entry areas.", keyPoints: ["Order block: last opposing candle before strong move", "Breaker block: order block that has been violated", "Not all OBs hold — context is everything", "Combine with BOS for higher confidence"] },
      { id: "l4", title: "Liquidity — EQH, EQL & Sweeps", duration: "15:00", description: "Where stop losses are clustered and how price moves to collect them.", keyPoints: ["EQH: equal highs = liquidity pool above", "EQL: equal lows = liquidity pool below", "Price sweeps liquidity before reversing (sometimes)", "This is educational — not every sweep reverses"] },
      { id: "l5", title: "Fair Value Gaps (FVG)", duration: "14:00", description: "Price imbalances and how they may act as magnets for future price.", keyPoints: ["FVG: 3-candle formation with no overlap", "Price often returns to fill imbalances", "Not all FVGs are filled", "Use on entry TF, confirm on HTF"] },
      { id: "l6", title: "Premium & Discount Zones", duration: "11:00", description: "Using Fibonacci 50% level as a divider for optimal entry zones.", keyPoints: ["Above 50% = premium (expensive to buy, ideal to sell)", "Below 50% = discount (cheap to buy, ideal to buy)", "Combines with OBs and liquidity concepts", "Still no guarantee — risk management always applies"] },
      { id: "l7", title: "Full Trade Walkthrough — XAUUSD", duration: "28:00", description: "Example trade analysis using SMC concepts. Educational only, not a signal.", keyPoints: ["HTF to LTF analysis sequence", "Identifying the narrative before trading", "Entry, SL, and TP placement using SMC", "Post-trade review importance"] },
    ],
  },

  {
    id: "c2",
    title: "Trading Psychology — Master Your Mind",
    description: "The psychological edge that separates consistent traders from gamblers. FOMO, revenge trading, overconfidence, and how to build mental discipline.",
    type: "official",
    level: "intermediate",
    category: "psychology",
    instructor: "TCC Academy",
    instructorHandle: "tcc_academy",
    thumbnail: "🧠",
    totalDuration: "2h 45m",
    isFree: true,
    price: 0,
    tags: ["Psychology", "Discipline", "FOMO", "Mindset", "Consistency"],
    certificateAvailable: false,
    linkedStrategyIds: [],
    createdAt: Date.now(),
    lessons: [
      { id: "l1", title: "Why Most Traders Fail", duration: "10:00", description: "Honest statistics and the real psychological reasons behind retail trading losses.", keyPoints: ["~70-80% of retail traders lose money long-term", "Losses are NOT due to lack of strategies", "Psychology and risk management are the root causes", "Understanding failure is the first step to avoiding it"] },
      { id: "l2", title: "Fear, Greed & FOMO", duration: "14:00", description: "Identifying your emotional triggers and how they affect trading decisions.", keyPoints: ["Fear: hesitating on valid setups, moving SL too early", "Greed: over-trading, removing TP prematurely", "FOMO: chasing price after missing an entry", "Awareness is the first defense"], quizQuestions: [
        { id: "q1", question: "FOMO in trading stands for:", options: ["Fear of Missing Out", "Force of Market Operations", "Fundamental Order Management", "Fear of Market Oscillation"], correctIndex: 0 },
      ]},
      { id: "l3", title: "Revenge Trading — The Account Killer", duration: "12:00", description: "What revenge trading is, why it happens, and concrete strategies to stop it.", keyPoints: ["Revenge trading: increasing size/frequency after a loss", "Driven by ego, not analysis", "Daily loss limit is your circuit breaker", "Walk away rule: 2 losses in a row = done for the day"] },
      { id: "l4", title: "Building a Trading Routine", duration: "18:00", description: "Pre-market, during-market, and post-market rituals that create consistency.", keyPoints: ["Pre-market: bias, key levels, economic calendar", "During: stick to the plan, no impulsive decisions", "Post-market: journal every trade, no exceptions", "Weekend: review, identify patterns, reset"] },
      { id: "l5", title: "Journaling for Growth", duration: "16:00", description: "How to use your TCC journal to identify patterns, fix mistakes, and improve systematically.", keyPoints: ["Journal is your most valuable trading tool", "Record emotion, plan adherence, and lessons", "Analytics reveal patterns you cannot see in the moment", "Consistent journaling = accelerated improvement"] },
    ],
  },

  // ── ADVANCED PATH ────────────────────────────────────────────────────────
  {
    id: "c_advanced",
    title: "Advanced Chart Reading",
    description: "Multi-timeframe analysis, Fibonacci techniques, market profile concepts, and building a complete personal trading system. Intermediate knowledge required.",
    type: "official",
    level: "advanced",
    category: "technical",
    instructor: "TCC Academy",
    instructorHandle: "tcc_academy",
    thumbnail: "🔬",
    totalDuration: "3h 30m",
    isFree: true,
    price: 0,
    tags: ["Advanced", "Multi-Timeframe", "Fibonacci", "Trading System"],
    certificateAvailable: false,
    linkedStrategyIds: ["edu_fib", "edu_trend", "edu_mr"],
    createdAt: Date.now(),
    lessons: [
      { id: "l1", title: "Multi-Timeframe Analysis", duration: "22:00", description: "How to align trade direction across multiple timeframes for higher confluence.", keyPoints: ["HTF sets the bias (D1, H4)", "MTF confirms the structure (H1)", "LTF provides entry trigger (M15, M5)", "Never trade against all three timeframes"] },
      { id: "l2", title: "Advanced Fibonacci Techniques", duration: "20:00", description: "Beyond the 61.8% — using Fibonacci extensions, clusters, and projections.", keyPoints: ["38.2%, 50%, 61.8% retracement as entry zones", "161.8% extension for TP targets", "Fibonacci clusters: multiple levels aligning = stronger zone", "Combine with S&R and OBs"] },
      { id: "l3", title: "Trend Following Systems", duration: "18:00", description: "Building a rules-based trend following approach. What works and what does not.", keyPoints: ["Trend following is mechanical, not discretionary", "Entry on pullback to MA or key level", "Wide SL, trail as trend develops", "Trend following works best in strongly trending markets"] },
      { id: "l4", title: "Mean Reversion Concepts", duration: "16:00", description: "When and why price reverts to mean. High-risk, counter-trend approach — advanced traders only.", keyPoints: ["Mean reversion = betting on price returning to average", "Works in ranging, non-trending markets", "Higher risk: fighting the trend", "Requires tight rules and strict risk management"] },
      { id: "l5", title: "Building Your Trading System", duration: "35:00", description: "A framework for defining your own complete trading system — from timeframe to risk management.", keyPoints: ["Define: what, when, where, how much", "Write your rules — if you cannot write it, you have no system", "Backtest on paper trades first", "Iterate: trade, journal, review, refine"] },
    ],
  },

  // ── CREATOR PUBLISHED ────────────────────────────────────────────────────
  {
    id: "c4",
    title: "Bitcoin & Crypto Trading Fundamentals",
    description: "On-chain analysis basics, crypto market cycles, Bitcoin dominance, and crypto-specific risk considerations. Creator-published educational resource.",
    type: "creator_published",
    level: "intermediate",
    category: "crypto",
    instructor: "btc_beast",
    instructorHandle: "btc_beast",
    thumbnail: "₿",
    totalDuration: "3h 10m",
    isFree: true,
    price: 0,
    tags: ["Bitcoin", "Crypto", "On-chain", "Market Cycles"],
    certificateAvailable: false,
    linkedStrategyIds: [],
    createdAt: Date.now(),
    lessons: [
      { id: "l1", title: "Bitcoin Market Cycles", duration: "16:00", description: "Understanding halving cycles and their historical (not guaranteed) impact on BTC price.", keyPoints: ["Halving: BTC supply issuance cut in half every ~4 years", "Historical pattern: bull market after halving (not guaranteed)", "Past performance ≠ future results", "Cycle thinking helps context, not timing"] },
      { id: "l2", title: "On-Chain Analysis Basics", duration: "20:00", description: "Reading blockchain data — wallet activity, exchange flows, and miner behavior.", keyPoints: ["Exchange inflows: potential selling pressure", "Exchange outflows: potential accumulation", "Long-term holder behavior vs short-term", "On-chain data is lagging, not predictive"] },
      { id: "l3", title: "Altcoin Season Dynamics", duration: "14:00", description: "Understanding Bitcoin dominance and when altcoins typically outperform.", keyPoints: ["BTC dominance dropping = altcoins gaining", "Altcoin season follows BTC bull runs historically", "Altcoins are higher risk than BTC", "Not every altcoin follows the pattern"] },
      { id: "l4", title: "Crypto-Specific Risk Management", duration: "12:00", description: "Why crypto requires different risk rules than forex or indices.", keyPoints: ["24/7 market: weekends have lower liquidity", "Higher volatility = wider SLs needed", "Exchange risk: not your keys, not your coins (for real accounts)", "Paper trading crypto on TCC avoids these risks"] },
    ],
  },
];

// ── Store ─────────────────────────────────────────────────────────────────

interface AcademyStore {
  courses: Course[];
  userProgress: Record<string, UserProgress>;

  enrollCourse:  (courseId: string) => void;
  unenrollCourse:(courseId: string) => void;
  completeLesson:(courseId: string, lessonId: string) => void;
  submitQuiz:    (courseId: string, lessonId: string, score: number) => void;
  isEnrolled:    (courseId: string) => boolean;
  getProgress:   (courseId: string) => number;
  hasEarnedCert: (courseId: string) => boolean;
}

export const useAcademyStore = create<AcademyStore>()(
  persist(
    (set, get) => ({
      courses:      TCC_COURSES,
      userProgress: {},

      enrollCourse: (courseId) => {
        if (get().userProgress[courseId]) return; // already enrolled
        set((state) => ({
          userProgress: {
            ...state.userProgress,
            [courseId]: {
              courseId,
              completedLessons: [],
              quizScores:       {},
              certificateEarned: false,
              enrolledAt:       Date.now(),
            },
          },
        }));
      },

      unenrollCourse: (courseId) => {
        set((state) => {
          const { [courseId]: _, ...rest } = state.userProgress;
          return { userProgress: rest };
        });
      },

      completeLesson: (courseId, lessonId) => {
        set((state) => {
          const progress = state.userProgress[courseId];
          if (!progress) return state;
          const completedLessons = [...new Set([...progress.completedLessons, lessonId])];
          const course = state.courses.find(c => c.id === courseId);
          const allDone = course ? completedLessons.length >= course.lessons.length : false;
          const certEarned = allDone && (course?.certificateAvailable ?? false);
          return {
            userProgress: {
              ...state.userProgress,
              [courseId]: {
                ...progress,
                completedLessons,
                lastWatchedLesson: lessonId,
                certificateEarned: progress.certificateEarned || certEarned,
              },
            },
          };
        });
      },

      submitQuiz: (courseId, lessonId, score) => {
        set((state) => {
          const progress = state.userProgress[courseId];
          if (!progress) return state;
          return {
            userProgress: {
              ...state.userProgress,
              [courseId]: {
                ...progress,
                quizScores: { ...progress.quizScores, [lessonId]: score },
              },
            },
          };
        });
      },

      isEnrolled:    (courseId) => !!get().userProgress[courseId],

      getProgress: (courseId) => {
        const progress = get().userProgress[courseId];
        const course   = get().courses.find(c => c.id === courseId);
        if (!progress || !course) return 0;
        return Math.round((progress.completedLessons.length / course.lessons.length) * 100);
      },

      hasEarnedCert: (courseId) => {
        return !!get().userProgress[courseId]?.certificateEarned;
      },
    }),
    {
      name:       "academy",
      storage:    createJSONStorage(() => getUserScopedStorage("academy")),
      partialize: (state) => ({ userProgress: state.userProgress }),
    }
  )
);