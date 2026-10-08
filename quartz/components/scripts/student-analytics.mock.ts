import type {
  ActivityEvent,
  ExamResult,
  LearningRecommendation,
  StudentAnalyticsProvider,
  StudentProfile,
  StudySession,
  Subject,
  Task,
  TaskAttempt,
  Topic,
} from "./student-analytics"

export const DEMO_STUDENT_ID = "demo-student"

const profile: StudentProfile = {
  id: DEMO_STUDENT_ID,
  displayName: "Мира",
  createdAt: "2026-07-14T09:00:00+05:00",
  classLevel: "11 класс",
  targetExam: "ЕГЭ · профильная математика и физика",
  targetScore: 85,
}

const topics: Topic[] = [
  {
    id: "kinematics",
    subject: "physics",
    title: "Кинематика",
    courseId: "ege-physics",
    examSection: "Механика",
  },
  {
    id: "dynamics",
    subject: "physics",
    title: "Динамика",
    courseId: "ege-physics",
    examSection: "Механика",
  },
  {
    id: "mkt",
    subject: "physics",
    title: "Молекулярная физика",
    courseId: "ege-physics",
    examSection: "МКТ",
  },
  {
    id: "circuits",
    subject: "physics",
    title: "Электрические цепи",
    courseId: "ege-physics",
    examSection: "Электродинамика",
  },
  {
    id: "equations",
    subject: "mathematics",
    title: "Уравнения",
    courseId: "ege-math",
    examSection: "Алгебра",
  },
  {
    id: "logarithms",
    subject: "mathematics",
    title: "Логарифмы",
    courseId: "ege-math",
    examSection: "Алгебра",
  },
  {
    id: "derivatives",
    subject: "mathematics",
    title: "Производная",
    courseId: "ege-math",
    examSection: "Функции",
  },
  {
    id: "probability",
    subject: "mathematics",
    title: "Теория вероятностей",
    courseId: "ege-math",
    examSection: "Вероятность",
  },
  {
    id: "logic",
    subject: "informatics",
    title: "Логика",
    courseId: "ege-cs",
    examSection: "Задания 2–5",
  },
  {
    id: "number-systems",
    subject: "informatics",
    title: "Системы счисления",
    courseId: "ege-cs",
    examSection: "Задания 8, 14",
  },
  {
    id: "algorithms",
    subject: "informatics",
    title: "Алгоритмические паттерны",
    courseId: "ege-cs",
    examSection: "Задания 17–27",
  },
  {
    id: "recursion",
    subject: "informatics",
    title: "Рекурсия",
    courseId: "ege-cs",
    examSection: "Задание 16",
  },
]

const taskTypes: Task["type"][] = ["exercise", "exam_problem", "quiz"]
const tasks: Task[] = topics.flatMap((topic, topicIndex) =>
  Array.from({ length: 3 }, (_, index) => ({
    id: `${topic.id}-${index + 1}`,
    topicId: topic.id,
    title: `${topic.title} · задача ${index + 1}`,
    href: `/${topic.subject === "physics" ? "физика" : topic.subject === "mathematics" ? "математика" : "информатика"}`,
    type: taskTypes[index],
    difficulty: 1 + ((topicIndex + index) % 3),
    source: index === 1 ? "ЕГЭ" : "Hopes and Dreams",
    maxScore: index === 1 ? 2 : 1,
  })),
)

const activeTopicIds = topics.slice(0, 11).map((topic) => topic.id)
const attemptDates = [
  "2026-08-04",
  "2026-08-06",
  "2026-08-11",
  "2026-08-12",
  "2026-08-18",
  "2026-08-21",
  "2026-08-29",
  "2026-09-01",
  "2026-09-03",
  "2026-09-04",
  "2026-09-10",
  "2026-09-12",
  "2026-09-17",
  "2026-09-18",
  "2026-09-23",
  "2026-09-24",
  "2026-09-27",
  "2026-09-29",
  "2026-09-30",
]

const attempts: TaskAttempt[] = Array.from({ length: 48 }, (_, index) => {
  const topicId = activeTopicIds[(index * 5 + Math.floor(index / 7)) % activeTopicIds.length]
  const task = tasks.find((item) => item.id === `${topicId}-${(index % 3) + 1}`)!
  const day = attemptDates[(index * 7) % attemptDates.length]
  const maxScore = task.maxScore ?? 1
  const weak = topicId === "logarithms" || topicId === "circuits" || topicId === "algorithms"
  const score = weak
    ? index % 4 === 0
      ? maxScore
      : index % 3 === 0
        ? Math.max(0, maxScore - 1)
        : 0
    : index % 7 === 0
      ? Math.max(0, maxScore - 1)
      : maxScore
  const completed = index !== 46
  return {
    id: `attempt-${index + 1}`,
    studentId: DEMO_STUDENT_ID,
    taskId: task.id,
    topicId,
    startedAt: `${day}T${10 + (index % 8)}:00:00+05:00`,
    completedAt: completed ? `${day}T${10 + (index % 8)}:${12 + (index % 35)}:00+05:00` : undefined,
    durationSeconds: index % 9 === 0 ? undefined : 480 + (index % 8) * 95,
    score,
    maxScore,
    correct: completed ? score === maxScore : undefined,
    attemptNumber: weak && index % 4 !== 0 ? 2 : 1,
    hintsUsed: index % 6 === 0 ? 1 : 0,
    solutionViewed: weak && index % 5 === 0,
    source: task.source,
  }
})

