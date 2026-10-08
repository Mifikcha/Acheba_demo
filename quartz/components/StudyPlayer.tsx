import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { getAudioTracks } from "./study-player.tracks"
// @ts-ignore
import script from "./scripts/study-player.inline"
import style from "./styles/study-player.scss"

type IconProps = { class?: string }

const PreviousIcon = ({ class: className }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.5 5.5v13M18 6.75 9.5 12l8.5 5.25z" />
  </svg>
)

const NextIcon = ({ class: className }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17.5 5.5v13M6 6.75 14.5 12 6 17.25z" />
  </svg>
)

const PlayIcon = ({ class: className }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m8 5.75 10 6.25-10 6.25z" />
  </svg>
)

const PauseIcon = ({ class: className }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 6.5h3v11H8zM13 6.5h3v11h-3z" />
  </svg>
)

const ExpandIcon = ({ class: className }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
  </svg>
)

const CloseIcon = ({ class: className }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

const RepeatIcon = ({ class: className }: IconProps) => (
  <svg class={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="m17 3 3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3m13-2v2a3 3 0 0 1-3 3H4" />
    <path d="M12 9.5v5M10.5 11l1.5-1.5 1.5 1.5" />
  </svg>
)

function isCodingLesson(tags: unknown): boolean {
  return Array.isArray(tags) && tags.includes("coding_lesson")
}

function shouldRender({ fileData }: QuartzComponentProps): boolean {
  const filePath = String(fileData.filePath ?? "")
  if (!filePath.endsWith(".md") || filePath.endsWith(".excalidraw.md")) return false
  return !isCodingLesson(fileData.frontmatter?.tags)
}

function TransportControls({ expanded = false }: { expanded?: boolean }) {
  return (
    <div class={expanded ? "study-player-transport expanded" : "study-player-transport"}>
      <button
        type="button"
        class="study-player-control"
        data-player-action="previous"
        aria-label="Previous track"
      >
        <PreviousIcon />
      </button>
      <button type="button" class="study-player-play" data-player-action="toggle" aria-label="Play">
        <PlayIcon class="study-player-icon-play" />
        <PauseIcon class="study-player-icon-pause" />
      </button>
      <button
        type="button"
        class="study-player-control"
        data-player-action="next"
        aria-label="Next track"
      >
        <NextIcon />
      </button>
    </div>
  )
}

function StudyPlayer(props: QuartzComponentProps) {
  if (!shouldRender(props)) return null
  const tracks = getAudioTracks()
  if (tracks.length === 0) return null
  const firstTrack = tracks[0]

  return (
    <aside class="study-player" data-study-player>
      <div class="study-player-compact">
        <div class="study-player-heading">
          <div class="study-player-signal" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span class="study-player-label">STUDY PLAYER</span>
          <button
            type="button"
            class="study-player-expand"
            data-player-action="expand"
            aria-label="Expand player"
            aria-haspopup="dialog"
            aria-expanded="false"
          >
            <ExpandIcon />
          </button>
        </div>

        <div class="study-player-trackline">
          <strong data-player-title>{firstTrack.title}</strong>
          <span data-player-subtitle>{firstTrack.category}</span>
        </div>

        <div class="study-player-compact-row">
          <TransportControls />
          <div
            class="study-player-progress-compact"
            data-player-progress
            role="progressbar"
            aria-label="Track progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={0}
          >
            <span />
          </div>
        </div>
      </div>

      <section
        class="study-player-popover"
        data-player-popover
        popover="manual"
        role="dialog"
        aria-modal="false"
        aria-labelledby="study-player-dialog-title"
        hidden
      >
        <header class="study-player-popover-header">
          <div>
            <span class="study-player-label">STUDY PLAYER</span>
            <h2 id="study-player-dialog-title">Focus audio</h2>
          </div>
          <button
            type="button"
            class="study-player-close"
            data-player-action="close"
            aria-label="Close player"
          >
            <CloseIcon />
          </button>
        </header>

        <div class="study-player-now">
          <span>NOW PLAYING</span>
          <strong data-player-title>{firstTrack.title}</strong>
          <small data-player-subtitle>{firstTrack.category}</small>
        </div>

        <div class="study-player-main-controls">
          <TransportControls expanded />
          <button
            type="button"
            class="study-player-repeat"
            data-player-action="repeat"
            aria-label="Repeat track"
            aria-pressed="false"
          >
            <RepeatIcon />
            <span>Repeat</span>
          </button>
        </div>

        <div class="study-player-timeline">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value="0"
            data-player-seek
            aria-label="Seek"
            disabled
          />
          <div class="study-player-time">
            <span data-player-elapsed>00:00</span>
            <span data-player-duration>--:--</span>
          </div>
        </div>

        <div class="study-player-queue-wrap">
          <span class="study-player-section-label">QUEUE</span>
          <ol class="study-player-queue">
            {tracks.map((track, index) => (
              <li>
                <button
                  type="button"
                  data-player-track={track.id}
                  aria-label={`Select ${track.title}`}
                  aria-current={index === 0 ? "true" : undefined}
                >
                  <span class="study-player-queue-index">{String(index + 1).padStart(2, "0")}</span>
                  <span class="study-player-queue-copy">
                    <strong>{track.title}</strong>
                    <small>{track.category ?? track.artist ?? "Local audio"}</small>
                  </span>
                  <span class="study-player-queue-source">
                    {track.source === "user" ? "USER" : "LOCAL"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        <label class="study-player-volume">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="0.72"
            data-player-volume
            aria-label="Volume"
          />
          <output data-player-volume-value>72%</output>
        </label>

        <p class="study-player-status" data-player-status aria-live="polite" />
      </section>
    </aside>
  )
}

StudyPlayer.afterDOMLoaded = script
StudyPlayer.css = style

export default (() => StudyPlayer) satisfies QuartzComponentConstructor
