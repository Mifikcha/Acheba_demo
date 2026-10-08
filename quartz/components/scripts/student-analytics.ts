export const SUBJECT_LABELS = {
  physics: "Физика",
  mathematics: "Математика",
  informatics: "Информатика",
} as const

export type Subject = keyof typeof SUBJECT_LABELS
export type SubjectFilter = Subject | "all"
export type DateRange = "7d" | "30d" | "90d" | "all"
export type TopicStatus = "not_started" | "learning" | "practicing" | "stable" | "needs_attention"

export interface StudentProfile {
  id: string
  displayName: string
  createdAt: string
  classLevel?: string
  targetExam?: string
  targetScore?: number
}

export interface Topic {
  id: string
  subject: Subject
  title: string
  parentTopicId?: string
  courseId?: string
  examSection?: string
  difficulty?: number
}

export interface Task {
  id: string
  topicId: string
  title: string
  href?: string
  type: "exercise" | "exam_problem" | "quiz" | "coding" | "diagnostic" | "mock_exam"
  difficulty: number
  source: string
  maxScore?: number
}

export interface TaskAttempt {
  id: string
  studentId: string
  taskId: string
  topicId: string
  startedAt: string
  completedAt?: string
  durationSeconds?: number
  score: number
  maxScore: number
  correct?: boolean
  attemptNumber: number
  hintsUsed?: number
  solutionViewed?: boolean
  source?: string
}

export interface ActivityEvent {
  id: string
  studentId: string
  timestamp: string
  type:
    | "lesson_opened"
    | "lesson_completed"
    | "task_started"
    | "task_completed"
    | "task_failed"
    | "task_retried"
    | "mock_exam_completed"
    | "coding_exercise_completed"
    | "note_viewed"
    | "study_session_started"
    | "study_session_ended"
  subject?: Subject
  topicId?: string
  entityId?: string
  durationSeconds?: number
  metadata?: Record<string, string | number | boolean>
}

export interface ExamResult {
  id: string
  studentId: string
  examType: "diagnostic" | "mock_exam" | "official_exam"
  subject: Subject
  date: string
  rawScore?: number
  primaryScore?: number
  finalScore?: number
  maxScore: number
  durationSeconds?: number
  sectionScores?: Record<string, number>
  source: string
}

export interface StudySession {
  id: string
  studentId: string
  startedAt: string
  endedAt?: string
  activeDurationSeconds?: number
  subject?: Subject
  topicIds: string[]
  attemptsCount: number
}

export interface LearningRecommendation {
  id: string
  kind: "weak_topic" | "retry" | "continue" | "next_topic"
  title: string
  detail: string
  topicId?: string
  href?: string
}

export interface TopicProgress {
  topicId: string
  completion: number
  accuracy: number | null
  attempts: number
  successfulAttempts: number
  averageScore: number | null
  averageDurationSeconds: number | null
  lastActivityAt?: string
  mastery: number
  status: TopicStatus
  recentMistakes: number
}

export interface DailyActivitySummary {
  date: string
  durationSeconds: number | null
  topics: string[]
  tasks: Array<{ title: string; durationSeconds: number | null }>
}

export interface AnalyticsSnapshot {
  profile: StudentProfile
  topics: Topic[]
  tasks: Task[]
  attempts: TaskAttempt[]
  activity: ActivityEvent[]
  exams: ExamResult[]
  sessions: StudySession[]
  topicProgress: TopicProgress[]
  recommendations: LearningRecommendation[]
}

export interface StudentAnalyticsProvider {
  readonly mode: "demo" | "authenticated"
  getProfile(studentId: string): Promise<StudentProfile | null>
  getTopics(studentId: string): Promise<Topic[]>
  getTasks(studentId: string): Promise<Task[]>
  getAttempts(studentId: string): Promise<TaskAttempt[]>
  getActivity(studentId: string): Promise<ActivityEvent[]>
  getExamResults(studentId: string): Promise<ExamResult[]>
  getStudySessions(studentId: string): Promise<StudySession[]>
  getRecommendations(studentId: string): Promise<LearningRecommendation[]>
}

export const ANALYTICS_THRESHOLDS = {
  minAttemptsForClassification: 4,
  strongAccuracy: 0.8,
  strongMastery: 0.72,
  weakAccuracy: 0.6,
  weakMastery: 0.55,
} as const

type Dated = { startedAt?: string; timestamp?: string; date?: string }

