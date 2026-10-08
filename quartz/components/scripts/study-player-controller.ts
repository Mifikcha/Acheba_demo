import type { AudioTrack } from "../study-player.tracks"

export type RepeatMode = "off" | "one"

export type StudyPlayerState = {
  currentTrackId: string
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  repeat: RepeatMode
  expanded: boolean
  error: string | null
}

type PersistedState = Pick<StudyPlayerState, "currentTrackId" | "currentTime" | "volume" | "repeat">

const STORAGE_KEY = "hopes-study-player-v1"

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--"
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)
    .toString()
    .padStart(2, "0")}:${(whole % 60).toString().padStart(2, "0")}`
}

export function resolveAudioSource(src: string, basePath = ""): string {
  if (!src.startsWith("/")) return src
  const prefix = basePath === "/" ? "" : basePath.replace(/\/$/, "")
  return `${prefix}${src}`
}

export class AudioPlayerController {
  private readonly listeners = new Set<(state: StudyPlayerState) => void>()
  private readonly gain: GainNode
  private readonly fetchAudio: typeof fetch
  private state: StudyPlayerState
  private source: AudioBufferSourceNode | null = null
  private nextSource: AudioBufferSourceNode | null = null
  private nextSourceStartedAt = 0
  private buffer: AudioBuffer | null = null
  private bufferTrackId: string | null = null
  private loadingBuffer: Promise<AudioBuffer> | null = null
  private loadingTrackId: string | null = null
  private loadAbort: AbortController | null = null
  private loadId = 0
  private playRequestId = 0
  private playbackStartedAt = 0
  private playbackOffset = 0
  private progressTimer: ReturnType<typeof setInterval> | null = null
  private lastPersistedSecond = -1

  constructor(
    private readonly tracks: AudioTrack[],
    private readonly context: AudioContext = new AudioContext(),
    fetchAudio: typeof fetch = fetch,
  ) {
    if (tracks.length === 0) throw new Error("Study player requires at least one track")
    this.fetchAudio = (...args) => fetchAudio(...args)

    const restored = this.restore()
    const currentTrack = tracks.find((track) => track.id === restored?.currentTrackId) ?? tracks[0]
    const duration = currentTrack.duration ?? 0
    const currentTime = clamp(
      Math.max(0, restored?.currentTime ?? 0),
      0,
      duration ? Math.max(0, duration - 0.001) : Number.MAX_SAFE_INTEGER,
    )

    this.state = {
      currentTrackId: currentTrack.id,
      isPlaying: false,
      currentTime,
      duration,
      volume: clamp(restored?.volume ?? 0.72, 0, 1),
      repeat: restored?.repeat === "one" ? "one" : "off",
      expanded: false,
      error: null,
    }
    this.gain = this.context.createGain()
    this.gain.gain.value = this.state.volume
    this.gain.connect(this.context.destination)
  }

  get tracksList(): readonly AudioTrack[] {
    return this.tracks
  }

  get snapshot(): StudyPlayerState {
    return { ...this.state }
  }

  get currentTrack(): AudioTrack {
    return this.tracks.find((track) => track.id === this.state.currentTrackId) ?? this.tracks[0]
  }

  subscribe(listener: (state: StudyPlayerState) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => this.listeners.delete(listener)
  }

  async toggle(): Promise<void> {
    if (this.state.isPlaying) this.pause()
    else await this.play()
  }

  async play(): Promise<void> {
    if (this.state.isPlaying) return
    const requestId = ++this.playRequestId
    const trackId = this.state.currentTrackId

    try {
      const resume = this.context.state === "running" ? Promise.resolve() : this.context.resume()
      const [buffer] = await Promise.all([this.loadCurrentTrack(), resume])
      if (requestId !== this.playRequestId || trackId !== this.state.currentTrackId) return
      this.startSource(buffer, this.state.currentTime)
    } catch {
      if (requestId === this.playRequestId && trackId === this.state.currentTrackId) {
        this.update({ isPlaying: false, error: "Track unavailable" })
      }
    }
  }

  pause(): void {
    ++this.playRequestId
    if (!this.state.isPlaying) return
    const currentTime = this.currentPlaybackTime()
    this.stopSource()
    this.stopProgress()
    this.update({ isPlaying: false, currentTime })
    this.persist()
  }

  previous(): void {
    if (this.currentPlaybackTime() > 3) {
      this.seek(0)
      return
    }
    this.selectByOffset(-1)
  }

  next(): void {
    this.selectByOffset(1)
  }

  selectTrack(id: string): void {
    if (!this.tracks.some((track) => track.id === id) || id === this.state.currentTrackId) return
    this.changeTrack(id, this.state.isPlaying)
  }

  seek(seconds: number): void {
    const duration = this.buffer?.duration ?? this.state.duration ?? this.currentTrack.duration ?? 0
    const target = clamp(seconds, 0, duration || 0)
    if (this.state.isPlaying && this.buffer) this.startSource(this.buffer, target)
    else this.update({ currentTime: target })
    this.persist()
  }

  setVolume(volume: number): void {
    const nextVolume = clamp(volume, 0, 1)
    this.gain.gain.value = nextVolume
    this.update({ volume: nextVolume })
    this.persist()
  }

  toggleRepeat(): void {
    const currentTime = this.currentPlaybackTime()
    const repeat = this.state.repeat === "one" ? "off" : "one"
    if (this.source && this.buffer) {
      this.playbackOffset = currentTime
      this.playbackStartedAt = this.context.currentTime
      if (repeat === "one") {
        this.scheduleNextSource(
          this.buffer,
          this.context.currentTime + this.buffer.duration - currentTime,
        )
      } else {
        this.stopNextSource()
      }
    }
    this.update({ repeat, currentTime })
    this.persist()
  }

  setExpanded(expanded: boolean): void {
    this.update({ expanded })
  }

  private startSource(buffer: AudioBuffer, offset: number): void {
    this.stopSource()
    this.stopProgress()

    const startOffset = this.normalizeOffset(offset, buffer.duration)
    const source = this.createSource(buffer)
    const startedAt = this.context.currentTime
    this.source = source
    this.playbackOffset = startOffset
    this.playbackStartedAt = startedAt
    source.start(startedAt, startOffset)
    if (this.state.repeat === "one") {
      this.scheduleNextSource(buffer, startedAt + buffer.duration - startOffset)
    }
    this.update({
      isPlaying: true,
      currentTime: startOffset,
      duration: buffer.duration,
      error: null,
    })
    this.startProgress()
  }

  private stopSource(): void {
    this.stopNextSource()
    if (!this.source) return
    const source = this.source
    this.source = null
    source.onended = null
    try {
      source.stop()
    } catch {}
    source.disconnect()
  }

  private createSource(buffer: AudioBuffer): AudioBufferSourceNode {
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.gain)
    source.onended = () => this.handleSourceEnded(source, buffer)
    return source
  }

  private scheduleNextSource(buffer: AudioBuffer, startedAt: number): void {
    this.stopNextSource()
    const source = this.createSource(buffer)
    this.nextSource = source
    this.nextSourceStartedAt = startedAt
    source.start(startedAt)
  }

  private stopNextSource(): void {
    if (!this.nextSource) return
    const source = this.nextSource
    this.nextSource = null
    source.onended = null
    try {
      source.stop()
    } catch {}
    source.disconnect()
  }

  private handleSourceEnded(source: AudioBufferSourceNode, buffer: AudioBuffer): void {
    if (this.source !== source) return
    if (this.state.repeat === "one" && this.nextSource) {
      this.source = this.nextSource
      this.nextSource = null
      this.scheduleNextSource(buffer, this.nextSourceStartedAt + buffer.duration)
      return
    }

    this.source = null
    this.stopProgress()
    this.update({ isPlaying: false, currentTime: buffer.duration })
    this.persist()
    this.selectByOffset(1, true)
  }

  private currentPlaybackTime(): number {
    if (!this.state.isPlaying || !this.source || !this.buffer) return this.state.currentTime
    const elapsed = Math.max(0, this.context.currentTime - this.playbackStartedAt)
    const currentTime = this.playbackOffset + elapsed
    return this.state.repeat === "one"
      ? currentTime % this.buffer.duration
      : Math.min(currentTime, this.buffer.duration)
  }

  private normalizeOffset(offset: number, duration: number): number {
    if (duration <= 0) return 0
    if (this.state.repeat === "one") return ((offset % duration) + duration) % duration
    return clamp(offset, 0, Math.max(0, duration - 0.001))
  }

  private startProgress(): void {
    this.progressTimer = setInterval(() => {
      if (!this.state.isPlaying) return
      const currentTime = this.currentPlaybackTime()
      this.update({ currentTime })
      const second = Math.floor(currentTime)
      if (second !== this.lastPersistedSecond && second % 2 === 0) {
        this.lastPersistedSecond = second
        this.persist()
      }
    }, 250)
  }

  private stopProgress(): void {
    if (this.progressTimer === null) return
    clearInterval(this.progressTimer)
    this.progressTimer = null
  }

  private selectByOffset(offset: number, forcePlay = this.state.isPlaying): void {
    const index = this.tracks.findIndex((track) => track.id === this.state.currentTrackId)
    const nextIndex = (index + offset + this.tracks.length) % this.tracks.length
    this.changeTrack(this.tracks[nextIndex].id, forcePlay)
  }

  private changeTrack(id: string, shouldPlay: boolean): void {
    ++this.playRequestId
    this.stopSource()
    this.stopProgress()
    this.cancelLoad()
    this.buffer = null
    this.bufferTrackId = null
    const track = this.tracks.find((candidate) => candidate.id === id)!
    this.update({
      currentTrackId: id,
      currentTime: 0,
      duration: track.duration ?? 0,
      isPlaying: false,
      error: null,
    })
    this.persist()
    if (shouldPlay) void this.play()
  }

  private async loadCurrentTrack(): Promise<AudioBuffer> {
    const trackId = this.state.currentTrackId
    if (this.buffer && this.bufferTrackId === trackId) return this.buffer
    if (this.loadingBuffer && this.loadingTrackId === trackId) return this.loadingBuffer

    this.cancelLoad()
    const loadId = ++this.loadId
    const abort = new AbortController()
    const basePath = typeof document === "undefined" ? "" : (document.body?.dataset.basepath ?? "")
    const src = resolveAudioSource(this.currentTrack.src, basePath)
    this.loadAbort = abort
    this.loadingTrackId = trackId
    this.loadingBuffer = (async () => {
      const response = await this.fetchAudio(src, { signal: abort.signal })
      if (!response.ok) throw new Error(`Audio request failed: ${response.status}`)
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer())
      if (loadId === this.loadId && trackId === this.state.currentTrackId) {
        this.buffer = buffer
        this.bufferTrackId = trackId
        const currentTime = this.normalizeOffset(this.state.currentTime, buffer.duration)
        this.update({ duration: buffer.duration, currentTime, error: null })
      }
      return buffer
    })()

    try {
      return await this.loadingBuffer
    } finally {
      if (loadId === this.loadId) {
        this.loadingBuffer = null
        this.loadingTrackId = null
        this.loadAbort = null
      }
    }
  }

  private cancelLoad(): void {
    this.loadAbort?.abort()
    this.loadAbort = null
    this.loadingBuffer = null
    this.loadingTrackId = null
    ++this.loadId
  }

  private update(patch: Partial<StudyPlayerState>): void {
    this.state = { ...this.state, ...patch }
    const snapshot = this.snapshot
    this.listeners.forEach((listener) => listener(snapshot))
  }

  private restore(): PersistedState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as PersistedState) : null
    } catch {
      return null
    }
  }

  private persist(): void {
    try {
      const persisted: PersistedState = {
        currentTrackId: this.state.currentTrackId,
        currentTime: this.state.currentTime,
        volume: this.state.volume,
        repeat: this.state.repeat,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
    } catch {}
  }
}
