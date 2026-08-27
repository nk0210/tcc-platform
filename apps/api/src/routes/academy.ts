/**
 * Academy Routes
 * Mounted at: /academy
 *
 * Covers: course discovery, enrollment, lesson progress, quizzes,
 *         certificates, and admin/mentor course management.
 */
import { Router } from "express";
import { z }      from "zod";
import { authenticate, optionalAuthenticate, type AuthRequest } from "../middleware/authenticate";
import { requirePermission }      from "../middleware/requirePermission";
import { validate }               from "../middleware/validate";
import { academyService }         from "../server/services/academyService";
import { ok, created, notFound, badRequest, internalError } from "../lib/response";
import type { CourseType, CourseLevel, CertificateStatus, LessonType } from "@prisma/client";

const router: ReturnType<typeof Router> = Router();

// ── Shared enums ──────────────────────────────────────────────────────────

const COURSE_TYPES  = ["OFFICIAL", "FREE_RESOURCE", "CREATOR_PUBLISHED"] as const;
const COURSE_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const CERT_STATUSES = ["UNAVAILABLE", "COMING_SOON", "EARNED"] as const;
const LESSON_TYPES  = ["TEXT", "VIDEO", "QUIZ", "EXERCISE"] as const;

// ── Schemas ────────────────────────────────────────────────────────────────

function parseCsv(v?: string): string[] | undefined {
  if (!v) return undefined;
  const list = v.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}

const FeedSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  type:     z.enum(COURSE_TYPES).optional(),
  level:    z.enum(COURSE_LEVELS).optional(),
  category: z.string().optional(),
  tags:     z.string().optional(),
  search:   z.string().optional(),
});

const LessonSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  duration:    z.string().min(1).max(50),
  type:        z.enum(LESSON_TYPES),
  content:     z.string().max(20000).optional().nullable(),
  orderIndex:  z.number().int().min(0).optional(),
});

const CreateCourseSchema = z.object({
  title:             z.string().min(1).max(200),
  description:       z.string().min(1).max(5000),
  type:              z.enum(COURSE_TYPES),
  level:             z.enum(COURSE_LEVELS),
  category:          z.string().min(1).max(50),
  thumbnail:         z.string().min(1).max(500),
  totalDuration:     z.string().min(1).max(50),
  isPaid:            z.boolean().optional(),
  price:             z.number().min(0).optional(),
  certificateStatus: z.enum(CERT_STATUSES).optional(),
  linkedStrategyId:  z.string().optional().nullable(),
  tags:              z.array(z.string().max(50)).max(10).optional(),
  lessons:           z.array(LessonSchema).max(200).optional(),
});

const UpdateCourseSchema = z.object({
  title:             z.string().min(1).max(200).optional(),
  description:       z.string().min(1).max(5000).optional(),
  level:             z.enum(COURSE_LEVELS).optional(),
  category:          z.string().min(1).max(50).optional(),
  thumbnail:         z.string().min(1).max(500).optional(),
  totalDuration:     z.string().min(1).max(50).optional(),
  isPaid:            z.boolean().optional(),
  price:             z.number().min(0).optional(),
  certificateStatus: z.enum(CERT_STATUSES).optional(),
  linkedStrategyId:  z.string().optional().nullable(),
  tags:              z.array(z.string().max(50)).max(10).optional(),
});

const QuizSchema = z.object({
  score: z.number().min(0).max(100),
});

// ── GET /academy?... ─ List courses ─────────────────────────────────────────

router.get(
  "/",
  optionalAuthenticate,
  validate(FeedSchema, "query"),
  async (req, res) => {
    const query = req.query as unknown as z.infer<typeof FeedSchema>;

    try {
      const feed = await academyService.getAllCourses({
        page:     query.page,
        pageSize: query.pageSize,
        type:     query.type as CourseType | undefined,
        level:    query.level as CourseLevel | undefined,
        category: query.category,
        tags:     parseCsv(query.tags),
        search:   query.search,
      });
      ok(res, feed);
    } catch (err) {
      console.error("[academy GET /]", err);
      internalError(res);
    }
  }
);

// ── GET /academy/my-progress ─ All enrolled courses + progress (auth) ──────

router.get(
  "/my-progress",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await academyService.getAllUserProgress(authReq.userId));
    } catch (err) {
      console.error("[academy GET /my-progress]", err);
      internalError(res);
    }
  }
);

// ── POST /academy ─ Create course (admin/mentor) ────────────────────────────

router.post(
  "/",
  authenticate,
  requirePermission("academy.course.create"),
  validate(CreateCourseSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof CreateCourseSchema>;

    try {
      const course = await academyService.createCourse(authReq.userId, authReq.handle, {
        title:             body.title,
        description:       body.description,
        type:              body.type as CourseType,
        level:             body.level as CourseLevel,
        category:          body.category,
        thumbnail:         body.thumbnail,
        totalDuration:     body.totalDuration,
        isPaid:            body.isPaid,
        price:             body.price,
        certificateStatus: body.certificateStatus as CertificateStatus | undefined,
        linkedStrategyId:  body.linkedStrategyId,
        tags:              body.tags,
        lessons:           body.lessons as
          | { title: string; description: string; duration: string; type: LessonType; content?: string | null; orderIndex?: number }[]
          | undefined,
      });
      created(res, course, "Course created");
    } catch (err) {
      console.error("[academy POST /]", err);
      internalError(res);
    }
  }
);

