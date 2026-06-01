"use client";
import { useState } from "react";
import { useAcademyStore, Course, CourseCategory } from "@/store/academyStore";
import { useAuthStore } from "@/store/authStore";
import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";
import ReportButton from "@/components/ReportButton";

const levelColors: Record<string, string> = {
  BEGINNER: "text-green-400 bg-green-500/10 border-green-500/20",
  INTERMEDIATE: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  ADVANCED: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  PRO: "text-red-400 bg-red-500/10 border-red-500/20",
};

const categoryIcons: Record<CourseCategory, string> = {
  smc: "📊", forex: "💱", crypto: "₿", psychology: "🧠",
  risk: "🛡", technical: "📈", fundamental: "📰",
};

export default function AcademyPage() {
  const { courses, userProgress, enrollCourse, completeLesson, submitQuiz, isEnrolled, getProgress } = useAcademyStore();
  const { user } = useAuthStore();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "enrolled" | "completed">("all");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredCourses = courses.filter(c => {
    if (activeTab === "enrolled") return isEnrolled(c.id);
    if (activeTab === "completed") return getProgress(c.id) === 100;
    if (filterCategory !== "all") return c.category === filterCategory;
    return true;
  });

  const activeCourse = selectedCourse;
  const activeLesson = activeCourse?.lessons.find(l => l.id === selectedLesson);
  const progress = activeCourse ? getProgress(activeCourse.id) : 0;
  const progressData = activeCourse ? userProgress[activeCourse.id] : null;

  const handleQuizSubmit = () => {
    if (!activeCourse || !activeLesson?.quizQuestions) return;
    let correct = 0;
    activeLesson.quizQuestions.forEach(q => {
      if (quizAnswers[q.id] === q.correctIndex) correct++;
    });
    const score = Math.round((correct / activeLesson.quizQuestions.length) * 100);
    submitQuiz(activeCourse.id, activeLesson.id, score);
    setQuizSubmitted(true);
    if (score >= 70) completeLesson(activeCourse.id, activeLesson.id);
  };

  // Lesson player view
  if (selectedCourse && selectedLesson && activeLesson) {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 overflow-hidden">
            <div className="w-72 shrink-0 glass border-r border-white/5 overflow-y-auto">
              <div className="p-4 border-b border-white/5">
                <button onClick={() => setSelectedLesson(null)} className="text-white/40 hover:text-white text-xs mb-2 transition">← Back to course</button>
                <p className="text-white font-semibold text-sm">{activeCourse.title}</p>
                <div className="mt-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-white/30 text-xs">Progress</span>
                    <span className="text-green-400 text-xs">{progress}%</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5">
                    <div className="bg-green-400 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
              <div className="p-2">
                {activeCourse.lessons.map((lesson, i) => {
                  const isCompleted = progressData?.completedLessons.includes(lesson.id);
                  const isActive = lesson.id === selectedLesson;
                  return (
                    <button key={lesson.id} onClick={() => { setSelectedLesson(lesson.id); setQuizSubmitted(false); setQuizAnswers({}); }}
                      className={`w-full text-left p-3 rounded-lg mb-1 transition flex items-start gap-3 ${isActive ? "bg-green-500/10 border border-green-500/20" : "hover:bg-white/5"}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5 ${isCompleted ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/40"}`}>
                        {isCompleted ? "✓" : i + 1}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${isActive ? "text-green-400" : "text-white/70"}`}>{lesson.title}</p>
                        <p className="text-white/30 text-xs">{lesson.duration}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white/40 text-xs mb-1">{activeCourse.title}</p>
                    <h2 className="text-xl font-bold text-white">{activeLesson.title}</h2>
                  </div>
                  <span className="text-white/30 text-sm">{activeLesson.duration}</span>
                </div>

                <div className="glass border border-white/5 rounded-xl aspect-video flex items-center justify-center mb-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
                  <div className="text-center relative z-10">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-3 cursor-pointer hover:bg-green-500/30 transition">
                      <span className="text-green-400 text-2xl ml-1">▶</span>
                    </div>
                    <p className="text-white/50 text-sm">{activeLesson.title}</p>
                    <p className="text-white/20 text-xs mt-1">{activeLesson.duration} · {activeCourse.instructorHandle}</p>
                  </div>
                </div>

                <div className="glass border border-white/5 rounded-xl p-5 mb-4">
                  <p className="text-white/60 text-sm leading-relaxed">{activeLesson.description}</p>
                </div>

                {activeLesson.quizQuestions && !quizSubmitted && (
                  <div className="glass border border-white/5 rounded-xl p-5 mb-4">
                    <p className="text-white font-semibold mb-4">📝 Quick Quiz</p>
                    {activeLesson.quizQuestions.map((q) => (
                      <div key={q.id} className="mb-4">
                        <p className="text-white/70 text-sm mb-2">{q.question}</p>
                        <div className="flex flex-col gap-2">
                          {q.options.map((opt, i) => (
                            <button key={i} onClick={() => setQuizAnswers({ ...quizAnswers, [q.id]: i })}
                              className={`text-left px-3 py-2 rounded-lg text-sm border transition ${quizAnswers[q.id] === i ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/60 border-white/10 hover:border-white/20"}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button onClick={handleQuizSubmit}
                      disabled={Object.keys(quizAnswers).length < activeLesson.quizQuestions.length}
                      className="bg-green-500/20 text-green-400 border border-green-500/30 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
                      Submit Quiz
                    </button>
                  </div>
                )}

                {quizSubmitted && (
                  <div className="glass border border-green-500/20 bg-green-500/5 rounded-xl p-5 mb-4">
                    <p className="text-green-400 font-semibold">
                      ✓ Quiz Score: {progressData?.quizScores[activeLesson.id]}%
                      {(progressData?.quizScores[activeLesson.id] || 0) >= 70 ? " — Lesson completed! 🎉" : " — Score 70%+ to complete"}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  {!activeLesson.quizQuestions && (
                    <button onClick={() => completeLesson(activeCourse.id, activeLesson.id)}
                      className="bg-green-500/20 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-500/30 transition">
                      ✓ Mark Complete
                    </button>
                  )}
                  {progress === 100 && progressData?.certificateEarned && (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-lg">
                      <span className="text-amber-400">🏆</span>
                      <span className="text-amber-400 text-sm font-semibold">Certificate Earned!</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Course detail view
  if (selectedCourse) {
    const enrolled = isEnrolled(selectedCourse.id);
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              <button onClick={() => setSelectedCourse(null)} className="text-white/40 hover:text-white text-sm mb-4 transition">← Back to Academy</button>

              <div className="glass border border-white/5 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-5">
                  <div className="text-6xl">{selectedCourse.thumbnail}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${levelColors[selectedCourse.level]}`}>{selectedCourse.level}</span>
                      {selectedCourse.isFree
                        ? <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">FREE</span>
                        : <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">${selectedCourse.price}</span>}
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">{selectedCourse.title}</h1>
                    <p className="text-white/50 text-sm mb-3">{selectedCourse.description}</p>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span>👤 {selectedCourse.instructor}</span>
                      <span>⏱ {selectedCourse.totalDuration}</span>
                      <span>📚 {selectedCourse.lessons.length} lessons</span>
                      <span>👥 {selectedCourse.enrolled.toLocaleString()} enrolled</span>
                      <span>⭐ {selectedCourse.rating}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ReportButton
                      reportedItemType="course"
                      reportedItemId={selectedCourse.id}
                      reportedItemTitle={selectedCourse.title}
                      reportedUserId={selectedCourse.instructorHandle}
                      sourceFeature="Academy Course Detail"
                    />
                  </div>
                </div>

                {enrolled && (
                  <div className="mt-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-white/40 text-xs">Your Progress</span>
                      <span className="text-green-400 text-xs">{getProgress(selectedCourse.id)}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full transition-all" style={{ width: `${getProgress(selectedCourse.id)}%` }} />
                    </div>
                  </div>
                )}

                {!enrolled ? (
                  <button onClick={() => enrollCourse(selectedCourse.id)}
                    className="mt-4 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-6 py-2 rounded-lg text-sm font-semibold transition">
                    {selectedCourse.isFree ? "Enroll Free" : `Enroll — $${selectedCourse.price}`}
                  </button>
                ) : (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {selectedCourse.tags.map(tag => (
                      <span key={tag} className="text-xs bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/10">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass border border-white/5 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5">
                  <p className="text-white font-semibold">Course Content</p>
                  <p className="text-white/30 text-xs mt-1">{selectedCourse.lessons.length} lessons · {selectedCourse.totalDuration}</p>
                </div>
                {selectedCourse.lessons.map((lesson, i) => {
                  const isCompleted = userProgress[selectedCourse.id]?.completedLessons.includes(lesson.id);
                  return (
                    <div key={lesson.id}
                      className={`flex items-center gap-4 px-5 py-4 border-b border-white/5 transition ${enrolled ? "cursor-pointer hover:bg-white/2" : "opacity-60"}`}
                      onClick={() => enrolled && setSelectedLesson(lesson.id)}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${isCompleted ? "bg-green-500/20 text-green-400" : "bg-white/5 text-white/40"}`}>
                        {isCompleted ? "✓" : i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white/80 text-sm">{lesson.title}</p>
                        <p className="text-white/30 text-xs mt-0.5">{lesson.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {lesson.quizQuestions && <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">📝 Quiz</span>}
                        <span className="text-white/30 text-xs">{lesson.duration}</span>
                        {!enrolled && <span className="text-white/20 text-xs">🔒</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Course listing view
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0f]">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex-1 overflow-y-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">🎓 Academy</h1>
              <p className="text-white/40 text-sm mt-1">Learn from verified pro traders. Free courses, quizzes, certificates.</p>
            </div>
          </div>

          <div className="flex gap-1 bg-white/5 rounded-lg p-1 mb-6">
            {(["all", "enrolled", "completed"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold capitalize transition ${activeTab === tab ? "bg-green-500/20 text-green-400" : "text-white/40"}`}>
                {tab === "all" ? "📚 All Courses" : tab === "enrolled" ? "⚡ My Courses" : "🏆 Completed"}
              </button>
            ))}
          </div>

          {activeTab === "all" && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {["all", "smc", "psychology", "risk", "crypto", "forex", "technical"].map(cat => (
                <button key={cat} onClick={() => setFilterCategory(cat)}
                  className={`text-xs px-3 py-1 rounded-full border capitalize transition ${filterCategory === cat ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"}`}>
                  {cat === "all" ? "All" : `${categoryIcons[cat as CourseCategory]} ${cat.toUpperCase()}`}
                </button>
              ))}
            </div>
          )}

          {filteredCourses.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-white/20">No courses found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredCourses.map((course) => {
                const enrolled = isEnrolled(course.id);
                const prog = getProgress(course.id);
                return (
                  <div key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className="glass border border-white/5 rounded-xl p-5 cursor-pointer hover:border-white/15 transition relative group">

                    {/* Report button — top right, on hover */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition z-10"
                      onClick={e => e.stopPropagation()}>
                      <ReportButton
                        reportedItemType="course"
                        reportedItemId={course.id}
                        reportedItemTitle={course.title}
                        reportedUserId={course.instructorHandle}
                        sourceFeature="Academy Course Listing"
                        compact
                      />
                    </div>

                    <div className="flex items-start justify-between mb-3">
                      <span className="text-4xl">{course.thumbnail}</span>
                      <div className="flex flex-col items-end gap-1 mr-6">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${levelColors[course.level]}`}>{course.level}</span>
                        {course.isFree
                          ? <span className="text-xs text-green-400 font-bold">FREE</span>
                          : <span className="text-xs text-amber-400 font-bold">${course.price}</span>}
                      </div>
                    </div>

                    <h3 className="text-white font-semibold text-sm mb-1">{course.title}</h3>
                    <p className="text-white/40 text-xs mb-3 line-clamp-2">{course.description}</p>

                    <div className="flex items-center gap-3 text-xs text-white/30 mb-3">
                      <span>👤 {course.instructor}</span>
                      <span>⏱ {course.totalDuration}</span>
                      <span>⭐ {course.rating}</span>
                    </div>

                    {enrolled && (
                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-white/30 text-xs">Progress</span>
                          <span className="text-green-400 text-xs">{prog}%</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5">
                          <div className="bg-green-400 h-1.5 rounded-full" style={{ width: `${prog}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1 flex-wrap">
                        {course.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-xs bg-white/5 text-white/30 px-1.5 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {course.completionCertificate && <span className="text-xs text-amber-400">🏆 Cert</span>}
                        {enrolled
                          ? <span className="text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Enrolled</span>
                          : <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">View →</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}