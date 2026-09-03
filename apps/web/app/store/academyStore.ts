/**
 * TCC Academy Store — Phase Alpha
 * API-backed courses + per-user progress (enrollment, lesson completion, quizzes).
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

export type CourseType        = "OFFICIAL" | "FREE_RESOURCE" | "CREATOR_PUBLISHED";
export type CourseLevel       = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type CertificateStatus = "UNAVAILABLE" | "COMING_SOON" | "EARNED";
export type LessonType        = "TEXT" | "VIDEO" | "QUIZ" | "EXERCISE";

export interface Lesson {
  id:          string;
  courseId:    string;
  title:       string;
  description: string;
  duration:    string;
  type:        LessonType;
  content:     string | null;
  orderIndex:  number;
}

export interface Course {
  id:                string;
  title:             string;
  description:       string;
  type:              CourseType;
  level:             CourseLevel;
  category:          string;
  thumbnail:         string;
  totalDuration:     string;
  isPaid:            boolean;
  price:             number;
  certificateStatus: CertificateStatus;
  linkedStrategyId:  string | null;
  creatorId:         string | null;
  creatorName:       string | null;
  tags:              string[];
  lessons:           Lesson[];
  createdAt:         string;
  updatedAt:         string;
}

export interface AcademyProgress {
  id:                string;
  userId:            string;
  courseId:          string;
  completedLessons:  string[];
  quizScores:        Record<string, number>;
  lastLessonId:      string | null;
  completedAt:       string | null;
  certificateStatus: CertificateStatus;
  enrolledAt:        string;
  updatedAt:         string;
}

export interface CertificateStatusResult {
  status:         CertificateStatus;
  completedCount: number;
  totalLessons:   number;
  isComplete:     boolean;
}

interface CourseWithProgress extends Course {
  isEnrolled: boolean;
  progress:   AcademyProgress | null;
}

const PAGE_SIZE = 50;

// ── Store ─────────────────────────────────────────────────────────────────

interface AcademyStore {
  courses:       Course[];
  myProgress:    Record<string, AcademyProgress>;
  isLoading:     boolean;
  isSyncing:     boolean;
  isInitialized: boolean;
  error:         string | null;

  init:  () => Promise<void>;
  reset: () => void;

  getCourse:            (courseId: string) => Promise<CourseWithProgress | null>;
  enrollInCourse:       (courseId: string) => Promise<void>;
  completeLesson:       (courseId: string, lessonId: string) => Promise<void>;
  submitQuizScore:      (courseId: string, lessonId: string, score: number) => Promise<void>;
  getCertificateStatus: (courseId: string) => Promise<CertificateStatusResult | null>;
}

export const useAcademyStore = create<AcademyStore>()((set, get) => ({
  courses:       [],
  myProgress:    {},
  isLoading:     false,
  isSyncing:     false,
  isInitialized: false,
  error:         null,

  // ── Init ──────────────────────────────────────────────────────────────

  init: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true, error: null });

    try {
      const [coursesRes, progressRes] = await Promise.all([
        api.get<{ items: Course[] }>(`/academy?page=1&pageSize=${PAGE_SIZE}`),
        api.get<AcademyProgress[]>("/academy/my-progress"),
      ]);

      const courses = coursesRes.success ? (coursesRes.data.items ?? []) : [];
      const myProgress: Record<string, AcademyProgress> = {};
      if (progressRes.success) {
        for (const p of progressRes.data ?? []) myProgress[p.courseId] = p;
      }

      set({
        courses,
        myProgress,
        isLoading:     false,
        isInitialized: true,
        error:         coursesRes.success ? null : coursesRes.error,
      });
    } catch (err) {
      console.error("[academyStore.init]", err);
      set({ isLoading: false, error: "Failed to load academy data", isInitialized: true });
    }
  },

  reset: () =>
    set({
      courses: [], myProgress: {}, isLoading: false, isSyncing: false,
      isInitialized: false, error: null,
    }),

  // ── Single course (with lessons + progress) ────────────────────────────

  getCourse: async (courseId) => {
    try {
      const res = await api.get<CourseWithProgress>(`/academy/${courseId}`);
      if (!res.success) { set({ error: res.error }); return null; }

      set((s) => ({
        courses: s.courses.some((c) => c.id === courseId)
          ? s.courses.map((c) => (c.id === courseId ? { ...c, ...res.data } : c))
          : [...s.courses, res.data],
        myProgress: res.data.progress ? { ...s.myProgress, [courseId]: res.data.progress } : s.myProgress,
      }));
      return res.data;
    } catch (err) {
      console.error("[academyStore.getCourse]", err);
      set({ error: "Failed to load course" });
      return null;
    }
  },

  // ── Enroll ────────────────────────────────────────────────────────────

  enrollInCourse: async (courseId) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await api.post<AcademyProgress>(`/academy/${courseId}/enroll`);
      if (!res.success) { set({ isSyncing: false, error: res.error }); return; }
      set((s) => ({ myProgress: { ...s.myProgress, [courseId]: res.data }, isSyncing: false }));
    } catch (err) {
      console.error("[academyStore.enrollInCourse]", err);
      set({ isSyncing: false, error: "Failed to enroll" });
    }
  },

  // ── Complete lesson ───────────────────────────────────────────────────

  completeLesson: async (courseId, lessonId) => {
    const prev     = get().myProgress;
    const existing = prev[courseId];

    if (existing && !existing.completedLessons.includes(lessonId)) {
      set({
        myProgress: {
          ...prev,
          [courseId]: { ...existing, completedLessons: [...existing.completedLessons, lessonId], lastLessonId: lessonId },
        },
      });
    }

    try {
      const res = await api.post<{ completedLessons: string[]; totalLessons: number; isComplete: boolean }>(
        `/academy/${courseId}/lessons/${lessonId}/complete`
      );
      if (!res.success) { set({ myProgress: prev, error: res.error }); return; }

      set((s) => {
        const current = s.myProgress[courseId];
        if (!current) return s;
        return {
          myProgress: {
            ...s.myProgress,
            [courseId]: {
              ...current,
              completedLessons:  res.data.completedLessons,
              lastLessonId:      lessonId,
              certificateStatus: res.data.isComplete ? "EARNED" : current.certificateStatus,
              completedAt:       res.data.isComplete ? new Date().toISOString() : current.completedAt,
            },
          },
        };
      });
    } catch (err) {
      console.error("[academyStore.completeLesson]", err);
      set({ myProgress: prev, error: "Failed to complete lesson" });
    }
  },

  // ── Submit quiz score ─────────────────────────────────────────────────

  submitQuizScore: async (courseId, lessonId, score) => {
    const prev     = get().myProgress;
    const existing = prev[courseId];

    if (existing) {
      set({
        myProgress: { ...prev, [courseId]: { ...existing, quizScores: { ...existing.quizScores, [lessonId]: score } } },
      });
    }

    try {
      const res = await api.post<AcademyProgress>(`/academy/${courseId}/lessons/${lessonId}/quiz`, { score });
      if (!res.success) { set({ myProgress: prev, error: res.error }); return; }
      set((s) => ({ myProgress: { ...s.myProgress, [courseId]: res.data } }));
    } catch (err) {
      console.error("[academyStore.submitQuizScore]", err);
      set({ myProgress: prev, error: "Failed to submit quiz score" });
    }
  },

  // ── Certificate status ────────────────────────────────────────────────

  getCertificateStatus: async (courseId) => {
    try {
      const res = await api.get<CertificateStatusResult>(`/academy/${courseId}/certificate`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[academyStore.getCertificateStatus]", err);
      return null;
    }
  },
}));

// ── Auto-init / reset (single-arg subscribe) ──────────────────────────────

if (typeof window !== "undefined") {
  import("@/store/authStore").then(({ useAuthStore }) => {
    // This store is only imported (and this block only runs) when its page
    // is first visited — often well after login. subscribe() alone only
    // fires on *future* changes, so if the user is already logged in by now
    // it would silently never call init(), leaving isInitialized false
    // forever. Seed prevUserId from the current state and fire once
    // up front to cover that already-happened transition.
    let prevUserId: string | undefined = useAuthStore.getState().user?.id;
    if (prevUserId) useAcademyStore.getState().init();

    useAuthStore.subscribe((state) => {
      const userId = state.user?.id;
      if (userId !== prevUserId) {
        prevUserId = userId;
        if (userId) {
          useAcademyStore.getState().init();
        } else {
          useAcademyStore.getState().reset();
        }
      }
    });
  });
}
