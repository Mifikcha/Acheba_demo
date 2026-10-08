import fs from "fs"
import path from "path"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"

const CHEATSHEET_DIR = "_Шпаргалки"
const DEFAULT_TEXT = "Здесь скоро появится короткая шпора по этой заметке."
const SUBJECT_PREFIXES = ["Физика/", "Математика/", "Информатика/"]

function isCodingLesson(tags: unknown): boolean {
  return Array.isArray(tags) && tags.includes("coding_lesson")
}

function isMaterialNote({ fileData }: QuartzComponentProps): boolean {
  const filePath = String(fileData.filePath ?? "")
  const relativePath = String(fileData.relativePath ?? "").replaceAll("\\", "/")
  const slug = String(fileData.slug ?? "")
  const isHome = slug === "index" || relativePath === "index.md"

  if (!filePath.endsWith(".md")) return false
  if (isHome) return true
  if (slug.endsWith("/index")) return false
  if (!SUBJECT_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return false
  if (relativePath.includes("/Программы обучения/")) return false
  if (relativePath === "index.md" || relativePath.endsWith("/index.md")) return false
  if (relativePath.endsWith(".excalidraw.md")) return false
  if (isCodingLesson(fileData.frontmatter?.tags)) return false

  return true
}

function readCheatSheet({ ctx, fileData }: QuartzComponentProps): string {
  const contentRoot = path.resolve(ctx.argv.directory)
  const slug = String(fileData.slug ?? "")
  const relativePath = String(fileData.relativePath ?? "").replaceAll("\\", "/")
  const candidates = [
    path.join(contentRoot, CHEATSHEET_DIR, relativePath),
    path.join(contentRoot, CHEATSHEET_DIR, `${slug}.md`),
    path.join(contentRoot, CHEATSHEET_DIR, slug, "index.md"),
    path.join(contentRoot, CHEATSHEET_DIR, "default.md"),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return fs.readFileSync(candidate, "utf-8").trim()
  }

  return DEFAULT_TEXT
}

function NoteCheatSheet(props: QuartzComponentProps) {
  if (!isMaterialNote(props)) return null

  const text = readCheatSheet(props)

  return (
    <aside class="note-cheatsheet" aria-labelledby="note-cheatsheet-title">
      <h3 id="note-cheatsheet-title">Шпора</h3>
      <p>{text || DEFAULT_TEXT}</p>
    </aside>
  )
}

export default (() => NoteCheatSheet) satisfies QuartzComponentConstructor
