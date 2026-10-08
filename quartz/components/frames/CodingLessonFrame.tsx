import { FullSlug, resolveRelative } from "../../util/path"
import { PageFrame, PageFrameProps } from "./types"

const hasCodingLessonTag = (file: PageFrameProps["componentData"]["fileData"]) =>
  file.frontmatter?.tags?.includes("coding_lesson") ?? false

const ArrowLeft = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="m15 18-6-6 6-6" />
  </svg>
)

const ArrowRight = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24">
    <path d="m9 18 6-6-6-6" />
  </svg>
)

const ThemeToggle = () => <button class="hopes-theme-toggle coding-theme-toggle" type="button" />

const homeHref = (baseUrl?: string) => {
  if (!baseUrl) return "/"
  return new URL(`https://${baseUrl}`).pathname.replace(/\/?$/, "/")
}

export const CodingLessonFrame: PageFrame = {
  name: "coding-lesson",
  render({ componentData, pageBody: Content }: PageFrameProps) {
    const { fileData, allFiles } = componentData
    const slug = fileData.slug!
    const parentSlug = slug.slice(0, slug.lastIndexOf("/")) as FullSlug
    const siteHomeHref = homeHref(componentData.cfg.baseUrl)
    const frontmatter = fileData.frontmatter as Record<string, unknown> | undefined
    const codingScope = String(frontmatter?.coding_scope ?? "")
    const scopeSlug = (codingScope || parentSlug) as FullSlug
    const useRecursiveScope = codingScope.length > 0
    const lessons = allFiles
      .filter(
        (file) =>
          file.slug?.startsWith(`${scopeSlug}/`) &&
          (useRecursiveScope || file.slug.slice(scopeSlug.length + 1).indexOf("/") === -1) &&
          hasCodingLessonTag(file),
      )
      .sort(
        (a, b) =>
          Number(a.frontmatter?.coding_order ?? 0) - Number(b.frontmatter?.coding_order ?? 0),
      )
    const lessonIndex = lessons.findIndex((lesson) => lesson.slug === slug)
    const previous = lessonIndex > 0 ? lessons[lessonIndex - 1] : undefined
    const next = lessonIndex >= 0 ? lessons[lessonIndex + 1] : undefined
    const title = String(frontmatter?.title ?? slug.slice(slug.lastIndexOf("/") + 1))
    const starterCode = String(frontmatter?.starter_code ?? "")
    const tests = String(frontmatter?.tests ?? "")
    const task = String(frontmatter?.coding_task ?? "")
    const practiceTasks = Array.isArray(frontmatter?.practice_tasks)
      ? frontmatter.practice_tasks
          .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
          .map((entry, index) => ({
            id: String(entry.id ?? `p${index + 1}`),
            title: String(entry.title ?? ""),
            prompt: String(entry.prompt ?? ""),
            starterCode: String(entry.starter_code ?? ""),
            tests: String(entry.tests ?? ""),
            hint: String(entry.hint ?? ""),
          }))
      : []
    const tasks = [
      ...practiceTasks,
      { id: "final", title: "Итог", prompt: task, starterCode, tests },
    ]
    const hideWorkbenchTask = codingScope === "информатика/истинный-фундамент/звезды"
    const lessonCode = `PY / ${title.match(/^\d+(?:\.\d+)?/)?.[0] ?? String(lessonIndex + 1).padStart(2, "0")}`

    return (
      <main class="center coding-lesson-shell">
        <header class="coding-lesson-bar">
          <a class="coding-course-exit" href={siteHomeHref}>
            <ArrowLeft />
            <span>К курсу</span>
          </a>
          <strong>{title}</strong>
          <div class="coding-lesson-meta">
            <span class="coding-lesson-progress">
              {lessonIndex + 1} / {lessons.length}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <div class="coding-lesson-split">
          <section class="coding-lesson-reading">
            <Content {...componentData} />
            <nav class="coding-lesson-nav" aria-label="Навигация по урокам">
              {previous ? (
                <a href={resolveRelative(slug, previous.slug!)} rel="prev">
                  <ArrowLeft />
                  <span>
                    <small>Назад</small>
                    {previous.frontmatter?.title}
                  </span>
                </a>
              ) : (
                <span />
              )}
              {next ? (
                <a
                  href={resolveRelative(slug, next.slug!)}
                  rel="next"
                  data-coding-next={practiceTasks.length ? "" : undefined}
                >
                  <span>
                    <small>Дальше</small>
                    {next.frontmatter?.title}
                  </span>
                  <ArrowRight />
                </a>
              ) : (
                <a href={siteHomeHref} data-coding-next={practiceTasks.length ? "" : undefined}>
                  <span>
                    <small>Готово</small>К курсу
                  </span>
                  <ArrowRight />
                </a>
              )}
            </nav>
          </section>

          <div
            class="coding-splitter"
            role="separator"
            aria-label="Изменить ширину текста и редактора"
            aria-orientation="vertical"
            aria-valuemin={32}
            aria-valuemax={68}
            aria-valuenow={50}
            tabIndex={0}
          >
            <span aria-hidden="true" />
          </div>

          <aside
            class="python-checker coding-workbench"
            data-layout="lesson"
            data-title={lessonCode}
            data-code={starterCode}
            data-tests={tests}
            data-hidden-tests={hideWorkbenchTask ? "true" : "false"}
            data-task={hideWorkbenchTask ? "" : task}
            data-lesson={slug}
            data-tasks={practiceTasks.length ? JSON.stringify(tasks) : undefined}
          />
        </div>
      </main>
    )
  },
}
