import {
  SUBJECT_LABELS,
  classifyTopic,
  loadAnalyticsSnapshot,
  type StudentAnalyticsProvider,
} from "./student-analytics"
import type { ConsoleResult } from "./system-console.types"

export interface AnalyticsShellAdapter {
  progress(): Promise<ConsoleResult>
  today(): Promise<ConsoleResult>
  weak(): Promise<ConsoleResult>
  strong(): Promise<ConsoleResult>
  mistakes(): Promise<ConsoleResult>
  stats(): Promise<ConsoleResult>
}

export class StudentAnalyticsShellAdapter implements AnalyticsShellAdapter {
  constructor(
    private readonly provider: StudentAnalyticsProvider,
    private readonly studentId: string,
  ) {}

  private async snapshot() {
    const snapshot = await loadAnalyticsSnapshot(this.provider, this.studentId)
    if (!snapshot) throw new Error("Student analytics unavailable")
    return snapshot
  }

  async progress(): Promise<ConsoleResult> {
    const snapshot = await this.snapshot()
    return {
      type: "progress",
      title: "PROGRAM PROGRESS",
      rows: Object.entries(SUBJECT_LABELS).map(([subject, label]) => {
        const topicIds = new Set(
          snapshot.topics.filter((topic) => topic.subject === subject).map((topic) => topic.id),
        )
        const progress = snapshot.topicProgress.filter((item) => topicIds.has(item.topicId))
        return {
          label,
          value: progress.length
            ? progress.reduce((sum, item) => sum + item.mastery, 0) / progress.length
            : 0,
        }
      }),
    }
  }

  async today(): Promise<ConsoleResult> {
    const snapshot = await this.snapshot()
    const today = new Date().toISOString().slice(0, 10)
    const sessions = snapshot.sessions.filter((session) => session.startedAt.slice(0, 10) === today)
    return {
      type: "text",
      title: "TODAY",
      lines: [
        `sessions: ${sessions.length}`,
        `active: ${Math.round(sessions.reduce((sum, session) => sum + (session.activeDurationSeconds ?? 0), 0) / 60)} min`,
      ],
    }
  }

  private async topics(kind: "strong" | "weak"): Promise<ConsoleResult> {
    const snapshot = await this.snapshot()
    const byId = new Map(snapshot.topics.map((topic) => [topic.id, topic]))
    const items = snapshot.topicProgress.filter((progress) => classifyTopic(progress) === kind)
    return {
      type: "list",
      title: kind === "strong" ? "STRONG TOPICS" : "NEEDS ATTENTION",
      sections: [
        {
          items: items.map((progress) => ({
            label: byId.get(progress.topicId)?.title ?? progress.topicId,
            detail: `${Math.round(progress.mastery * 100)}% mastery`,
          })),
        },
      ],
    }
  }

  weak() {
    return this.topics("weak")
  }
  strong() {
    return this.topics("strong")
  }

  async mistakes(): Promise<ConsoleResult> {
    const snapshot = await this.snapshot()
    const tasks = new Map(snapshot.tasks.map((task) => [task.id, task]))
    const items = snapshot.attempts
      .filter(
        (attempt) =>
          attempt.completedAt && attempt.maxScore > 0 && attempt.score / attempt.maxScore < 0.6,
      )
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 5)
      .map((attempt) => ({
        label: tasks.get(attempt.taskId)?.title ?? attempt.taskId,
        detail: `${attempt.score}/${attempt.maxScore} · attempt ${attempt.attemptNumber}`,
        href: tasks.get(attempt.taskId)?.href,
      }))
    return { type: "list", title: "RECENT MISTAKES", sections: [{ items }] }
  }

  async stats(): Promise<ConsoleResult> {
    const snapshot = await this.snapshot()
    return {
      type: "navigation",
      eyebrow: this.provider.mode === "demo" ? "DEMO DATA" : "STUDENT ANALYTICS",
      title: `${snapshot.profile.displayName} · statistics`,
      href: "/statistics",
      detail: "OPEN",
    }
  }
}
