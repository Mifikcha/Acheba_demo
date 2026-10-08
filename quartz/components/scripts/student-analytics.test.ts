import assert from "node:assert/strict"
import test, { describe } from "node:test"

async function analytics() {
  const module = await import("./student-analytics").catch(() => null)
  assert.ok(module, "student analytics module must exist")
  return module
}

const attempts = [
  {
    id: "a-1",
    studentId: "demo",
    taskId: "task-1",
    topicId: "mechanics",
    startedAt: "2026-09-02T10:00:00Z",
    completedAt: "2026-09-02T10:10:00Z",
    durationSeconds: 600,
    score: 1,
    maxScore: 1,
    correct: true,
    attemptNumber: 1,
  },
  {
    id: "a-2",
    studentId: "demo",
    taskId: "task-2",
    topicId: "mechanics",
    startedAt: "2026-09-09T10:00:00Z",
    completedAt: "2026-09-09T10:10:00Z",
    score: 0,
    maxScore: 0,
    attemptNumber: 1,
  },
  {
    id: "a-3",
    studentId: "demo",
    taskId: "task-3",
    topicId: "algebra",
    startedAt: "2026-09-10T10:00:00Z",
    score: 1,
    maxScore: 1,
    attemptNumber: 1,
  },
] as const

describe("student analytics calculations", () => {
  test("accuracy ignores unfinished attempts and invalid maximum scores", async () => {
    const { calculateAccuracy } = await analytics()
    assert.equal(calculateAccuracy(attempts), 1)
    assert.equal(calculateAccuracy([]), null)
  })

  test("date range filtering keeps the boundary and supports all time", async () => {
    const { filterByDateRange } = await analytics()
    const now = new Date("2026-10-01T00:00:00Z")
    assert.deepEqual(
      filterByDateRange(attempts, "30d", now).map((attempt) => attempt.id),
      ["a-1", "a-2", "a-3"],
    )
    assert.equal(filterByDateRange(attempts, "all", now).length, 3)
  })

  test("weekly aggregation is stable across subjects and missing durations", async () => {
    const { aggregateAttemptsByWeek } = await analytics()
    assert.deepEqual(aggregateAttemptsByWeek(attempts), [
      { weekStart: "2026-08-31", attempts: 1, accuracy: 1, durationSeconds: 600 },
      { weekStart: "2026-09-07", attempts: 1, accuracy: null, durationSeconds: 0 },
    ])
  })

  test("topic classification requires enough completed evidence", async () => {
    const { classifyTopic } = await analytics()
    assert.equal(classifyTopic({ attempts: 1, accuracy: 1, mastery: 1, recentMistakes: 0 }), null)
    assert.equal(
      classifyTopic({ attempts: 5, accuracy: 0.9, mastery: 0.82, recentMistakes: 0 }),
      "strong",
    )
    assert.equal(
      classifyTopic({ attempts: 5, accuracy: 0.45, mastery: 0.38, recentMistakes: 3 }),
      "weak",
    )
  })

  test("completion counts topic coverage instead of raw attempts", async () => {
    const { calculateCompletion } = await analytics()
    assert.equal(calculateCompletion(["a", "b", "c"], ["a", "c", "missing"]), 2 / 3)
    assert.equal(calculateCompletion([], []), null)
  })

  test("daily activity joins site time, opened topics, and time per task", async () => {
    const { summarizeDailyActivity } = await analytics()
    const result = summarizeDailyActivity(
      [
        {
          id: "session-1",
          studentId: "demo",
          startedAt: "2026-09-10T09:00:00Z",
          activeDurationSeconds: 2700,
          subject: "physics",
          topicIds: ["mechanics", "algebra"],
          attemptsCount: 3,
        },
      ],
      [
        { ...attempts[0], startedAt: "2026-09-10T09:05:00Z", durationSeconds: 600 },
        {
          ...attempts[0],
          id: "a-4",
          startedAt: "2026-09-10T09:20:00Z",
          durationSeconds: 300,
        },
        { ...attempts[2], startedAt: "2026-09-10T09:35:00Z" },
      ],
      [
        { id: "mechanics", subject: "physics", title: "Кинематика" },
        { id: "algebra", subject: "mathematics", title: "Уравнения" },
      ],
      [
        {
          id: "task-1",
          topicId: "mechanics",
          title: "Равномерное движение",
          type: "exercise",
          difficulty: 1,
          source: "site",
        },
        {
          id: "task-3",
          topicId: "algebra",
          title: "Линейное уравнение",
          type: "exercise",
          difficulty: 1,
          source: "site",
        },
      ],
    )

    assert.deepEqual(result, [
      {
        date: "2026-09-10",
        durationSeconds: 2700,
        topics: ["Кинематика", "Уравнения"],
        tasks: [
          { title: "Равномерное движение", durationSeconds: 900 },
          { title: "Линейное уравнение", durationSeconds: null },
        ],
      },
    ])
    assert.equal(summarizeDailyActivity([], [attempts[0]], [], [])[0].durationSeconds, null)
  })
})

describe("mock analytics provider", () => {
  test("keeps demo data explicitly scoped to the demo student", async () => {
    const { DEMO_STUDENT_ID, MockStudentAnalyticsProvider } =
      await import("./student-analytics.mock").catch(() => ({
        DEMO_STUDENT_ID: null,
        MockStudentAnalyticsProvider: null,
      }))
    assert.ok(DEMO_STUDENT_ID)
    assert.ok(MockStudentAnalyticsProvider)
    const provider = new MockStudentAnalyticsProvider()
    assert.equal(provider.mode, "demo")
    assert.ok(await provider.getProfile(DEMO_STUDENT_ID))
    assert.equal(await provider.getProfile("another-student"), null)
    assert.equal((await provider.getAttempts("another-student")).length, 0)
  })

  test("loads a realistic multi-subject snapshot with gaps and recommendations", async () => {
    const { loadAnalyticsSnapshot } = await analytics()
    const { DEMO_STUDENT_ID, MockStudentAnalyticsProvider } =
      await import("./student-analytics.mock")
    const snapshot = await loadAnalyticsSnapshot(
      new MockStudentAnalyticsProvider(),
      DEMO_STUDENT_ID,
      new Date("2026-10-01T00:00:00Z"),
    )
    assert.ok(snapshot)
    assert.equal(new Set(snapshot.topics.map((topic) => topic.subject)).size, 3)
    assert.ok(snapshot.attempts.length >= 30)
    assert.ok(snapshot.exams.length >= 3)
    assert.ok(snapshot.recommendations.length >= 3)
    assert.ok(
      snapshot.sessions.some(
        (session, index, all) =>
          index > 0 &&
          new Date(session.startedAt).getTime() - new Date(all[index - 1].startedAt).getTime() >
            3 * 86_400_000,
      ),
    )
  })
})

describe("shell analytics adapter", () => {
  test("reads the same provider as the dashboard and returns terminal-ready summaries", async () => {
    const shellModule = await import("./student-analytics.shell").catch(() => null)
    assert.ok(shellModule)
    const { DEMO_STUDENT_ID, MockStudentAnalyticsProvider } =
      await import("./student-analytics.mock")
    const adapter = new shellModule.StudentAnalyticsShellAdapter(
      new MockStudentAnalyticsProvider(),
      DEMO_STUDENT_ID,
    )
    const progress = await adapter.progress()
    const mistakes = await adapter.mistakes()
    assert.equal(progress.type, "progress")
    assert.equal(mistakes.type, "list")
    assert.ok(progress.rows.length >= 3)
    assert.ok(mistakes.sections[0].items.length > 0)
  })
})
