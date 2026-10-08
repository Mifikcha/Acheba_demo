import { getAudioTracks } from "../study-player.tracks"
import {
  AudioPlayerController,
  clamp,
  formatAudioTime,
  type StudyPlayerState,
} from "./study-player-controller"
import { hidePlayerPopover, isPlayerPopoverOpen, showPlayerPopover } from "./study-player-popover"

type PlayerBinding = { cleanup: () => void }

let controller: AudioPlayerController | undefined
let binding: PlayerBinding | undefined

const queryAll = <T extends Element>(root: ParentNode, selector: string): T[] =>
  Array.from(root.querySelectorAll<T>(selector))

function setRangeFill(input: HTMLInputElement, value: number): void {
  input.style.setProperty("--range-fill", `${clamp(value, 0, 1) * 100}%`)
}

function bindPlayer(root: HTMLElement, player: AudioPlayerController): PlayerBinding {
  const abort = new AbortController()
  const { signal } = abort
  const popover = root.querySelector<HTMLElement>("[data-player-popover]")!
  const expandButton = root.querySelector<HTMLButtonElement>("[data-player-action='expand']")!
  const seek = root.querySelector<HTMLInputElement>("[data-player-seek]")!
  const volume = root.querySelector<HTMLInputElement>("[data-player-volume]")!
  let returnFocus: HTMLElement | null = null

  player.setExpanded(false)

  const positionPopover = () => {
    if (!isPlayerPopoverOpen(popover)) return
    const anchor = root.getBoundingClientRect()
    const margin = 16
    const gap = 12
    const width = Math.min(352, window.innerWidth - margin * 2)
    const height = Math.min(popover.offsetHeight, window.innerHeight - margin * 2)
    let left = anchor.left - width - gap
    if (left < margin) left = Math.min(anchor.right + gap, window.innerWidth - width - margin)
    const top = clamp(anchor.top, margin, Math.max(margin, window.innerHeight - height - margin))

    popover.style.width = `${width}px`
    popover.style.left = `${Math.max(margin, left)}px`
    popover.style.top = `${top}px`
  }

  const openPopover = () => {
    returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : expandButton
    showPlayerPopover(popover)
    player.setExpanded(true)
    requestAnimationFrame(() => {
      positionPopover()
      popover.querySelector<HTMLButtonElement>("[data-player-action='close']")?.focus()
    })
  }

  const closePopover = (restoreFocus = true) => {
    if (!isPlayerPopoverOpen(popover)) return
    const focusWasInside = popover.contains(document.activeElement)
    player.setExpanded(false)
    hidePlayerPopover(popover)
    if (restoreFocus && focusWasInside) (returnFocus ?? expandButton).focus()
  }

  const render = (state: StudyPlayerState) => {
    const track = player.currentTrack
    const duration = state.duration || track.duration || 0
    const progress = duration > 0 ? clamp(state.currentTime / duration, 0, 1) : 0
    const subtitle = state.error ?? track.artist ?? track.category ?? "Local audio"

    root.dataset.playing = String(state.isPlaying)
    root.dataset.error = String(Boolean(state.error))
    queryAll<HTMLElement>(root, "[data-player-title]").forEach((element) => {
      element.textContent = track.title
    })
    queryAll<HTMLElement>(root, "[data-player-subtitle]").forEach((element) => {
      element.textContent = subtitle
    })
    queryAll<HTMLButtonElement>(root, "[data-player-action='toggle']").forEach((button) => {
      button.ariaLabel = state.isPlaying ? "Pause" : "Play"
      button.setAttribute("aria-pressed", String(state.isPlaying))
    })

    const compactProgress = root.querySelector<HTMLElement>("[data-player-progress]")
    compactProgress?.style.setProperty("--player-progress", String(progress))
    compactProgress?.setAttribute("aria-valuenow", String(Math.round(progress * 100)))

    seek.max = String(duration || 1)
    seek.value = String(duration ? Math.min(state.currentTime, duration) : 0)
    seek.disabled = duration <= 0
    setRangeFill(seek, progress)

    volume.value = String(state.volume)
    setRangeFill(volume, state.volume)
    const volumeValue = root.querySelector<HTMLOutputElement>("[data-player-volume-value]")
    if (volumeValue) volumeValue.textContent = `${Math.round(state.volume * 100)}%`

    const elapsed = root.querySelector<HTMLElement>("[data-player-elapsed]")
    const total = root.querySelector<HTMLElement>("[data-player-duration]")
    if (elapsed) elapsed.textContent = formatAudioTime(state.currentTime)
    if (total) total.textContent = formatAudioTime(duration)

    const repeat = root.querySelector<HTMLButtonElement>("[data-player-action='repeat']")
    repeat?.setAttribute("aria-pressed", String(state.repeat === "one"))
    repeat?.classList.toggle("active", state.repeat === "one")

    expandButton.setAttribute("aria-expanded", String(state.expanded))
    queryAll<HTMLButtonElement>(root, "[data-player-track]").forEach((button) => {
      const active = button.dataset.playerTrack === state.currentTrackId
      button.toggleAttribute("aria-current", active)
      button.classList.toggle("active", active)
    })

    const status = root.querySelector<HTMLElement>("[data-player-status]")
    if (status) status.textContent = state.error ? "Track unavailable — choose another track." : ""
  }

  const unsubscribe = player.subscribe(render)

  root.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-player-action], [data-player-track]")
          : null
      if (!target) return

      const trackId = target.dataset.playerTrack
      if (trackId) {
        player.selectTrack(trackId)
        return
      }

      switch (target.dataset.playerAction) {
        case "toggle":
          void player.toggle()
          break
        case "previous":
          player.previous()
          break
        case "next":
          player.next()
          break
        case "expand":
          openPopover()
          break
        case "close":
          closePopover()
          break
        case "repeat":
          player.toggleRepeat()
          break
      }
    },
    { signal },
  )

  seek.addEventListener("input", () => player.seek(Number(seek.value)), { signal })
  volume.addEventListener("input", () => player.setVolume(Number(volume.value)), { signal })

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!isPlayerPopoverOpen(popover) || !(event.target instanceof Node)) return
      if (!popover.contains(event.target) && !expandButton.contains(event.target))
        closePopover(false)
    },
    { signal },
  )

  document.addEventListener(
    "keydown",
    (event) => {
      if (!isPlayerPopoverOpen(popover)) return
      if (event.key === "Escape") {
        event.preventDefault()
        closePopover()
        return
      }
      if (event.key !== "Tab") return

      const focusable = queryAll<HTMLElement>(
        popover,
        "button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    { signal },
  )

  window.addEventListener("resize", positionPopover, { signal })
  window.addEventListener("scroll", positionPopover, { signal, capture: true })

  return {
    cleanup: () => {
      closePopover(false)
      unsubscribe()
      abort.abort()
    },
  }
}

function initializeStudyPlayer(): void {
  binding?.cleanup()
  binding = undefined

  const root = document.querySelector<HTMLElement>("[data-study-player]")
  if (!root) {
    if (window.hopesSystem) delete window.hopesSystem.player
    return
  }
  controller ??= new AudioPlayerController(getAudioTracks())
  window.hopesSystem ??= {}
  window.hopesSystem.player = {
    snapshot: () => ({
      title: controller!.currentTrack.title,
      state: controller!.snapshot.isPlaying ? "playing" : "paused",
      volume: controller!.snapshot.volume,
      error: controller!.snapshot.error,
    }),
    play: () => controller!.play(),
    pause: () => controller!.pause(),
    previous: () => controller!.previous(),
    next: () => controller!.next(),
    setVolume: (value) => controller!.setVolume(value),
  }
  binding = bindPlayer(root, controller)
}

document.addEventListener("nav", initializeStudyPlayer)
