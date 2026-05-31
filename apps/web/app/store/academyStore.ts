import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

export type CourseLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PRO";
export type CourseCategory = "smc" | "forex" | "crypto" | "psychology" | "risk" | "technical" | "fundamental";

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
  videoUrl: string;
  description: string;
  completed: boolean;
  quizQuestions?: QuizQuestion[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  instructor: string;
  instructorHandle: string;
  level: CourseLevel;
  category: CourseCategory;
  thumbnail: string;
  lessons: Lesson[];
  totalDuration: string;
  enrolled: number;
  rating: number;
  price: number;
  isFree: boolean;
  tags: string[];
  completionCertificate: boolean;
}

export interface UserProgress {
  courseId: string;
  completedLessons: string[];
  quizScores: Record<string, number>;
  certificateEarned: boolean;
  enrolledAt: number;
  lastWatchedLesson?: string;
}

const mockCourses: Course[] = [
  {
    id: "c1",
    title: "Smart Money Concepts (SMC) Masterclass",
    description: "Learn the complete SMC framework — order blocks, liquidity, BOS, CHOCH, FVG, and premium/discount zones.",
    instructor: "goldsniper_fx", instructorHandle: "goldsniper_fx",
    level: "INTERMEDIATE", category: "smc", thumbnail: "📊",
    totalDuration: "4h 20m", enrolled: 1284, rating: 4.9, price: 0, isFree: true,
    tags: ["SMC", "XAUUSD", "Forex", "Order Blocks"],
    completionCertificate: true,
    lessons: [
      { id: "l1", title: "What is Smart Money?", duration: "12:30", videoUrl: "", description: "Understanding institutional trading vs retail trading", completed: false },
      { id: "l2", title: "Market Structure — BOS & CHOCH", duration: "18:45", videoUrl: "", description: "Break of structure and change of character explained", completed: false,
        quizQuestions: [
          { id: "q1", question: "What does BOS stand for?", options: ["Break of Structure", "Buy or Sell", "Bearish Open Signal", "Base of Support"], correctIndex: 0 },
          { id: "q2", question: "CHOCH indicates a potential...", options: ["Trend continuation", "Trend reversal", "Sideways market", "Volume spike"], correctIndex: 1 },
        ]
      },
      { id: "l3", title: "Order Blocks & Breaker Blocks", duration: "22:10", videoUrl: "", description: "Identifying high-probability OB entries", completed: false },
      { id: "l4", title: "Liquidity — EQH, EQL & Sweeps", duration: "15:20", videoUrl: "", description: "Where smart money hunts retail stops", completed: false },
      { id: "l5", title: "Fair Value Gaps (FVG)", duration: "14:00", videoUrl: "", description: "Imbalances in price and how to trade them", completed: false },
      { id: "l6", title: "Premium & Discount Zones", duration: "11:30", videoUrl: "", description: "Fibonacci-based entry optimization", completed: false },
      { id: "l7", title: "Full Trade Walkthrough — XAUUSD", duration: "28:15", videoUrl: "", description: "Live SMC trade from analysis to execution", completed: false },
    ],
  },
  {
    id: "c2",
    title: "Trading Psychology — Master Your Mind",
    description: "The psychological edge that separates profitable traders from the rest. FOMO, revenge trading, discipline.",
    instructor: "risk_master_99", instructorHandle: "risk_master_99",
    level: "BEGINNER", category: "psychology", thumbnail: "🧠",
    totalDuration: "2h 45m", enrolled: 2156, rating: 4.8, price: 0, isFree: true,
    tags: ["Psychology", "Discipline", "FOMO", "Mindset"],
    completionCertificate: true,
    lessons: [
      { id: "l1", title: "Why 90% of Traders Fail", duration: "10:00", videoUrl: "", description: "The psychological reasons behind retail losses", completed: false },
      { id: "l2", title: "Fear, Greed & FOMO", duration: "14:30", videoUrl: "", description: "Understanding your emotional triggers", completed: false,
        quizQuestions: [{ id: "q1", question: "FOMO in trading stands for?", options: ["Fear of Missing Out", "Force of Market Operations", "Fundamental Order Management", "Fear of Market Oscillation"], correctIndex: 0 }]
      },
      { id: "l3", title: "Revenge Trading — The Account Killer", duration: "12:20", videoUrl: "", description: "How to identify and stop revenge trading", completed: false },
      { id: "l4", title: "Building a Trading Routine", duration: "18:00", videoUrl: "", description: "Pre-market, during market, and post-market rituals", completed: false },
      { id: "l5", title: "Journaling for Growth", duration: "16:10", videoUrl: "", description: "How to use your journal to improve consistently", completed: false },
    ],
  },
  {
    id: "c3",
    title: "Risk Management — Protect Your Capital",
    description: "Complete risk management system. Position sizing, lot calculation, drawdown management.",
    instructor: "risk_master_99", instructorHandle: "risk_master_99",
    level: "BEGINNER", category: "risk", thumbnail: "🛡",
    totalDuration: "1h 55m", enrolled: 3421, rating: 4.9, price: 0, isFree: true,
    tags: ["Risk Management", "Position Sizing", "Drawdown"],
    completionCertificate: true,
    lessons: [
      { id: "l1", title: "The 1% Rule Explained", duration: "8:30", videoUrl: "", description: "Why risking 1% per trade is optimal", completed: false },
      { id: "l2", title: "Position Sizing Formula", duration: "14:00", videoUrl: "", description: "Calculate exact lot sizes using account balance and SL", completed: false },
      { id: "l3", title: "Drawdown Management", duration: "12:30", videoUrl: "", description: "When to stop trading and how to recover", completed: false },
      { id: "l4", title: "Correlation Risk", duration: "10:20", videoUrl: "", description: "Why trading EURUSD + GBPUSD + XAUUSD is dangerous", completed: false },
    ],
  },
  {
    id: "c4",
    title: "Bitcoin & Crypto Trading Fundamentals",
    description: "On-chain analysis, market cycles, altcoin season, Bitcoin dominance, and crypto-specific risk management.",
    instructor: "btc_beast", instructorHandle: "btc_beast",
    level: "INTERMEDIATE", category: "crypto", thumbnail: "₿",
    totalDuration: "3h 10m", enrolled: 876, rating: 4.7, price: 29, isFree: false,
    tags: ["Bitcoin", "Crypto", "On-chain", "Altcoins"],
    completionCertificate: true,
    lessons: [
      { id: "l1", title: "Bitcoin Market Cycles", duration: "16:00", videoUrl: "", description: "Halving cycles and their price impact", completed: false },
      { id: "l2", title: "On-Chain Analysis Basics", duration: "20:30", videoUrl: "", description: "Reading blockchain data for trade signals", completed: false },
      { id: "l3", title: "Altcoin Season Indicators", duration: "14:20", videoUrl: "", description: "When to rotate from BTC to alts", completed: false },
      { id: "l4", title: "Crypto Risk Management", duration: "12:00", videoUrl: "", description: "Why crypto needs different risk rules", completed: false },
      { id: "l5", title: "Live BTC Trade Analysis", duration: "25:10", videoUrl: "", description: "Full trade breakdown on BTCUSDT", completed: false },
    ],
  },
];

