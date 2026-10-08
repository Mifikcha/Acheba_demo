import type {
  ConsolePlayerAdapter,
  ContentMaterial,
  FocusModeAdapter,
  PreferencesStore,
  ProfileDataResult,
  StudentProfileProvider,
  StudentUser,
  SystemAdapter,
} from "./system-console.types"

const unavailable = <T>(): ProfileDataResult<T> => ({
  available: false,
  reason: "profile-required",
})

export class GuestProfileProvider implements StudentProfileProvider {
  readonly mode = "guest" as const

  async getCurrentUser(): Promise<StudentUser | null> {
    return null
  }

  async getProgress() {
    return unavailable<unknown>()
  }

  async getTopicStats() {
    return unavailable<unknown>()
  }

  async getRecentMistakes() {
    return unavailable<unknown>()
  }

  async getAchievements() {
    return unavailable<unknown>()
  }

  async getInventory() {
    return unavailable<unknown>()
  }

  async getStudyHistory() {
    return unavailable<unknown>()
  }
}

type PreferenceKey = Parameters<PreferencesStore["get"]>[0]

export class BrowserPreferencesStore implements PreferencesStore {
  private readonly prefix = "hopes-shell:"

  get<T>(key: PreferenceKey): T | null {
    try {
      const value = localStorage.getItem(`${this.prefix}${key}`)
      return value === null ? null : (JSON.parse(value) as T)
    } catch {
      return null
    }
  }

  set<T>(key: PreferenceKey, value: T): void {
    try {
      localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(value))
    } catch {}
  }

  remove(key: PreferenceKey): void {
    try {
      localStorage.removeItem(`${this.prefix}${key}`)
    } catch {}
  }
}

export class SessionHistoryStore {
  private readonly key = "hopes-shell:history"

  read(): string[] {
    try {
      const value = JSON.parse(sessionStorage.getItem(this.key) ?? "[]")
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : []
    } catch {
      return []
    }
  }

  write(history: string[]): void {
    try {
      sessionStorage.setItem(this.key, JSON.stringify(history.slice(-30)))
    } catch {}
  }
}

type ContentIndexEntry = {
  slug?: string
  title?: string
  tags?: string[]
  filePath?: string
}

const basePath = () => (document.body?.dataset.basepath ?? "").replace(/\/$/, "")

export class QuartzContentProvider {
  private materials?: Promise<ContentMaterial[]>

  listMaterials(): Promise<ContentMaterial[]> {
    this.materials ??= fetch(`${basePath()}/static/contentIndex.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Content index unavailable: ${response.status}`)
        return response.json() as Promise<Record<string, ContentIndexEntry>>
      })
      .then((index) =>
        Object.entries(index)
          .map(([slug, entry]) => ({
            slug: entry.slug ?? slug,
            title: entry.title?.trim() ?? slug,
            tags: entry.tags ?? [],
            filePath: entry.filePath,
          }))
          .filter(isStudentMaterial),
      )
    return this.materials
  }
}

function isStudentMaterial(material: ContentMaterial): boolean {
  const slug = material.slug.toLowerCase()
  const path = material.filePath?.toLowerCase() ?? ""
  const tags = material.tags.map((tag) => tag.toLowerCase())
  return (
    slug !== "index" &&
    !slug.startsWith("tags/") &&
    !slug.startsWith("private/") &&
    !path.endsWith("/index.md") &&
    !path.endsWith("\\index.md") &&
    !tags.includes("private") &&
    !tags.includes("служебное")
  )
}

function setSearchValue(query: string): void {
  const input = document.querySelector<HTMLInputElement>(".search .search-bar")
  if (!input) return
  input.value = query
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.focus()
}

export class BrowserSystemAdapter implements SystemAdapter {
  currentTheme(): "dark" | "light" {
    return document.documentElement.getAttribute("saved-theme") === "light" ? "light" : "dark"
  }

  setTheme(theme: "dark" | "light"): boolean {
    if (this.currentTheme() === theme) return true
    const toggle = document.querySelector<HTMLButtonElement>(".hopes-theme-toggle")
    if (!toggle) return false
    toggle.click()
    return this.currentTheme() === theme
  }

  openGraph(): boolean {
    const button = document.querySelector<HTMLButtonElement>(
      ".home-knowledge-graph .global-graph-icon",
    )
    if (!button) return false
    button.click()
    return true
  }

  openSearch(query = ""): boolean {
    const button = document.querySelector<HTMLButtonElement>(".search-button")
    if (!button) return false
    button.click()
    requestAnimationFrame(() => setSearchValue(query))
    return true
  }

  player(): ConsolePlayerAdapter | null {
    return window.hopesSystem?.player ?? null
  }

  focusMode(): FocusModeAdapter | null {
    return window.hopesSystem?.focus ?? null
  }

  navigate(href: string): void {
    const url = new URL(href, window.location.href)
    if (typeof window.spaNavigate === "function") window.spaNavigate(url, false)
    else window.location.assign(url)
  }

  prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }

  currentMotion(): "system" | "reduce" {
    return document.documentElement.dataset.motion === "reduce" ? "reduce" : "system"
  }

  setMotion(mode: "system" | "reduce"): void {
    if (mode === "reduce") document.documentElement.dataset.motion = "reduce"
    else delete document.documentElement.dataset.motion
  }
}