function validCompletedAttempts(attempts: readonly TaskAttempt[]): TaskAttempt[] {
  return attempts.filter(
    (attempt) =>
      Boolean(attempt.completedAt) &&
      Number.isFinite(attempt.score) &&
      Number.isFinite(attempt.maxScore) &&
      attempt.maxScore > 0,
  )
}

export function calculateAccuracy(attempts: readonly TaskAttempt[]): number | null {
  const valid = validCompletedAttempts(attempts)
  if (valid.length === 0) return null
  return valid.reduce((sum, attempt) => sum + attempt.score / attempt.maxScore, 0) / valid.length
}

export function calculateCompletion(
  allTopicIds: readonly string[],
  startedTopicIds: readonly string[],
): number | null {
  const uniqueTopics = new Set(allTopicIds)
  if (uniqueTopics.size === 0) return null
  const started = new Set(startedTopicIds.filter((id) => uniqueTopics.has(id)))
  return started.size / uniqueTopics.size
}

export function filterByDateRange<T extends Dated>(
  items: readonly T[],
  range: DateRange,
  now = new Date(),
): T[] {
  if (range === "all") return [...items]
  const days = Number.parseInt(range, 10)
  const from = new Date(now)
  from.setUTCDate(from.getUTCDate() - days)
  return items.filter((item) => {
    const value = item.startedAt ?? item.timestamp ?? item.date
    return value ? new Date(value) >= from : false
  })
}

function monday(date: Date): string {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7))
  return result.toISOString().slice(0, 10)
}

export function aggregateAttemptsByWeek(attempts: readonly TaskAttempt[]) {
  const weeks = new Map<string, TaskAttempt[]>()
  for (const attempt of attempts.filter((item) => item.completedAt)) {
    const key = monday(new Date(attempt.completedAt!))
    weeks.set(key, [...(weeks.get(key) ?? []), attempt])
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, values]) => ({
      weekStart,
      attempts: values.length,
      accuracy: calculateAccuracy(values),
      durationSeconds: values.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0),
    }))
}

export function summarizeDailyActivity(
  sessions: readonly StudySession[],
  attempts: readonly TaskAttempt[],
  topics: readonly Topic[],
  tasks: readonly Task[],
): DailyActivitySummary[] {
  const topicById = new Map(topics.map((topic) => [topic.id, topic.title]))
  const taskById = new Map(tasks.map((task) => [task.id, task.title]))
  const days = new Map<
    string,
    {
      durationSeconds: number | null
      topics: Set<string>
      tasks: Map<string, { title: string; durationSeconds: number | null }>
    }
  >()
  const getDay = (date: string) => {
    const key = date.slice(0, 10)
    const value = days.get(key) ?? {
      durationSeconds: null,
      topics: new Set<string>(),
      tasks: new Map<string, { title: string; durationSeconds: number | null }>(),
    }
    days.set(key, value)
    return value
  }

  for (const session of sessions) {
    const day = getDay(session.startedAt)
    day.durationSeconds = (day.durationSeconds ?? 0) + (session.activeDurationSeconds ?? 0)
    for (const topicId of session.topicIds) day.topics.add(topicById.get(topicId) ?? topicId)
  }
  for (const attempt of attempts) {
    const day = getDay(attempt.startedAt)
    day.topics.add(topicById.get(attempt.topicId) ?? attempt.topicId)
    const task = day.tasks.get(attempt.taskId) ?? {
      title: taskById.get(attempt.taskId) ?? attempt.taskId,
      durationSeconds: null,
    }
    if (attempt.durationSeconds !== undefined)
      task.durationSeconds = (task.durationSeconds ?? 0) + attempt.durationSeconds
    day.tasks.set(attempt.taskId, task)
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => ({
      date,
      durationSeconds: day.durationSeconds,
      topics: [...day.topics],
      tasks: [...day.tasks.values()],
    }))
}

export function classifyTopic(input: {
  attempts: number
  accuracy: number | null
  mastery: number
  recentMistakes: number
}): "strong" | "weak" | null {
  if (input.attempts < ANALYTICS_THRESHOLDS.minAttemptsForClassification || input.accuracy === null)
    return null
  if (
    input.accuracy >= ANALYTICS_THRESHOLDS.strongAccuracy &&
    input.mastery >= ANALYTICS_THRESHOLDS.strongMastery &&
    input.recentMistakes <= 1
  )
    return "strong"
  if (
    input.accuracy < ANALYTICS_THRESHOLDS.weakAccuracy ||
    input.mastery < ANALYTICS_THRESHOLDS.weakMastery ||
    input.recentMistakes >= 3
  )
    return "weak"
  return null
}

