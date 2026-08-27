/**
 * Academy Repository
 * Sole Prisma layer for Course, Lesson, AcademyProgress. No business logic.
 */
import db from "../../lib/prisma";
import type {
  Prisma,
  CourseType,
  CourseLevel,
  CertificateStatus,
  LessonType,
} from "@prisma/client";

// ── Input types ───────────────────────────────────────────────────────────

export interface LessonInput {
  id?:          string;
  title:        string;
  description:  string;
  duration:     string;
  type:         LessonType;
  content?:     string | null;
  orderIndex?:  number;
}

export interface CreateCourseInput {
  id:                string;
  title:             string;
  description:       string;
  type:              CourseType;
  level:             CourseLevel;
  category:          string;
  thumbnail:         string;
  totalDuration:     string;
  isPaid?:           boolean;
  price?:            number;
  certificateStatus?: CertificateStatus;
  linkedStrategyId?: string | null;
  creatorId?:        string | null;
  creatorName?:      string | null;
  tags?:             string[];
  lessons?:          LessonInput[];
}

export interface UpdateCourseInput {
  title?:             string;
  description?:       string;
  level?:             CourseLevel;
  category?:          string;
  thumbnail?:         string;
  totalDuration?:     string;
  isPaid?:            boolean;
  price?:             number;
  certificateStatus?: CertificateStatus;
  linkedStrategyId?:  string | null;
  tags?:              string[];
}

export interface CourseFilterParams {
  page:      number;
  pageSize:  number;
  type?:     CourseType;
  level?:    CourseLevel;
  category?: string;
  tags?:     string[];
  search?:   string;
}

export interface UpdateProgressInput {
  completedLessons?: string[];
  quizScores?:       Prisma.InputJsonValue;
  lastLessonId?:     string | null;
}

// ── Select / include helpers ────────────────────────────────────────────────

const LESSONS_ORDERED = {
  lessons: { orderBy: { orderIndex: "asc" as const } },
} as const;

// ── Repository ────────────────────────────────────────────────────────────

export const academyRepository = {
  // ── Courses ────────────────────────────────────────────────────────────────

  async findAllCourses(params: CourseFilterParams) {
    const { page, pageSize, type, level, category, tags, search } = params;

    const where: Prisma.CourseWhereInput = {
      ...(type     ? { type }     : {}),
      ...(level    ? { level }    : {}),
      ...(category ? { category } : {}),
      ...(tags && tags.length > 0 ? { tags: { hasSome: tags } } : {}),
      ...(search
        ? {
            OR: [
              { title:       { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { _count: { select: { lessons: true } } },
      }),
      db.course.count({ where }),
    ]);

    return { items, total };
  },

  findCourseById(courseId: string) {
    return db.course.findUnique({
      where:   { id: courseId },
      include: LESSONS_ORDERED,
    });
  },

  findCoursesByCreator(creatorId: string, params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const where: Prisma.CourseWhereInput = { creatorId };

    return Promise.all([
      db.course.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: { _count: { select: { lessons: true } } },
      }),
      db.course.count({ where }),
    ]).then(([items, total]) => ({ items, total }));
  },

  createCourse(input: CreateCourseInput) {
    return db.course.create({
      data: {
        id:            input.id,
        title:         input.title,
        description:   input.description,
        type:          input.type,
        level:         input.level,
        category:      input.category,
        thumbnail:     input.thumbnail,
        totalDuration: input.totalDuration,
        isPaid:        input.isPaid ?? false,
        price:         input.price ?? 0,
        certificateStatus: input.certificateStatus ?? "COMING_SOON",
        linkedStrategyId:  input.linkedStrategyId ?? null,
        creatorId:         input.creatorId   ?? null,
        creatorName:       input.creatorName ?? null,
        tags:              input.tags ?? [],
        ...(input.lessons && input.lessons.length > 0
          ? {
              lessons: {
                create: input.lessons.map((l, i) => ({
                  title:       l.title,
                  description: l.description,
                  duration:    l.duration,
                  type:        l.type,
                  content:     l.content ?? null,
                  orderIndex:  l.orderIndex ?? i,
                })),
              },
            }
          : {}),
      },
      include: LESSONS_ORDERED,
    });
  },

  updateCourse(courseId: string, input: UpdateCourseInput) {
    return db.course.update({
      where: { id: courseId },
      data: {
        ...(input.title             !== undefined ? { title:             input.title }             : {}),
        ...(input.description       !== undefined ? { description:       input.description }       : {}),
        ...(input.level             !== undefined ? { level:             input.level }             : {}),
        ...(input.category          !== undefined ? { category:          input.category }          : {}),
        ...(input.thumbnail         !== undefined ? { thumbnail:         input.thumbnail }         : {}),
        ...(input.totalDuration     !== undefined ? { totalDuration:     input.totalDuration }     : {}),
        ...(input.isPaid            !== undefined ? { isPaid:            input.isPaid }            : {}),
        ...(input.price             !== undefined ? { price:             input.price }             : {}),
        ...(input.certificateStatus !== undefined ? { certificateStatus: input.certificateStatus } : {}),
        ...(input.linkedStrategyId  !== undefined ? { linkedStrategyId:  input.linkedStrategyId }  : {}),
        ...(input.tags              !== undefined ? { tags:              input.tags }              : {}),
      },
      include: LESSONS_ORDERED,
    });
  },

  deleteCourse(courseId: string) {
    return db.course.delete({ where: { id: courseId } });
  },

  // ── Progress ───────────────────────────────────────────────────────────────

  getProgress(userId: string, courseId: string) {
    return db.academyProgress.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
  },

  getAllProgressForUser(userId: string) {
    return db.academyProgress.findMany({
      where:   { userId },
      orderBy: { enrolledAt: "desc" },
      include: { course: { include: { _count: { select: { lessons: true } } } } },
    });
  },

  enrollUser(userId: string, courseId: string) {
    return db.academyProgress.upsert({
      where:  { userId_courseId: { userId, courseId } },
      create: { userId, courseId },
      update: {},
    });
  },

  updateProgress(userId: string, courseId: string, input: UpdateProgressInput) {
    return db.academyProgress.update({
      where: { userId_courseId: { userId, courseId } },
      data: {
        ...(input.completedLessons !== undefined ? { completedLessons: input.completedLessons } : {}),
        ...(input.quizScores       !== undefined ? { quizScores:       input.quizScores }       : {}),
        ...(input.lastLessonId     !== undefined ? { lastLessonId:     input.lastLessonId }     : {}),
      },
    });
  },

  markComplete(userId: string, courseId: string, certificateStatus: CertificateStatus) {
    return db.academyProgress.update({
      where: { userId_courseId: { userId, courseId } },
      data:  { completedAt: new Date(), certificateStatus },
    });
  },

  isEnrolled(userId: string, courseId: string): Promise<boolean> {
    return db.academyProgress
      .findUnique({ where: { userId_courseId: { userId, courseId } } })
      .then((r) => r !== null);
  },
};
