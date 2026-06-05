"use client";
/**
 * TCC Academy Page
 *
 * Honest labels:
 * - No fake ratings or enrolled counts
 * - Certificate status is real (coming_soon / unavailable / earned)
 * - Progress persisted per user
 * - Linked to strategy templates where applicable
 */
import { useState, useMemo } from "react";
import {
  useAcademyStore, Course, Lesson, CourseLevel, CourseType,
} from "@/store/academyStore";
import { useStrategyStore } from "@/store/strategyStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useAuthStore } from "@/store/authStore";
import ReportButton from "@/components/ReportButton";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

// ── Helpers ───────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<CourseLevel, string> = {
  beginner:     "text-green-400 bg-green-500/10 border-green-500/20",
  intermediate: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  advanced:     "text-red-400   bg-red-500/10   border-red-500/20",
};

const TYPE_LABELS: Record<CourseType, string> = {
  official:           "Official TCC Course",
  free_resource:      "Free Resource",
  creator_published:  "Creator Published",
};

const TYPE_COLORS: Record<CourseType, string> = {
  official:           "text-blue-400 bg-blue-500/10 border-blue-500/20",
  free_resource:      "text-green-400 bg-green-500/10 border-green-500/20",
  creator_published:  "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

// ── Learning Path config ──────────────────────────────────────────────────

const LEARNING_PATHS = [
  {
    level: "beginner" as CourseLevel,
    label: "📗 Beginner Path",
    description: "Start here. No prior knowledge required.",
    courseIds: ["c_fundamentals", "c_tech_analysis", "c_risk"],
    color: "border-green-500/20 bg-green-500/3",
  },
  {
    level: "intermediate" as CourseLevel,
    label: "📙 Intermediate Path",
    description: "Build on fundamentals with real trading frameworks.",
    courseIds: ["c1", "c2"],
    color: "border-amber-500/20 bg-amber-500/3",
  },
  {
    level: "advanced" as CourseLevel,
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
  const { completeLesson, submitQuiz, userProgress } = useAcademyStore();
  const { addNotification } = useNotificationStore();
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const progress = userProgress[course.id];
  const isCompleted = progress?.completedLessons.includes(lesson.id);
  const quizScore = progress?.quizScores[lesson.id];

  const handleComplete = () => {
    completeLesson(course.id, lesson.id);
    addNotification({
      type: "academy",
      priority: "low",
      title: `✓ Lesson Completed`,
      message: `"${lesson.title}" marked complete in ${course.title}`,
      action: { label: "Continue Learning", path: "/academy" },
    });
  };

  const handleQuizSubmit = () => {
    if (!lesson.quizQuestions) return;
    let correct = 0;
    lesson.quizQuestions.forEach(q => {
      if (quizAnswers[q.id] === q.correctIndex) correct++;
    });
    const score = Math.round((correct / lesson.quizQuestions.length) * 100);
    submitQuiz(course.id, lesson.id, score);
    if (score >= 70) {
      completeLesson(course.id, lesson.id);
      addNotification({
        type: "academy",
        priority: "medium",
        title: `🎓 Quiz Passed — ${score}%`,
        message: `"${lesson.title}" completed with ${score}% score.`,
        action: { label: "Continue Learning", path: "/academy" },
      });
    }
    setQuizSubmitted(true);
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
          <p className="text-white/20 text-xs mt-1">{course.instructor} · {lesson.duration}</p>
          <p className="text-white/15 text-xs mt-3 italic">Video player coming in Phase Alpha</p>
        </div>

        {/* Description */}
        <div className="glass border border-white/5 rounded-xl p-5 mb-5">
          <p className="text-white/60 text-sm leading-relaxed mb-4">{lesson.description}</p>
          {lesson.keyPoints.length > 0 && (
            <>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Key Points</p>
              <div className="flex flex-col gap-2">
                {lesson.keyPoints.map((pt, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-green-400 text-xs mt-0.5">✓</span>
                    <p className="text-white/60 text-xs">{pt}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quiz */}
        {lesson.quizQuestions && lesson.quizQuestions.length > 0 && !isCompleted && (
          <div className="glass border border-white/5 rounded-xl p-5 mb-5">
            <p className="text-white font-semibold mb-4">📝 Knowledge Check</p>
            {!quizSubmitted ? (
              <>
                {lesson.quizQuestions.map(q => (
                  <div key={q.id} className="mb-4">
                    <p className="text-white/70 text-sm mb-2">{q.question}</p>
                    <div className="flex flex-col gap-2">
                      {q.options.map((opt, i) => (
                        <button key={i} onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: i })}
                          className={`text-left px-3 py-2 rounded-lg text-xs border transition ${quizAnswers[q.id] === i ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/60 border-white/10 hover:border-white/20"}`}>
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleQuizSubmit}
                  disabled={Object.keys(quizAnswers).length < lesson.quizQuestions.length}
                  className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-green-500/30 transition">
                  Submit Quiz
                </button>
              </>
            ) : (
              <div className={`p-4 rounded-xl ${quizScore && quizScore >= 70 ? "bg-green-500/10 border border-green-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                <p className={`font-semibold text-sm ${quizScore && quizScore >= 70 ? "text-green-400" : "text-amber-400"}`}>
                  Score: {quizScore}% — {quizScore && quizScore >= 70 ? "Lesson Completed! 🎉" : "Score 70%+ to complete this lesson"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mark Complete */}
        {!isCompleted && (!lesson.quizQuestions || quizSubmitted) && (
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
  const { enrollCourse, unenrollCourse, isEnrolled, getProgress, userProgress, hasEarnedCert } = useAcademyStore();
  const { strategies } = useStrategyStore();
  const { addNotification } = useNotificationStore();
  const { user } = useAuthStore();

  const enrolled = isEnrolled(course.id);
  const progress = getProgress(course.id);
  const certEarned = hasEarnedCert(course.id);
  const progressData = userProgress[course.id];

  const linkedStrategies = strategies.filter(s => course.linkedStrategyIds.includes(s.id));

  const handleEnroll = () => {
    enrollCourse(course.id);
    addNotification({
      type: "academy",
      priority: "low",
      title: `📚 Enrolled — ${course.title}`,
      message: `You are now enrolled. Progress is saved locally.`,
      action: { label: "Start Learning", path: "/academy" },
    });
  };

  const handleCourseComplete = () => {
    if (progress === 100) {
      addNotification({
        type: "academy",
        priority: "medium",
        title: `🎓 Course Completed — ${course.title}`,
        message: course.certificateAvailable
          ? "Certificate earned! Coming soon to your profile."
          : "Course completed. Certificate not available for this course.",
        action: { label: "View Academy", path: "/academy" },
      });
    }
  };

  // Notify on first completion
  if (progress === 100) handleCourseComplete();

  const certStatusLabel = certEarned
    ? "🏆 Certificate Earned"
    : course.certificateAvailable
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
              <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${LEVEL_COLORS[course.level]}`}>{course.level}</span>
              {course.isFree ? (
                <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">Free</span>
              ) : (
                <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">${course.price}</span>
              )}
            </div>
            <h1 className="text-xl font-bold text-white mb-2">{course.title}</h1>
            <p className="text-white/50 text-sm mb-3 leading-relaxed">{course.description}</p>
            <div className="flex items-center gap-4 text-xs text-white/30">
              <span>👤 {course.instructor}</span>
              <span>⏱ {course.totalDuration}</span>
              <span>📚 {course.lessons.length} lessons</span>
            </div>
          </div>
          <div className="shrink-0">
            <ReportButton
              reportedItemType="course"
              reportedItemId={course.id}
              reportedItemTitle={course.title}
              reportedUserId={course.instructorHandle}
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

        {/* Enroll / unenroll buttons */}
        <div className="mt-4 flex gap-3">
          {!enrolled ? (
            <button onClick={handleEnroll}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
              {course.isFree ? "Enroll Free" : `Enroll — $${course.price} (Payment not connected)`}
            </button>
          ) : (
            <div className="flex gap-3">
              <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-lg font-semibold">✓ Enrolled</span>
              <button onClick={() => unenrollCourse(course.id)}
                className="text-xs text-white/30 hover:text-red-400 border border-white/10 hover:border-red-500/20 px-3 py-2 rounded-lg transition">
                Unenroll
              </button>
            </div>
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
                {lesson.quizQuestions && (
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
  const { isEnrolled, getProgress } = useAcademyStore();
  const enrolled = isEnrolled(course.id);
  const progress = getProgress(course.id);

  return (
    <div onClick={onClick}
      className="glass border border-white/5 rounded-xl p-5 cursor-pointer hover:border-white/15 transition relative group">

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
        <ReportButton
          reportedItemType="course"
          reportedItemId={course.id}
          reportedItemTitle={course.title}
          reportedUserId={course.instructorHandle}
          sourceFeature="Academy Course Listing"
          compact
        />
      </div>

      <div className="flex items-start gap-4 mb-3">
        <span className="text-4xl shrink-0">{course.thumbnail}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[course.type]}`}>{TYPE_LABELS[course.type]}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border capitalize ${LEVEL_COLORS[course.level]}`}>{course.level}</span>
          </div>
          <h3 className="text-white font-semibold text-sm leading-tight">{course.title}</h3>
        </div>
      </div>

      <p className="text-white/40 text-xs mb-3 line-clamp-2 leading-relaxed">{course.description}</p>

      <div className="flex items-center gap-3 text-xs text-white/30 mb-3">
        <span>👤 {course.instructor}</span>
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
          <span className={`text-xs font-bold ${course.isFree ? "text-green-400" : "text-amber-400"}`}>
            {course.isFree ? "Free" : `$${course.price}`}
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
  const { isEnrolled, getProgress } = useAcademyStore();
  const pathCourses = courses.filter(c => path.courseIds.includes(c.id));
  const enrolledCount = pathCourses.filter(c => isEnrolled(c.id)).length;
  const completedCount = pathCourses.filter(c => getProgress(c.id) === 100).length;

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
        <div className={`h-1.5 rounded-full transition-all ${path.level === "beginner" ? "bg-green-400" : path.level === "intermediate" ? "bg-amber-400" : "bg-red-400"}`}
          style={{ width: `${pathCourses.length > 0 ? (completedCount / pathCourses.length) * 100 : 0}%` }} />
      </div>

      <div className="flex flex-col gap-2">
        {pathCourses.map((course, i) => {
          const enrolled = isEnrolled(course.id);
          const prog = getProgress(course.id);
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
  const { courses, userProgress, isEnrolled, getProgress } = useAcademyStore();
  const { addNotification } = useNotificationStore();

  const [activeTab,    setActiveTab]    = useState<AcademyTab>("paths");
  const [levelFilter,  setLevelFilter]  = useState<LevelFilter>("all");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  const enrolledCourses  = courses.filter(c => isEnrolled(c.id));
  const completedCourses = courses.filter(c => getProgress(c.id) === 100);

  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (levelFilter !== "all" && c.level !== levelFilter) return false;
      if (typeFilter  !== "all" && c.type  !== typeFilter)  return false;
      return true;
    });
  }, [courses, levelFilter, typeFilter]);

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
                  <div className="flex justify-between mb-1"><span className="text-white/30 text-xs">Progress</span><span className="text-green-400 text-xs">{getProgress(selectedCourse.id)}%</span></div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${getProgress(selectedCourse.id)}%` }} />
                  </div>
                </div>
              </div>
              <div className="p-2">
                {selectedCourse.lessons.map((lesson, i) => {
                  const done = userProgress[selectedCourse.id]?.completedLessons.includes(lesson.id);
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
                Progress saved locally.
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
              TCC Academy is in Beta. Progress saved locally per device. Certificates are not yet issued — they will be available in Phase Alpha.
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
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs">
                  <option value="all">All Types</option>
                  <option value="official">Official TCC</option>
                  <option value="free_resource">Free Resource</option>
                  <option value="creator_published">Creator Published</option>
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