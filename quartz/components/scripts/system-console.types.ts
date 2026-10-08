export type CommandCategory = "SYSTEM" | "INTERFACE" | "STUDY" | "PROFILE" | "NAVIGATION" | "FUN"

export type ConsoleResult =
  | { type: "text"; title?: string; lines: string[] }
  | {
      type: "list"
      title?: string
      sections: Array<{
        title?: string
        items: Array<{ label: string; detail?: string; badge?: string; href?: string }>
      }>
    }
  | { type: "table"; title?: string; columns: string[]; rows: string[][] }
  | {
      type: "navigation"
      eyebrow: string
      title: string
      href: string
      detail?: string
    }
  | { type: "progress"; title?: string; rows: Array<{ label: string; value: number }> }
  | {
      type: "error"
      title: string
      detail?: string
      code?: "PROFILE_REQUIRED" | "QUERY_UNAVAILABLE" | "UNKNOWN_COMMAND" | "INVALID_USAGE"
    }
  | {
      type: "system"
      title: string
      rows: Array<{ label: string; value: string; state?: "ready" | "unavailable" | "neutral" }>
      action?: "clear"
    }

export type ContentMaterial = {
  slug: string
  title: string
  tags: string[]
  filePath?: string
}

export type StudentUser = { id: string; displayName: string }
export type ProfileDataResult<T> =
  { available: true; data: T } | { available: false; reason: "profile-required" }

export interface StudentProfileProvider {
  readonly mode: "guest" | "student"
  getCurrentUser(): Promise<StudentUser | null>
  getProgress(): Promise<ProfileDataResult<unknown>>
  getTopicStats(): Promise<ProfileDataResult<unknown>>
  getRecentMistakes(): Promise<ProfileDataResult<unknown>>
  getAchievements(): Promise<ProfileDataResult<unknown>>
  getInventory(): Promise<ProfileDataResult<unknown>>
  getStudyHistory(): Promise<ProfileDataResult<unknown>>
}

export type UnlockRequirement =
  | { type: "complete_lessons"; count: number }
  | { type: "solve_problems"; count: number }
  | { type: "achievement"; id: string }
  | { type: "streak"; days: number }
  | { type: "manual" }
  | { type: "secret"; id: string }

export type Unlockable = {
  id: string
  type: "theme" | "player_skin" | "hero_style" | "console_style" | "interface_feature"
  title: string
  description?: string
  unlocked: boolean
  requirement?: UnlockRequirement
}

export type PlayerSnapshot = {
  title: string
  state: "playing" | "paused"
  volume: number
  error?: string | null
}

export interface ConsolePlayerAdapter {
  snapshot(): PlayerSnapshot
  play(): Promise<void>
  pause(): void
  previous(): void
  next(): void
  setVolume(value: number): void
}

export interface FocusModeAdapter {
  snapshot(): "on" | "off"
  set(enabled: boolean): void
}

export interface SystemAdapter {
  currentTheme(): "dark" | "light"
  setTheme(theme: "dark" | "light"): boolean
  openGraph(): boolean
  openSearch(query?: string): boolean
  player(): ConsolePlayerAdapter | null
  focusMode(): FocusModeAdapter | null
  navigate(href: string): void
  prefersReducedMotion(): boolean
  currentMotion?(): "system" | "reduce"
  setMotion?(mode: "system" | "reduce"): void
}

export interface PreferencesStore {
  get<T>(key: "lastStudyPage" | "motion" | "consoleCollapsed"): T | null
  set<T>(key: "lastStudyPage" | "motion" | "consoleCollapsed", value: T): void
  remove(key: "lastStudyPage" | "motion" | "consoleCollapsed"): void
}

export interface ContentProvider {
  listMaterials(): Promise<ContentMaterial[]>
}

export interface StudentQueryEngine {
  execute(query: string, context: ConsoleContext): Promise<ConsoleResult>
}

export type ConsoleContext = {
  profile: StudentProfileProvider
  analytics?: {
    progress(): Promise<ConsoleResult>
    today(): Promise<ConsoleResult>
    weak(): Promise<ConsoleResult>
    strong(): Promise<ConsoleResult>
    mistakes(): Promise<ConsoleResult>
    stats(): Promise<ConsoleResult>
  }
  preferences: PreferencesStore
  content: ContentProvider
  systems: SystemAdapter
  queryEngine?: StudentQueryEngine
}

export type ConsoleCommand = {
  name: string
  aliases?: string[]
  description: string
  category: CommandCategory
  usage?: string
  subcommands?: string[]
  requiresProfile?: boolean
  hidden?: boolean
  execute(context: ConsoleContext, args: string[]): ConsoleResult | Promise<ConsoleResult>
}

export type ParsedCommand =
  { name: string; args: string[]; raw: string } | { error: string; raw: string }
