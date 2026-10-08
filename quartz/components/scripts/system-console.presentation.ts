import type { StudentProfileProvider, StudentUser } from "./system-console.types"

type ConsoleSurfaceInteraction = {
  button: number
  pointerType: string
  hasSelection: boolean
  clickedInteractive: boolean
  clickedScrollbar: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

export function formatExamCountdown(now: Date): string {
  let exam = new Date(now.getFullYear(), 5, 1)
  if (exam.getTime() <= now.getTime()) exam = new Date(now.getFullYear() + 1, 5, 1)

  let rest = exam.getTime() - now.getTime()
  const days = Math.floor(rest / DAY_MS)
  rest -= days * DAY_MS
  const hours = Math.floor(rest / 3_600_000)
  rest -= hours * 3_600_000
  const minutes = Math.floor(rest / 60_000)
  const seconds = Math.floor((rest - minutes * 60_000) / 1000)

  return [days, hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":")
}

export function shouldFocusPromptFromSurface({
  button,
  pointerType,
  hasSelection,
  clickedInteractive,
  clickedScrollbar,
}: ConsoleSurfaceInteraction): boolean {
  return (
    button === 0 &&
    pointerType !== "touch" &&
    !hasSelection &&
    !clickedInteractive &&
    !clickedScrollbar
  )
}

export function createShellIdentity(
  mode: StudentProfileProvider["mode"],
  user: StudentUser | null,
): { user: string; prompt: string; profile: "connected" | "none" } {
  const shellUser = user?.id.trim() || mode
  return {
    user: shellUser,
    prompt: `hnd:\\${shellUser}>`,
    profile: user ? "connected" : "none",
  }
}
