"use client";
/**
 * TCC Academy Page
 *
 * API-backed via academyStore.ts (Phase Alpha Frontend Integration).
 *
 * NOTE — data model gaps vs. the old hardcoded catalog (flagged for product
 * follow-up, not something a type fix can paper over):
 *   - The backend Lesson model has no `keyPoints` or `quizQuestions` fields —
 *     only `content: string | null`. The old multiple-choice "Knowledge Check"
 *     UI had no server-side data to render, so it's replaced with a plain
 *     content view + a "Mark Complete" action. Quiz-type lessons show a note
 *     instead of fabricating a scoring UI with no real questions behind it.
 *   - Course has no `instructor`/`instructorHandle`/`isFree`/`certificateAvailable`/
 *     `linkedStrategyIds` fields anymore — mapped to the closest real fields
 *     (creatorName/creatorId, !isPaid, certificateStatus !== "UNAVAILABLE",
 *     linkedStrategyId singular).
 *   - There is no unenroll endpoint on the backend, so the "Unenroll" button
 *     was removed.
 *   - The course list endpoint doesn't include lessons (only single-course
 *     fetch does), so lesson counts on cards read 0 until a course is opened.
 */
import { useState, useMemo } from "react";
import {
  useAcademyStore, type Course, type Lesson, type CourseLevel, type CourseType, type AcademyProgress,
} from "@/store/academyStore";
import { useStrategyStore } from "@/store/strategyStore";
import { useNotificationStore } from "@/store/notificationStore";
import ReportButton from "@/components/ReportButton";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

// ── Progress helpers (the new store keeps raw myProgress only) ────────────

function isEnrolled(myProgress: Record<string, AcademyProgress>, courseId: string): boolean {
  return !!myProgress[courseId];
}

function getProgressPct(myProgress: Record<string, AcademyProgress>, course: Course): number {
  const p = myProgress[course.id];
  if (!p || course.lessons.length === 0) return 0;
  return Math.round((p.completedLessons.length / course.lessons.length) * 100);
}

function hasCert(myProgress: Record<string, AcademyProgress>, courseId: string): boolean {
  return myProgress[courseId]?.certificateStatus === "EARNED";
}

// ── Helpers ───────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<CourseLevel, string> = {
  BEGINNER:     "text-green-400 bg-green-500/10 border-green-500/20",
  INTERMEDIATE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  ADVANCED:     "text-red-400   bg-red-500/10   border-red-500/20",
};

const TYPE_LABELS: Record<CourseType, string> = {
  OFFICIAL:          "Official TCC Course",
  FREE_RESOURCE:     "Free Resource",
  CREATOR_PUBLISHED: "Creator Published",
};