const exams: ExamResult[] = [
  ["exam-1", "diagnostic", "mathematics", "2026-08-02", 58],
  ["exam-2", "mock_exam", "physics", "2026-08-16", 64],
  ["exam-3", "mock_exam", "mathematics", "2026-09-02", 72],
  ["exam-4", "mock_exam", "physics", "2026-09-16", 68],
  ["exam-5", "mock_exam", "mathematics", "2026-09-28", 77],
].map(([id, examType, subject, date, finalScore]) => ({
  id: String(id),
  studentId: DEMO_STUDENT_ID,
  examType: examType as ExamResult["examType"],
  subject: subject as Subject,
  date: String(date),
  finalScore: Number(finalScore),
  maxScore: 100,
  durationSeconds: 3 * 60 * 60,
  source: "Учебный пробник H&D",
}))

const sessionDates = [
  "2026-08-04",
  "2026-08-06",
  "2026-08-11",
  "2026-08-18",
  "2026-08-21",
  "2026-08-29",
  "2026-09-01",
  "2026-09-03",
  "2026-09-10",
  "2026-09-12",
  "2026-09-17",
  "2026-09-18",
  "2026-09-23",
  "2026-09-24",
  "2026-09-27",
  "2026-09-29",
  "2026-09-30",
]
const sessions: StudySession[] = sessionDates.map((date, index) => {
  const topic = topics[(index * 3) % topics.length]
  return {
    id: `session-${index + 1}`,
    studentId: DEMO_STUDENT_ID,
    startedAt: `${date}T${11 + (index % 7)}:00:00+05:00`,
    endedAt: `${date}T${11 + (index % 7)}:${35 + (index % 20)}:00+05:00`,
    activeDurationSeconds: 2100 + (index % 5) * 540,
    subject: topic.subject,
    topicIds: [topic.id],
    attemptsCount: 2 + (index % 5),
  }
})

const activities: ActivityEvent[] = sessions.flatMap((session, index) => {
  const topic = topics.find((item) => item.id === session.topicIds[0])!
  const completed = index % 4 === 0
  return [
    {
      id: `activity-session-${index + 1}`,
      studentId: DEMO_STUDENT_ID,
      timestamp: session.startedAt,
      type: "study_session_started" as const,
      subject: session.subject,
      topicId: topic.id,
      durationSeconds: session.activeDurationSeconds,
      metadata: { title: `${topic.title}: учебная сессия` },
    },
    ...(completed
      ? [
          {
            id: `activity-lesson-${index + 1}`,
            studentId: DEMO_STUDENT_ID,
            timestamp: session.endedAt!,
            type: "lesson_completed" as const,
            subject: session.subject,
            topicId: topic.id,
            metadata: { title: `Завершён раздел «${topic.title}»` },
          },
        ]
      : []),
  ]
})

const recommendations: LearningRecommendation[] = [
  {
    id: "rec-1",
    kind: "weak_topic",
    title: "Закрепить логарифмы",
    detail: "Повторить свойства и решить 3 задачи без подсказок.",
    topicId: "logarithms",
    href: "/математика",
  },
  {
    id: "rec-2",
    kind: "retry",
    title: "Вернуться к электрическим цепям",
    detail: "Две недавние попытки требуют повторного решения.",
    topicId: "circuits",
    href: "/физика",
  },
  {
    id: "rec-3",
    kind: "continue",
    title: "Продолжить производную",
    detail: "Следующий шаг — экстремумы функции.",
    topicId: "derivatives",
    href: "/математика",
  },
  {
    id: "rec-4",
    kind: "next_topic",
    title: "Открыть рекурсию",
    detail: "Тема ещё не начата и логично продолжает текущий маршрут.",
    topicId: "recursion",
    href: "/информатика",
  },
]

const forStudent = <T extends { studentId: string }>(studentId: string, values: readonly T[]) =>
  studentId === DEMO_STUDENT_ID ? [...values] : []

export class MockStudentAnalyticsProvider implements StudentAnalyticsProvider {
  readonly mode = "demo" as const

  async getProfile(studentId: string) {
    return studentId === DEMO_STUDENT_ID ? { ...profile } : null
  }
  async getTopics(studentId: string) {
    return studentId === DEMO_STUDENT_ID ? [...topics] : []
  }
  async getTasks(studentId: string) {
    return studentId === DEMO_STUDENT_ID ? [...tasks] : []
  }
  async getAttempts(studentId: string) {
    return forStudent(studentId, attempts)
  }
  async getActivity(studentId: string) {
    return forStudent(studentId, activities)
  }
  async getExamResults(studentId: string) {
    return forStudent(studentId, exams)
  }
  async getStudySessions(studentId: string) {
    return forStudent(studentId, sessions)
  }
  async getRecommendations(studentId: string) {
    return studentId === DEMO_STUDENT_ID ? [...recommendations] : []
  }
}
