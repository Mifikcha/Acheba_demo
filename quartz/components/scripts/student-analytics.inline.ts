import {
  SUBJECT_LABELS,
  aggregateAttemptsByWeek,
  calculateAccuracy,
  calculateCompletion,
  classifyTopic,
  filterSnapshot,
  loadAnalyticsSnapshot,
  summarizeDailyActivity,
  type AnalyticsSnapshot,
  type DateRange,
  type SubjectFilter,
} from "./student-analytics"
import { DEMO_STUDENT_ID, MockStudentAnalyticsProvider } from "./student-analytics.mock"

const provider = new MockStudentAnalyticsProvider()
const formatPercent = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return [hours ? `${hours} ч` : "", minutes || !hours ? `${minutes} мин` : ""]
    .filter(Boolean)
    .join(" ")
}
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(new Date(value))
const formatLongDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(value),
  )
const escapeHtml = (value: unknown) =>
  String(value).replace(
    /[&<>'"]/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!,
  )

type DashboardState = { subject: SubjectFilter; range: DateRange }

function lineChart(points: Array<{ label: string; value: number }>, label: string, suffix = "") {
  if (points.length < 2)
    return `<div class="analytics-chart-empty">Недостаточно точек для графика.</div>`
  const width = 680
  const height = 220
  const pad = 28
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1, max - min)
  const titleId = `analytics-chart-${label.toLocaleLowerCase("ru").replace(/[^a-zа-яё0-9]+/giu, "-")}`
  const coords = points.map((point, index) => ({
    ...point,
    x: pad + (index / (points.length - 1)) * (width - pad * 2),
    y: height - pad - ((point.value - min) / span) * (height - pad * 2),
  }))
  const path = coords
    .map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ")
  return `<figure class="analytics-chart" aria-label="${escapeHtml(label)}">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId}">
      <title id="${titleId}">${escapeHtml(label)}: ${points.map((point) => `${point.label} — ${point.value}${suffix}`).join(", ")}</title>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="chart-axis" />
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}" class="chart-axis" />
      <path d="${path}" class="chart-line" pathLength="1" />
      ${coords.map((point) => `<g><circle cx="${point.x}" cy="${point.y}" r="4" class="chart-point"><title>${escapeHtml(point.label)}: ${point.value}${suffix}</title></circle></g>`).join("")}
      <text x="${pad}" y="${height - 7}" class="chart-label">${escapeHtml(points[0].label)}</text>
      <text x="${width - pad}" y="${height - 7}" text-anchor="end" class="chart-label">${escapeHtml(points.at(-1)!.label)}</text>
      <text x="${pad + 5}" y="${pad + 2}" class="chart-label">${max}${suffix}</text>
      <text x="${pad + 5}" y="${height - pad - 7}" class="chart-label">${min}${suffix}</text>
    </svg>
    <figcaption>${escapeHtml(label)}. От ${points[0].value}${suffix} до ${points.at(-1)!.value}${suffix}; минимум ${min}${suffix}, максимум ${max}${suffix}.</figcaption>
  </figure>`
}

function activityCalendar(snapshot: AnalyticsSnapshot, state: DashboardState, now: Date) {
  const values = filterSnapshot(snapshot, state.subject, "90d", now)
  const byDay = new Map(
    summarizeDailyActivity(values.sessions, values.attempts, values.topics, values.tasks).map(
      (day) => [day.date, day],
    ),
  )
  const days = Array.from({ length: 63 }, (_, index) => {
    const date = new Date(now)
    date.setDate(date.getDate() - (62 - index))
    const key = date.toISOString().slice(0, 10)
    const summary = byDay.get(key)
    if (!summary)
      return `<span class="activity-day" data-level="0" title="${formatLongDate(key)}: активности нет"></span>`
    const minutes = Math.round((summary.durationSeconds ?? 0) / 60)
    const level = summary.durationSeconds === null || minutes < 30 ? 1 : minutes < 55 ? 2 : 3
    const tooltipId = `activity-${key}`
    const topicText = summary.topics.join(", ") || "темы не зафиксированы"
    const taskText = summary.tasks.length
      ? summary.tasks
          .map(
            (task) =>
              `<li><span>${escapeHtml(task.title)}</span><strong>${task.durationSeconds === null ? "время не зафиксировано" : formatDuration(task.durationSeconds)}</strong></li>`,
          )
          .join("")
      : `<li class="activity-tooltip-empty">Задания не открывались</li>`
    const siteTime =
      summary.durationSeconds === null
        ? "время не зафиксировано"
        : formatDuration(summary.durationSeconds)
    const accessibleSummary = `${formatLongDate(key)}. На сайте: ${siteTime}. Темы: ${topicText}.`
    return `<button type="button" class="activity-day" data-level="${level}" data-column="${Math.floor(index / 7)}" aria-describedby="${tooltipId}" aria-label="${escapeHtml(accessibleSummary)}">
      <span class="activity-tooltip" id="${tooltipId}" role="tooltip"><strong>${formatLongDate(key)}</strong><span>На сайте: ${siteTime}</span><span>Темы: ${escapeHtml(topicText)}</span><ul>${taskText}</ul></span>
    </button>`
  }).join("")
  return `<div class="activity-calendar" aria-label="Регулярность занятий за 9 недель">${days}</div>`
}