const TYPE_COLORS: Record<CourseType, string> = {
  OFFICIAL:          "text-blue-400 bg-blue-500/10 border-blue-500/20",
  FREE_RESOURCE:     "text-green-400 bg-green-500/10 border-green-500/20",
  CREATOR_PUBLISHED: "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

// ── Learning Path config ──────────────────────────────────────────────────
// NOTE: these course IDs matched the old hardcoded catalog. The new API's
// courses have server-generated IDs, so paths will show empty until seed
// data (or a real course-tagging mechanism) exists — not a compile issue.

const LEARNING_PATHS = [
  {
    level: "BEGINNER" as CourseLevel,
    label: "📗 Beginner Path",
    description: "Start here. No prior knowledge required.",
    courseIds: ["c_fundamentals", "c_tech_analysis", "c_risk"],
    color: "border-green-500/20 bg-green-500/3",
  },
  {
    level: "INTERMEDIATE" as CourseLevel,
    label: "📙 Intermediate Path",
    description: "Build on fundamentals with real trading frameworks.",
    courseIds: ["c1", "c2"],
    color: "border-amber-500/20 bg-amber-500/3",
  },
  {
    level: "ADVANCED" as CourseLevel,
    label: "📕 Advanced Path",
    description: "Advanced techniques for experienced paper traders.",
    courseIds: ["c_advanced"],
    color: "border-red-500/20 bg-red-500/3",
  },
];

// ── Lesson Player ─────────────────────────────────────────────────────────

function LessonPlayer({
  course, lesson, onBack,
}: { course: Course; lesson: Lesson; onBack: () => void }) {
  const { completeLesson, myProgress } = useAcademyStore();
  const { addNotification } = useNotificationStore();

  const progress = myProgress[course.id];
  const isCompleted = !!progress?.completedLessons.includes(lesson.id);

  const handleComplete = async () => {
    await completeLesson(course.id, lesson.id);
    addNotification({
      type:        "academy",
      priority:    "low",
      title:       `✓ Lesson Completed`,
      message:     `"${lesson.title}" marked complete in ${course.title}`,
      actionLabel: "Continue Learning",
      actionPath:  "/academy",
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
        <button onClick={onBack} className="text-white/40 hover:text-white text-xs transition">← Back to course</button>
        <span className="text-white/20 text-xs">·</span>
        <span className="text-white/50 text-xs">{course.title}</span>
        {isCompleted && <span className="ml-auto text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">✓ Completed</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        <h2 className="text-xl font-bold text-white mb-1">{lesson.title}</h2>
        <p className="text-white/40 text-xs mb-5">{lesson.duration}</p>

        {/* Content placeholder — TCC Beta has no video player */}
        <div className="glass border border-white/5 rounded-xl p-8 mb-5 flex flex-col items-center justify-center min-h-[200px]">
          <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
            <span className="text-green-400 text-2xl">▶</span>
          </div>
          <p className="text-white/40 text-sm">{lesson.title}</p>
          <p className="text-white/20 text-xs mt-1">{course.creatorName ?? "TCC Academy"} · {lesson.duration}</p>
          <p className="text-white/15 text-xs mt-3 italic">Video player coming in Phase Alpha</p>
        </div>

        {/* Lesson content */}
        <div className="glass border border-white/5 rounded-xl p-5 mb-5">
          <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">
            {lesson.content || lesson.description}
          </p>
        </div>

        {/* Quiz-type lessons — no structured question data on the backend yet */}
        {lesson.type === "QUIZ" && !isCompleted && (
          <div className="glass border border-white/5 rounded-xl p-5 mb-5">
            <p className="text-white font-semibold mb-2">📝 Knowledge Check</p>
            <p className="text-white/40 text-xs leading-relaxed">
              Interactive quiz questions aren't available yet for this lesson. Review the material
              above, then mark it complete.
            </p>
          </div>
        )}

        {/* Mark Complete */}
        {!isCompleted && (
          <button onClick={handleComplete}
            className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2.5 rounded-xl text-sm font-semibold transition">
            ✓ Mark Lesson Complete
          </button>
        )}
        {isCompleted && (
          <div className="flex items-center gap-2 text-green-400">
            <span className="text-lg">✅</span>
            <span className="text-sm font-semibold">Lesson completed</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Course Detail ─────────────────────────────────────────────────────────

function CourseDetail({
  course, onBack, onSelectLesson,
}: {
  course: Course;
  onBack: () => void;
  onSelectLesson: (lesson: Lesson) => void;
}) {
  const { enrollInCourse, myProgress } = useAcademyStore();
  const { strategies } = useStrategyStore();
  const { addNotification } = useNotificationStore();

  const enrolled = isEnrolled(myProgress, course.id);
  const progress = getProgressPct(myProgress, course);
  const certEarned = hasCert(myProgress, course.id);
  const progressData = myProgress[course.id];

  const linkedStrategies = course.linkedStrategyId
    ? strategies.filter(s => s.id === course.linkedStrategyId)
    : [];

  const handleEnroll = async () => {
    await enrollInCourse(course.id);
    addNotification({
      type:        "academy",
      priority:    "low",
      title:       `📚 Enrolled — ${course.title}`,
      message:     `You are now enrolled.`,
      actionLabel: "Start Learning",
      actionPath:  "/academy",
    });
  };

  const certStatusLabel = certEarned
    ? "🏆 Certificate Earned"
    : course.certificateStatus !== "UNAVAILABLE"
      ? "🎓 Certificate available on completion"
      : "Certificate not available for this course";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <button onClick={onBack} className="text-white/40 hover:text-white text-xs mb-4 transition block">← Back to Academy</button>

      <div className="glass border border-white/5 rounded-xl p-6 mb-5">
        <div className="flex items-start gap-5">
          <div className="text-5xl shrink-0">{course.thumbnail}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[course.type]}`}>{TYPE_LABELS[course.type]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${LEVEL_COLORS[course.level]}`}>{course.level.toLowerCase()}</span>
              {!course.isPaid ? (
                <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Free</span>
              ) : (
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">${course.price}</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white mb-2">{course.title}</h1>
            <p className="text-white/50 text-sm mb-3 leading-relaxed">{course.description}</p>
            <div className="flex items-center gap-4 text-xs text-white/30">
              <span>👤 {course.creatorName ?? "TCC Academy"}</span>
              <span>⏱ {course.totalDuration}</span>
              <span>📚 {course.lessons.length} lessons</span>
            </div>
          </div>
          <div className="shrink-0">
            <ReportButton
              reportedItemType="course"
              reportedItemId={course.id}
              reportedItemTitle={course.title}
              reportedUserId={course.creatorId ?? undefined}
              sourceFeature="Academy Course Detail"
            />
          </div>
        </div>

        {/* Certificate status — honest */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-white/30">{certStatusLabel}</span>
          {certEarned && <span className="text-xs text-amber-400">· Download coming in Phase Alpha</span>}
        </div>

        {/* Progress if enrolled */}
        {enrolled && (
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="text-white/40 text-xs">Progress</span>
              <span className="text-green-400 text-xs">{progress}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2">
              <div className="bg-green-400 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Enroll button (no unenroll endpoint on the backend) */}
        <div className="mt-4 flex gap-3">
          {!enrolled ? (
            <button onClick={handleEnroll}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
              {!course.isPaid ? "Enroll Free" : `Enroll — $${course.price} (Payment not connected)`}
            </button>
          ) : (
            <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-lg font-semibold">✓ Enrolled</span>
          )}
        </div>
      </div>

      {/* Lesson list */}
      <div className="glass border border-white/5 rounded-xl overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-white font-semibold text-sm">Course Content</p>
          <p className="text-white/30 text-xs mt-0.5">{course.lessons.length} lessons · {course.totalDuration}</p>
        </div>
        {course.lessons.map((lesson, i) => {
          const isCompleted = progressData?.completedLessons.includes(lesson.id);
          return (
            <div key={lesson.id}
              className={`flex items-center gap-4 px-5 py-4 border-b border-white/5 transition ${enrolled ? "cursor-pointer hover:bg-white/2" : "opacity-50"}`}
              onClick={() => enrolled && onSelectLesson(lesson)}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${isCompleted ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/40"}`}>
                {isCompleted ? "✓" : i + 1}
              </div>
              <div className="flex-1">
                <p className={`text-sm ${isCompleted ? "text-white/60 line-through" : "text-white/80"}`}>{lesson.title}</p>
                <p className="text-white/30 text-xs mt-0.5">{lesson.description.slice(0, 60)}...</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {lesson.type === "QUIZ" && (
                  <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">📝 Quiz</span>
                )}
                <span className="text-white/30 text-xs">{lesson.duration}</span>
                {!enrolled && <span className="text-white/20 text-xs">🔒</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Linked strategies */}
      {linkedStrategies.length > 0 && (
        <div className="glass border border-white/5 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Related Strategy Templates</p>
          <div className="flex flex-col gap-2">
            {linkedStrategies.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-white/3 rounded-lg px-3 py-2">
                <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">Educational</span>
                <span className="text-white/70 text-sm">{s.title}</span>
                <span className="ml-auto text-xs text-white/30">→ Marketplace</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Course Card ───────────────────────────────────────────────────────────

function CourseCard({
  course, onClick,
}: { course: Course; onClick: () => void }) {
  const { myProgress } = useAcademyStore();
  const enrolled = isEnrolled(myProgress, course.id);
  const progress = getProgressPct(myProgress, course);

  return (
    <div onClick={onClick}
      className="glass border border-white/5 rounded-xl p-5 cursor-pointer hover:border-white/15 transition relative group">

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
        <ReportButton
          reportedItemType="course"
          reportedItemId={course.id}
          reportedItemTitle={course.title}
          reportedUserId={course.creatorId ?? undefined}
          sourceFeature="Academy Course Listing"
          compact
        />
      </div>

      <div className="flex items-start gap-4 mb-3">
        <span className="text-4xl shrink-0">{course.thumbnail}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[course.type]}`}>{TYPE_LABELS[course.type]}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border capitalize ${LEVEL_COLORS[course.level]}`}>{course.level.toLowerCase()}</span>
          </div>
          <h3 className="text-white font-semibold text-sm leading-tight">{course.title}</h3>
        </div>
      </div>

      <p className="text-white/40 text-xs mb-3 line-clamp-2 leading-relaxed">{course.description}</p>

      <div className="flex items-center gap-3 text-xs text-white/30 mb-3">
        <span>👤 {course.creatorName ?? "TCC Academy"}</span>
        <span>⏱ {course.totalDuration}</span>
        <span>📚 {course.lessons.length}</span>
      </div>

      {enrolled && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-white/30 text-xs">Progress</span>
            <span className="text-green-400 text-xs">{progress}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {course.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-xs bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold ${!course.isPaid ? "text-green-400" : "text-amber-400"}`}>
            {!course.isPaid ? "Free" : `$${course.price}`}
          </span>
          {enrolled
            ? <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Enrolled</span>
            : <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">View →</span>}
        </div>
      </div>
    </div>
  );
}

// ── Learning Path Card ────────────────────────────────────────────────────

function LearningPathCard({
  path, courses, onCourseSelect,
}: {
  path: typeof LEARNING_PATHS[0];
  courses: Course[];
  onCourseSelect: (course: Course) => void;
}) {
  const { myProgress } = useAcademyStore();
  const pathCourses = courses.filter(c => path.courseIds.includes(c.id));
  const completedCount = pathCourses.filter(c => getProgressPct(myProgress, c) === 100).length;

  return (
    <div className={`glass border rounded-2xl p-5 ${path.color}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-bold text-base mb-0.5">{path.label}</h3>
          <p className="text-white/40 text-xs">{path.description}</p>
        </div>
        <span className="text-xs text-white/30 shrink-0">
          {completedCount}/{pathCourses.length} complete
        </span>
      </div>

      <div className="w-full bg-white/5 rounded-full h-1.5 mb-4">
        <div className={`h-1.5 rounded-full transition-all ${path.level === "BEGINNER" ? "bg-green-400" : path.level === "INTERMEDIATE" ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${pathCourses.length > 0 ? (completedCount / pathCourses.length) * 100 : 0}%` }} />
      </div>

      <div className="flex flex-col gap-2">
        {pathCourses.map((course, i) => {
          const enrolled = isEnrolled(myProgress, course.id);
          const prog = getProgressPct(myProgress, course);
          const done = prog === 100;
          return (
            <div key={course.id}
              onClick={() => onCourseSelect(course)}
              className="flex items-center gap-3 bg-white/3 hover:bg-white/6 rounded-xl p-3 cursor-pointer transition group">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${done ? "bg-green-500/20 text-green-400" : enrolled ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-white/30"}`}>
                {done ? "✓" : enrolled ? "▶" : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-medium truncate">{course.title}</p>
                <p className="text-white/30 text-xs">{course.lessons.length} lessons · {course.totalDuration}</p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {enrolled && !done && (
                  <div className="w-12 bg-white/5 rounded-full h-1 mr-1">
                    <div className="bg-amber-400 h-1 rounded-full" style={{ width: `${prog}%` }} />
                  </div>
                )}
                <span className="text-white/20 group-hover:text-white/50 text-xs transition">→</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

type AcademyTab = "paths" | "courses" | "progress";
type LevelFilter = "all" | CourseLevel;
type TypeFilter  = "all" | CourseType;

export default function AcademyPage() {
  const { courses, myProgress, isLoading, isInitialized, error } = useAcademyStore();

  const [activeTab,    setActiveTab]    = useState<AcademyTab>("paths");
  const [levelFilter,  setLevelFilter]  = useState<LevelFilter>("all");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const enrolledCourses  = courses.filter(c => isEnrolled(myProgress, c.id));
  const completedCourses = courses.filter(c => getProgressPct(myProgress, c) === 100);

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (levelFilter !== "all" && c.level !== levelFilter) return false;
      if (typeFilter  !== "all" && c.type  !== typeFilter)  return false;
      return true;
    });
  }, [courses, levelFilter, typeFilter]);

  if (!isInitialized || isLoading) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/30 text-sm animate-pulse">Loading academy...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => useAcademyStore.getState().init()}
              className="text-white/40 text-xs border border-white/10 px-3 py-1 rounded hover:text-white/70 hover:border-white/20 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lesson player
  if (selectedCourse && selectedLesson) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 overflow-hidden">
            {/* Lesson sidebar */}
            <div className="w-64 shrink-0 glass border-r border-white/5 overflow-y-auto">
              <div className="p-4 border-b border-white/5">
                <button onClick={() => setSelectedLesson(null)} className="text-white/40 hover:text-white text-xs mb-2 transition block">← Back to course</button>
                <p className="text-white font-semibold text-xs">{selectedCourse.title}</p>
                <div className="mt-2">
                  <div className="flex justify-between mb-1"><span className="text-white/30 text-xs">Progress</span><span className="text-green-400 text-xs">{getProgressPct(myProgress, selectedCourse)}%</span></div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${getProgressPct(myProgress, selectedCourse)}%` }} />
                  </div>
                </div>
              </div>
              <div className="p-2">
                {selectedCourse.lessons.map((lesson, i) => {
                  const done = myProgress[selectedCourse.id]?.completedLessons.includes(lesson.id);
                  const isActive = lesson.id === selectedLesson.id;
                  return (
                    <button key={lesson.id} onClick={() => setSelectedLesson(lesson)}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition flex items-start gap-2 ${isActive ? "bg-green-500/10 border border-green-500/20" : "hover:bg-white/5"}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${done ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/30"}`}>
                        {done ? "✓" : i + 1}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${isActive ? "text-green-400" : "text-white/60"}`}>{lesson.title}</p>
                        <p className="text-white/20 text-xs">{lesson.duration}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <LessonPlayer course={selectedCourse} lesson={selectedLesson} onBack={() => setSelectedLesson(null)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Course detail
  if (selectedCourse) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-hidden flex flex-col">
            <CourseDetail
              course={selectedCourse}
              onBack={() => setSelectedCourse(null)}
              onSelectLesson={(lesson) => setSelectedLesson(lesson)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Main listing
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">🎓 TCC Academy</h1>
              <p className="text-white/40 text-sm mt-1">
                Official learning resources, technical frameworks, and creator courses.
              </p>
            </div>
            <div className="flex gap-3 text-xs text-center">
              <div className="glass border border-white/5 rounded-xl px-4 py-2">
                <p className="text-2xl font-bold text-white">{enrolledCourses.length}</p>
                <p className="text-white/30 mt-0.5">Enrolled</p>
              </div>
              <div className="glass border border-white/5 rounded-xl px-4 py-2">
                <p className="text-2xl font-bold text-green-400">{completedCourses.length}</p>
                <p className="text-white/30 mt-0.5">Completed</p>
              </div>
              <div className="glass border border-white/5 rounded-xl px-4 py-2">
                <p className="text-2xl font-bold text-white">{courses.length}</p>
                <p className="text-white/30 mt-0.5">Total</p>
              </div>
            </div>
          </div>

          {/* Honest notice */}
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 mb-5 flex items-center gap-3">
            <span className="text-blue-400 text-lg shrink-0">ℹ</span>
            <p className="text-white/40 text-xs leading-relaxed">
              TCC Academy is in Beta. Certificates are not yet issued — they will be available in Phase Alpha.
              Course ratings are not shown — they would be inaccurate in Beta. Creator-published courses are community contributions, not TCC-verified content.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-6">
            {([
              { key: "paths",   label: `🗺 Learning Paths`                        },
              { key: "courses", label: `📚 All Courses (${courses.length})`        },
              { key: "progress",label: `⚡ My Progress (${enrolledCourses.length})` },
            ] as { key: AcademyTab; label: string }[]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition ${activeTab === tab.key ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/70"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* LEARNING PATHS */}
          {activeTab === "paths" && (
            <div className="flex flex-col gap-5">
              {LEARNING_PATHS.map(path => (
                <LearningPathCard
                  key={path.level}
                  path={path}
                  courses={courses}
                  onCourseSelect={setSelectedCourse}
                />
              ))}
            </div>
          )}

          {/* ALL COURSES */}
          {activeTab === "courses" && (
            <div>
              {/* Filters */}
              <div className="flex gap-2 flex-wrap mb-5">
                <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as LevelFilter)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs">
                  <option value="all">All Levels</option>
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs">
                  <option value="all">All Types</option>
                  <option value="OFFICIAL">Official TCC</option>
                  <option value="FREE_RESOURCE">Free Resource</option>
                  <option value="CREATOR_PUBLISHED">Creator Published</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCourses.map(course => (
                  <CourseCard key={course.id} course={course} onClick={() => setSelectedCourse(course)} />
                ))}
              </div>

              {filteredCourses.length === 0 && (
                <div className="flex items-center justify-center h-32">
                  <p className="text-white/20 text-sm">No courses match your filters</p>
                </div>
              )}
            </div>
          )}

          {/* MY PROGRESS */}
          {activeTab === "progress" && (
            <div>
              {enrolledCourses.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <p className="text-5xl mb-4">📚</p>
                    <p className="text-white/40 text-sm">You are not enrolled in any courses yet</p>
                    <button onClick={() => setActiveTab("paths")}
                      className="mt-4 bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-500/30 transition">
                      Start Learning →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {enrolledCourses.map(course => (
                    <CourseCard key={course.id} course={course} onClick={() => setSelectedCourse(course)} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