// ── GET /academy/:courseId ─ Get course + lessons ───────────────────────────

router.get(
  "/:courseId",
  optionalAuthenticate,
  async (req, res) => {
    const authReq  = req as unknown as AuthRequest;
    const viewerId = authReq.userId ?? undefined;

    try {
      ok(res, await academyService.getCourse(req.params.courseId, viewerId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "COURSE_NOT_FOUND") {
        notFound(res, "Course not found");
        return;
      }
      console.error("[academy GET /:courseId]", err);
      internalError(res);
    }
  }
);

// ── PUT /academy/:courseId ─ Update course (admin/mentor) ──────────────────

router.put(
  "/:courseId",
  authenticate,
  requirePermission("academy.course.edit"),
  validate(UpdateCourseSchema),
  async (req, res) => {
    const body = req.body as z.infer<typeof UpdateCourseSchema>;

    try {
      const course = await academyService.updateCourse(req.params.courseId, {
        title:             body.title,
        description:       body.description,
        level:             body.level as CourseLevel | undefined,
        category:          body.category,
        thumbnail:         body.thumbnail,
        totalDuration:     body.totalDuration,
        isPaid:            body.isPaid,
        price:             body.price,
        certificateStatus: body.certificateStatus as CertificateStatus | undefined,
        linkedStrategyId:  body.linkedStrategyId,
        tags:              body.tags,
      });
      ok(res, course, "Course updated");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "COURSE_NOT_FOUND") {
        notFound(res, "Course not found");
        return;
      }
      console.error("[academy PUT /:courseId]", err);
      internalError(res);
    }
  }
);

// ── DELETE /academy/:courseId ─ Delete course (admin) ───────────────────────

router.delete(
  "/:courseId",
  authenticate,
  requirePermission("academy.course.remove"),
  async (req, res) => {
    try {
      await academyService.deleteCourse(req.params.courseId);
      ok(res, null, "Course deleted");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "COURSE_NOT_FOUND") {
        notFound(res, "Course not found");
        return;
      }
      console.error("[academy DELETE /:courseId]", err);
      internalError(res);
    }
  }
);

// ── POST /academy/:courseId/enroll ─ Enroll (idempotent) ───────────────────

router.post(
  "/:courseId/enroll",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      const progress = await academyService.enrollInCourse(authReq.userId, req.params.courseId);
      created(res, progress, "Enrolled");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "COURSE_NOT_FOUND") {
        notFound(res, "Course not found");
        return;
      }
      console.error("[academy POST /:courseId/enroll]", err);
      internalError(res);
    }
  }
);

// ── GET /academy/:courseId/progress ─ Get progress (auth) ──────────────────

router.get(
  "/:courseId/progress",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await academyService.getProgress(authReq.userId, req.params.courseId));
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NOT_ENROLLED") {
        badRequest(res, "You are not enrolled in this course");
        return;
      }
      console.error("[academy GET /:courseId/progress]", err);
      internalError(res);
    }
  }
);

// ── POST /academy/:courseId/lessons/:lessonId/complete ─ Mark lesson complete ──

router.post(
  "/:courseId/lessons/:lessonId/complete",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(
        res,
        await academyService.completeLesson(authReq.userId, req.params.courseId, req.params.lessonId),
        "Lesson completed"
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "COURSE_NOT_FOUND") { notFound(res, "Course not found");                     return; }
        if (err.message === "LESSON_NOT_FOUND") { notFound(res, "Lesson not found in this course");      return; }
        if (err.message === "NOT_ENROLLED")     { badRequest(res, "You are not enrolled in this course"); return; }
      }
      console.error("[academy POST /:courseId/lessons/:lessonId/complete]", err);
      internalError(res);
    }
  }
);

// ── POST /academy/:courseId/lessons/:lessonId/quiz ─ Submit quiz score ─────

router.post(
  "/:courseId/lessons/:lessonId/quiz",
  authenticate,
  validate(QuizSchema),
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;
    const body    = req.body as z.infer<typeof QuizSchema>;

    try {
      ok(
        res,
        await academyService.submitQuizScore(authReq.userId, req.params.courseId, req.params.lessonId, body.score),
        "Quiz score saved"
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "COURSE_NOT_FOUND") { notFound(res, "Course not found");                     return; }
        if (err.message === "LESSON_NOT_FOUND") { notFound(res, "Lesson not found in this course");      return; }
        if (err.message === "NOT_ENROLLED")     { badRequest(res, "You are not enrolled in this course"); return; }
      }
      console.error("[academy POST /:courseId/lessons/:lessonId/quiz]", err);
      internalError(res);
    }
  }
);

// ── GET /academy/:courseId/certificate ─ Certificate status ────────────────

router.get(
  "/:courseId/certificate",
  authenticate,
  async (req, res) => {
    const authReq = req as unknown as AuthRequest;

    try {
      ok(res, await academyService.getCertificateStatus(authReq.userId, req.params.courseId));
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "COURSE_NOT_FOUND") { notFound(res, "Course not found");                     return; }
        if (err.message === "NOT_ENROLLED")     { badRequest(res, "You are not enrolled in this course"); return; }
      }
      console.error("[academy GET /:courseId/certificate]", err);
      internalError(res);
    }
  }
);

export default router;
