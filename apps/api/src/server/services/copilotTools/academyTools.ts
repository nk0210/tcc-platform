/**
 * Copilot Academy Tools
 * Thin wrapper over academyService — no new business logic.
 *
 * Phase 4 audit note: the original Copilot assessment (Phase Alpha) found
 * Academy had a frontend store but no backend. Re-verified against the
 * CURRENT repository for this phase: academyService/academyRepository and
 * the /academy routes are real and live (course catalog, enrollment,
 * lesson/quiz progress, certificates) — so a read-only progress tool is
 * justified now. Competition/Mentoring/News still have no backend at all
 * and are correctly NOT given tools (see COPILOT_ASSESSMENT.md and the
 * Phase 4 report).
 */
import { z } from "zod";
import { academyService } from "../academyService";
import { optionalNullable, optionalNullableDefault, nullableJsonSchema } from "./zodHelpers";
import type { ToolDefinition } from "../copilotToolRegistry";

const GetAcademyProgressArgs = z.object({});

const getAcademyProgress: ToolDefinition<z.infer<typeof GetAcademyProgressArgs>> = {
  name:        "get_academy_progress",
  description: "Get the authenticated user's TCC Academy progress: every course they're enrolled in, lessons completed, quiz scores, and certificate status.",
  parameters:  GetAcademyProgressArgs,
  jsonSchema:  { type: "object", properties: {}, additionalProperties: false },
  riskLevel:   "LOW",
  capability:  "academy.progress",
  readOnly:    true,
  async execute(_args, ctx) {
    const progress = await academyService.getAllUserProgress(ctx.userId);
    return {
      courses: progress.map((p) => ({
        courseId:          p.courseId,
        title:             p.course.title,
        totalLessons:      p.course._count.lessons,
        completedLessons:  p.completedLessons.length,
        isComplete:        p.completedAt !== null,
        certificateStatus: p.certificateStatus,
        enrolledAt:        p.enrolledAt,
      })),
    };
  },
};

// Phase 9: the course catalog, so the model can find a courseId to enroll
// in — get_academy_progress only shows courses already enrolled in.
const GetAcademyCoursesArgs = z.object({
  category: optionalNullable(z.string().max(50)),
  search:   optionalNullable(z.string().max(100)),
  limit:    optionalNullableDefault(z.number().int().min(1).max(20), 10),
});

const getAcademyCourses: ToolDefinition<z.infer<typeof GetAcademyCoursesArgs>> = {
  name:        "get_academy_courses",
  description: "Browse the TCC Academy course catalog — optionally filter by category or a text search. Use this to find a courseId before enrolling with enroll_course.",
  parameters:  GetAcademyCoursesArgs,
  jsonSchema: {
    type: "object",
    properties: {
      category: nullableJsonSchema({ type: "string", description: "Optional: filter to one course category." }),
      search:   nullableJsonSchema({ type: "string", description: "Optional: text search over course titles/descriptions." }),
      limit:    nullableJsonSchema({ type: "integer", minimum: 1, maximum: 20, description: "Max courses to return. Defaults to 10." }),
    },
    additionalProperties: false,
  },
  riskLevel:  "LOW",
  capability: "academy.courses",
  readOnly:   true,
  async execute(args) {
    const result = await academyService.getAllCourses({
      page: 1, pageSize: args.limit, category: args.category ?? undefined, search: args.search ?? undefined,
    });
    return {
      total: result.total,
      courses: result.items.map((c) => ({
        id: c.id, title: c.title, description: c.description, type: c.type, level: c.level,
        category: c.category, isPaid: c.isPaid, price: c.price,
      })),
    };
  },
};

const EnrollCourseArgs = z.object({ courseId: z.string().min(1) });

const enrollCourse: ToolDefinition<z.infer<typeof EnrollCourseArgs>> = {
  name:        "enroll_course",
  description: "Enroll the authenticated user in a TCC Academy course. Get courseId from get_academy_courses. Requires the user's confirmation. Safe to call even if already enrolled (no-op).",
  parameters:  EnrollCourseArgs,
  jsonSchema: {
    type: "object",
    properties: { courseId: { type: "string", description: "The course's id, from get_academy_courses." } },
    required: ["courseId"], additionalProperties: false,
  },
  riskLevel:  "MEDIUM",
  capability: "academy.courses",
  readOnly:   false,
  describeAction: () => "Enroll you in this course?",
  describeResult: () => "Enrolled.",
  async execute(args, ctx) {
    try {
      const progress = await academyService.enrollInCourse(ctx.userId, args.courseId);
      return { courseId: progress.courseId, enrolledAt: progress.enrolledAt };
    } catch {
      throw new Error(`No course found with id "${args.courseId}".`);
    }
  },
};

export const academyTools: ToolDefinition[] = [
  getAcademyProgress as ToolDefinition,
  getAcademyCourses as ToolDefinition,
  enrollCourse as ToolDefinition,
];
