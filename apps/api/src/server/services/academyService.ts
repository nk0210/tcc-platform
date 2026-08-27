/**
 * Academy Service
 * All business logic for courses, enrollment, lesson progress, and certificates.
 */
import { v4 as uuidv4 } from "uuid";
import {
  academyRepository,
  type CreateCourseInput,
  type UpdateCourseInput,
  type CourseFilterParams,
} from "../repositories/academyRepository";
import { createNotification } from "../notifications/notificationService";
import type { CertificateStatus } from "@prisma/client";

// ── Errors ────────────────────────────────────────────────────────────────

export class CourseNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("COURSE_NOT_FOUND"); }
}
export class LessonNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("LESSON_NOT_FOUND"); }
}
export class NotEnrolledError extends Error {
  statusCode = 400;
  constructor() { super("NOT_ENROLLED"); }
}

// ── Pagination helper ─────────────────────────────────────────────────────

function paginate(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize);
  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ── Service ───────────────────────────────────────────────────────────────

export const academyService = {
  // ── List courses ────────────────────────────────────────────────────────

  async getAllCourses(params: CourseFilterParams) {
    const { items, total } = await academyRepository.findAllCourses(params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },

  // ── Get single course (+ enrollment / progress if viewer given) ───────────

  async getCourse(courseId: string, viewerId?: string) {
    const course = await academyRepository.findCourseById(courseId);
    if (!course) throw new CourseNotFoundError();

    if (!viewerId) {
      return { ...course, isEnrolled: false, progress: null };
    }

    const progress = await academyRepository.getProgress(viewerId, courseId);
    return { ...course, isEnrolled: progress !== null, progress };
  },

  // ── Courses by creator ─────────────────────────────────────────────────────

  async getCoursesByCreator(creatorId: string, params: { page: number; pageSize: number }) {
    const { items, total } = await academyRepository.findCoursesByCreator(creatorId, params);
    return { items, ...paginate(total, params.page, params.pageSize) };
  },

  // ── Enroll (idempotent) ────────────────────────────────────────────────────

  async enrollInCourse(userId: string, courseId: string) {
    const course = await academyRepository.findCourseById(courseId);
    if (!course) throw new CourseNotFoundError();

    return academyRepository.enrollUser(userId, courseId);
  },

  // ── Progress ───────────────────────────────────────────────────────────────

  async getProgress(userId: string, courseId: string) {
    const progress = await academyRepository.getProgress(userId, courseId);
    if (!progress) throw new NotEnrolledError();
    return progress;
  },

  async getAllUserProgress(userId: string) {
    return academyRepository.getAllProgressForUser(userId);
  },

  // ── Complete a lesson ──────────────────────────────────────────────────────

  async completeLesson(userId: string, courseId: string, lessonId: string) {
    const course = await academyRepository.findCourseById(courseId);
    if (!course) throw new CourseNotFoundError();

    const lesson = course.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new LessonNotFoundError();

    const progress = await academyRepository.getProgress(userId, courseId);
    if (!progress) throw new NotEnrolledError();

    const completedLessons = progress.completedLessons.includes(lessonId)
      ? progress.completedLessons
      : [...progress.completedLessons, lessonId];

    await academyRepository.updateProgress(userId, courseId, {
      completedLessons,
      lastLessonId: lessonId,
    });

    const isComplete = course.lessons.every((l) => completedLessons.includes(l.id));

    if (isComplete && !progress.completedAt) {
      const certificateStatus: CertificateStatus =
        course.certificateStatus === "UNAVAILABLE" ? "UNAVAILABLE" : "EARNED";

      await academyRepository.markComplete(userId, courseId, certificateStatus);

      await createNotification({
        userId,
        type:        "ACADEMY",
        priority:    "MEDIUM",
        title:       "🎓 Course completed!",
        message:     `You completed "${course.title}".`,
        actionLabel: "View Certificate",
        actionPath:  `/academy/${courseId}`,
      });
    }

    return {
      completedLessons,
      totalLessons: course.lessons.length,
      isComplete,
    };
  },

  // ── Submit a quiz score ────────────────────────────────────────────────────

  async submitQuizScore(userId: string, courseId: string, lessonId: string, score: number) {
    const course = await academyRepository.findCourseById(courseId);
    if (!course) throw new CourseNotFoundError();

    const lesson = course.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new LessonNotFoundError();

    const progress = await academyRepository.getProgress(userId, courseId);
    if (!progress) throw new NotEnrolledError();

    const existingScores =
      progress.quizScores && typeof progress.quizScores === "object" && !Array.isArray(progress.quizScores)
        ? (progress.quizScores as Record<string, number>)
        : {};

    const quizScores = { ...existingScores, [lessonId]: score };

    return academyRepository.updateProgress(userId, courseId, { quizScores });
  },

  // ── Certificate status ─────────────────────────────────────────────────────

  async getCertificateStatus(userId: string, courseId: string) {
    const course = await academyRepository.findCourseById(courseId);
    if (!course) throw new CourseNotFoundError();

    const progress = await academyRepository.getProgress(userId, courseId);
    if (!progress) throw new NotEnrolledError();

    const totalLessons     = course.lessons.length;
    const completedCount   = progress.completedLessons.length;
    const isComplete       = totalLessons > 0 && completedCount >= totalLessons;

    return {
      status:        progress.certificateStatus,
      completedCount,
      totalLessons,
      isComplete,
    };
  },

  // ── Admin/mentor: course management ────────────────────────────────────────

  async createCourse(
    creatorId:   string,
    creatorName: string,
    input:       Omit<CreateCourseInput, "id" | "creatorId" | "creatorName">
  ) {
    return academyRepository.createCourse({
      ...input,
      id: uuidv4(),
      creatorId,
      creatorName,
    });
  },

  async updateCourse(courseId: string, input: UpdateCourseInput) {
    const course = await academyRepository.findCourseById(courseId);
    if (!course) throw new CourseNotFoundError();
    return academyRepository.updateCourse(courseId, input);
  },

  async deleteCourse(courseId: string) {
    const course = await academyRepository.findCourseById(courseId);
    if (!course) throw new CourseNotFoundError();
    await academyRepository.deleteCourse(courseId);
  },
};