function progressForTopic(
  topic: Topic,
  tasks: readonly Task[],
  attempts: readonly TaskAttempt[],
  now: Date,
): TopicProgress {
  const topicTasks = tasks.filter((task) => task.topicId === topic.id)
  const topicAttempts = attempts.filter((attempt) => attempt.topicId === topic.id)
  const valid = validCompletedAttempts(topicAttempts)
  const completedTaskIds = new Set(valid.map((attempt) => attempt.taskId))
  const accuracy = calculateAccuracy(topicAttempts)
  const completion = topicTasks.length === 0 ? 0 : completedTaskIds.size / topicTasks.length
  const successfulAttempts = valid.filter(
    (attempt) => attempt.score / attempt.maxScore >= 0.8,
  ).length
  const averageScore = accuracy
  const durations = valid.flatMap((attempt) => attempt.durationSeconds ?? [])
  const averageDurationSeconds = durations.length
    ? durations.reduce((sum, value) => sum + value, 0) / durations.length
    : null
  const lastActivityAt = topicAttempts
    .flatMap((attempt) => attempt.completedAt ?? [])
    .sort()
    .at(-1)
  const recent = filterByDateRange(valid, "30d", now)
  const recentAccuracy = calculateAccuracy(recent) ?? accuracy ?? 0
  const evidence = Math.min(1, valid.length / 6)
  const mastery = Math.min(1, completion * 0.35 + recentAccuracy * 0.45 + evidence * 0.2)
  const recentMistakes = recent.filter((attempt) => attempt.score / attempt.maxScore < 0.6).length
  const classification = classifyTopic({
    attempts: valid.length,
    accuracy,
    mastery,
    recentMistakes,
  })
  const status: TopicStatus =
    valid.length === 0
      ? "not_started"
      : classification === "weak"
        ? "needs_attention"
        : mastery >= 0.72
          ? "stable"
          : completion >= 0.5
            ? "practicing"
            : "learning"
  return {
    topicId: topic.id,
    completion,
    accuracy,
    attempts: valid.length,
    successfulAttempts,
    averageScore,
    averageDurationSeconds,
    lastActivityAt,
    mastery,
    status,
    recentMistakes,
  }
}

export async function loadAnalyticsSnapshot(
  provider: StudentAnalyticsProvider,
  studentId: string,
  now = new Date(),
): Promise<AnalyticsSnapshot | null> {
  const [profile, topics, tasks, attempts, activity, exams, sessions, recommendations] =
    await Promise.all([
      provider.getProfile(studentId),
      provider.getTopics(studentId),
      provider.getTasks(studentId),
      provider.getAttempts(studentId),
      provider.getActivity(studentId),
      provider.getExamResults(studentId),
      provider.getStudySessions(studentId),
      provider.getRecommendations(studentId),
    ])
  if (!profile) return null
  const scoped = <T extends { studentId: string }>(values: T[]) =>
    values.filter((value) => value.studentId === studentId)
  const scopedAttempts = scoped(attempts)
  return {
    profile,
    topics,
    tasks,
    attempts: scopedAttempts,
    activity: scoped(activity),
    exams: scoped(exams),
    sessions: scoped(sessions),
    topicProgress: topics.map((topic) => progressForTopic(topic, tasks, scopedAttempts, now)),
    recommendations,
  }
}

export function filterSnapshot(
  snapshot: AnalyticsSnapshot,
  subject: SubjectFilter,
  range: DateRange,
  now = new Date(),
) {
  const topicIds = new Set(
    snapshot.topics
      .filter((topic) => subject === "all" || topic.subject === subject)
      .map((topic) => topic.id),
  )
  return {
    topics: snapshot.topics.filter((topic) => topicIds.has(topic.id)),
    tasks: snapshot.tasks.filter((task) => topicIds.has(task.topicId)),
    attempts: filterByDateRange(
      snapshot.attempts.filter((attempt) => topicIds.has(attempt.topicId)),
      range,
      now,
    ),
    activity: filterByDateRange(
      snapshot.activity.filter((event) => subject === "all" || event.subject === subject),
      range,
      now,
    ),
    exams: filterByDateRange(
      snapshot.exams.filter((exam) => subject === "all" || exam.subject === subject),
      range,
      now,
    ),
    sessions: filterByDateRange(
      snapshot.sessions.filter((session) => subject === "all" || session.subject === subject),
      range,
      now,
    ),
    topicProgress: snapshot.topicProgress.filter((progress) => topicIds.has(progress.topicId)),
  }
}