interface AcademyStore {
  courses: Course[];
  userProgress: Record<string, UserProgress>;
  enrollCourse: (courseId: string) => void;
  completeLesson: (courseId: string, lessonId: string) => void;
  submitQuiz: (courseId: string, lessonId: string, score: number) => void;
  isEnrolled: (courseId: string) => boolean;
  getProgress: (courseId: string) => number;
}

export const useAcademyStore = create<AcademyStore>()(
  persist(
    (set, get) => ({
      courses: mockCourses,
      userProgress: {},

      enrollCourse: (courseId) => {
        if (get().userProgress[courseId]) return;
        set((state) => ({
          userProgress: {
            ...state.userProgress,
            [courseId]: {
              courseId,
              completedLessons: [],
              quizScores: {},
              certificateEarned: false,
              enrolledAt: Date.now(),
            },
          },
        }));
      },

      completeLesson: (courseId, lessonId) => {
        set((state) => {
          const progress = state.userProgress[courseId];
          if (!progress) return state;
          const completedLessons = [...new Set([...progress.completedLessons, lessonId])];
          const course = state.courses.find(c => c.id === courseId);
          const certificateEarned = course ? completedLessons.length === course.lessons.length : false;
          return {
            userProgress: {
              ...state.userProgress,
              [courseId]: { ...progress, completedLessons, certificateEarned, lastWatchedLesson: lessonId },
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
              [courseId]: { ...progress, quizScores: { ...progress.quizScores, [lessonId]: score } },
            },
          };
        });
      },

      isEnrolled: (courseId) => !!get().userProgress[courseId],

      getProgress: (courseId) => {
        const progress = get().userProgress[courseId];
        const course = get().courses.find(c => c.id === courseId);
        if (!progress || !course) return 0;
        return Math.round((progress.completedLessons.length / course.lessons.length) * 100);
      },
    }),
    {
      name: "academy",
      storage: createJSONStorage(() => getUserScopedStorage("academy")),
      partialize: (state) => ({ userProgress: state.userProgress }),
    }
  )
);