function controls(state: DashboardState) {
  const subjects: Array<[SubjectFilter, string]> = [
    ["all", "Все"],
    ...(Object.entries(SUBJECT_LABELS) as Array<[SubjectFilter, string]>),
  ]
  const ranges: Array<[DateRange, string]> = [
    ["7d", "7 дней"],
    ["30d", "30 дней"],
    ["90d", "90 дней"],
    ["all", "Всё время"],
  ]
  const group = (filter: string, label: string, values: Array<[string, string]>, current: string) =>
    `<div class="analytics-filter" aria-label="${label}">${values.map(([value, title]) => `<button type="button" data-filter="${filter}" data-value="${value}" aria-pressed="${value === current}">${title}</button>`).join("")}</div>`
  return `<div class="analytics-controls">${group("subject", "Предмет", subjects, state.subject)}${group("range", "Период", ranges, state.range)}</div>`
}

function renderReady(
  root: HTMLElement,
  snapshot: AnalyticsSnapshot,
  state: DashboardState,
  now: Date,
) {
  const filtered = filterSnapshot(snapshot, state.subject, state.range, now)
  const validAttempts = filtered.attempts.filter(
    (attempt) => attempt.completedAt && attempt.maxScore > 0,
  )
  const completion = calculateCompletion(
    filtered.topics.map((topic) => topic.id),
    filtered.topicProgress
      .filter((progress) => progress.attempts > 0)
      .map((progress) => progress.topicId),
  )
  const studySeconds = filtered.sessions.reduce(
    (sum, session) => sum + (session.activeDurationSeconds ?? 0),
    0,
  )
  const topicById = new Map(snapshot.topics.map((topic) => [topic.id, topic]))
  const taskById = new Map(snapshot.tasks.map((task) => [task.id, task]))
  const exams = filtered.exams.map((exam) => ({
    label: formatDate(exam.date),
    value: exam.finalScore ?? exam.primaryScore ?? exam.rawScore ?? 0,
  }))
  const weekly = aggregateAttemptsByWeek(filtered.attempts).map((week) => ({
    label: formatDate(week.weekStart),
    value: Math.round((week.accuracy ?? 0) * 100),
  }))
  const classified = filtered.topicProgress.map((progress) => ({
    progress,
    kind: classifyTopic(progress),
    topic: topicById.get(progress.topicId)!,
  }))
  const strong = classified.filter((item) => item.kind === "strong")
  const weak = classified.filter((item) => item.kind === "weak")
  const mistakes = validAttempts
    .filter((attempt) => attempt.score / attempt.maxScore < 0.6)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
    .slice(0, 5)
  const latest =
    filtered.activity.map((event) => event.timestamp).sort((a, b) => b.localeCompare(a))[0] ??
    snapshot.profile.createdAt

  const subjectProgress = Object.entries(SUBJECT_LABELS)
    .map(([subject, label]) => {
      const items = filtered.topicProgress.filter(
        (progress) => topicById.get(progress.topicId)?.subject === subject,
      )
      if (!items.length) return ""
      const average = items.reduce((sum, progress) => sum + progress.mastery, 0) / items.length
      return `<details class="subject-progress" open><summary><span>${label}</span><strong>${formatPercent(average)}</strong></summary>
      <div class="topic-progress-list">${items
        .map((progress) => {
          const topic = topicById.get(progress.topicId)!
          return `<div class="topic-progress"><div><span>${escapeHtml(topic.title)}</span><small>${progress.status.replace("needs_attention", "требует внимания").replace("not_started", "не начато").replace("learning", "изучается").replace("practicing", "практика").replace("stable", "закреплено")}</small></div><div class="progress-track" role="progressbar" aria-label="${escapeHtml(topic.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress.mastery * 100)}"><span style="--progress:${Math.round(progress.mastery * 100)}%"></span></div><strong>${formatPercent(progress.mastery)}</strong></div>`
        })
        .join("")}</div></details>`
    })
    .join("")

  const hasData =
    filtered.topics.length > 0 && (validAttempts.length > 0 || filtered.sessions.length > 0)
  root.innerHTML = `<div class="analytics-shell">
    <header class="analytics-header">
      <div><h1>Статистика ${escapeHtml(snapshot.profile.displayName)}</h1><p>${escapeHtml(snapshot.profile.targetExam ?? "Персональный учебный маршрут")}</p></div>
      <span class="demo-badge">ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ</span>
    </header>
    ${controls(state)}
    ${
      hasData
        ? `<main>
      <section class="analytics-overview" aria-labelledby="overview-title"><div><h2 id="overview-title">Сейчас</h2><p>Последняя активность — ${formatDate(latest)}. Данные показывают учебный ритм, а не оценивают человека.</p></div><dl class="analytics-readout"><div><dt>Пройдено тем</dt><dd>${formatPercent(completion)}</dd></div><div><dt>Точность</dt><dd>${formatPercent(calculateAccuracy(filtered.attempts))}</dd></div><div><dt>Решено</dt><dd>${validAttempts.length}</dd></div><div><dt>В занятиях</dt><dd>${formatDuration(studySeconds)}</dd></div></dl></section>
      <section><div class="section-heading"><h2>Карта программы</h2><p>Оценка освоенности прозрачна: покрытие 35%, недавняя точность 45%, объём практики 20%.</p></div>${subjectProgress}</section>
      <section><div class="section-heading"><h2>Динамика результата</h2><p>Баллы пробников и недельная точность разделены: у них разные единицы.</p></div><div class="chart-pair">${lineChart(exams, "Результаты пробников", " баллов")}${lineChart(weekly, "Недельная точность", "%")}</div></section>
      <section class="topic-signals"><div><h2>Сильные темы</h2>${strong.length ? `<ul>${strong.map(({ topic, progress }) => `<li><span>${escapeHtml(topic.title)}</span><strong>${formatPercent(progress.mastery)}</strong></li>`).join("")}</ul>` : `<p class="quiet-state">Нужно ещё несколько завершённых попыток.</p>`}</div><div><h2>Требуют внимания</h2>${weak.length ? `<ul>${weak.map(({ topic, progress }) => `<li><span>${escapeHtml(topic.title)}</span><strong>${progress.recentMistakes} ошибок</strong></li>`).join("")}</ul>` : `<p class="quiet-state">Сигналов для классификации пока нет.</p>`}</div></section>
      <section><div class="section-heading"><h2>Ритм занятий</h2><p>Наведите указатель или перейдите с клавиатуры на цветной день, чтобы увидеть темы и время.</p></div>${activityCalendar(snapshot, state, now)}</section>
      <section><div class="section-heading"><h2>Последние ошибки</h2><p>Конкретные места, к которым можно вернуться.</p></div>${
        mistakes.length
          ? `<div class="mistake-list">${mistakes
              .map((attempt) => {
                const task = taskById.get(attempt.taskId)
                const topic = topicById.get(attempt.topicId)
                return `<a href="${escapeHtml(task?.href ?? "#")}" class="mistake-row"><span><strong>${escapeHtml(task?.title ?? attempt.taskId)}</strong><small>${escapeHtml(topic?.title ?? attempt.topicId)} · попытка ${attempt.attemptNumber}</small></span><span>${attempt.score}/${attempt.maxScore}<small>${formatDate(attempt.completedAt!)}</small></span></a>`
              })
              .join("")}</div>`
          : `<p class="quiet-state">В выбранном диапазоне ошибок нет.</p>`
      }</section>
      <section><div class="section-heading"><h2>Что дальше</h2><p>Простые рекомендации по заданным правилам — без искусственного интеллекта и скрытой оценки.</p></div><ol class="recommendation-list">${snapshot.recommendations
        .slice(0, 4)
        .map(
          (item) =>
            `<li><a href="${escapeHtml(item.href ?? "#")}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.detail)}</span></a></li>`,
        )
        .join("")}</ol></section>
    </main>`
        : `<div class="analytics-empty"><h2>Здесь появится динамика после первых занятий.</h2><p>Для выбранных фильтров пока нет завершённых попыток или учебных сессий.</p></div>`
    }
  </div>`
}

async function initializeStudentAnalytics() {
  const root = document.querySelector<HTMLElement>("#student-analytics-root")
  if (!root || root.dataset.ready === "true") return
  root.dataset.ready = "true"
  root.innerHTML = `<div class="analytics-loading" role="status"><span></span><p>Собираем учебную картину…</p></div>`
  try {
    const snapshot = await loadAnalyticsSnapshot(provider, DEMO_STUDENT_ID)
    if (!snapshot) throw new Error("Демонстрационные данные ученика недоступны")
    const state: DashboardState = { subject: "all", range: "30d" }
    const render = () => renderReady(root, snapshot, state, new Date())
    root.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button[data-filter]")
      if (!button) return
      if (button.dataset.filter === "subject") state.subject = button.dataset.value as SubjectFilter
      if (button.dataset.filter === "range") state.range = button.dataset.value as DateRange
      render()
    })
    render()
  } catch {
    root.innerHTML = `<div class="analytics-error" role="alert"><h2>Статистика сейчас недоступна.</h2><p>Обновите страницу. Если ошибка повторится, вернитесь позже.</p><button type="button" onclick="location.reload()">Повторить</button></div>`
  }
}

document.addEventListener("nav", initializeStudentAnalytics)
