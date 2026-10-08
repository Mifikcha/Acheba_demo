import test, { describe } from "node:test"
import assert from "node:assert/strict"
import type { AudioTrack } from "../study-player.tracks"
import {
  AudioPlayerController,
  formatAudioTime,
  resolveAudioSource,
} from "./study-player-controller"

class FakeSource {
  buffer: AudioBuffer | null = null
  loop = false
  loopStart = 0
  loopEnd = 0
  onended: (() => void) | null = null
  startedAt = 0
  startedOffset = 0

  connect() {}
  disconnect() {}
  stop() {}
  start(when = 0, offset = 0) {
    this.startedAt = when
    this.startedOffset = offset
  }
}

class FakeAudioContext {
  currentTime = 0
  state: AudioContextState = "running"
  destination = {}
  gain = { gain: { value: 1 }, connect() {} }
  sources: FakeSource[] = []
  decodeCount = 0

  createGain() {
    return this.gain
  }

  createBufferSource() {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }

  async decodeAudioData() {
    this.decodeCount += 1
    return { duration: 240 }
  }

  async resume() {
    this.state = "running"
  }
}

const tracks: AudioTrack[] = [
  { id: "one", title: "One", src: "/static/audio/one.opus", duration: 240, source: "builtin" },
  { id: "two", title: "Two", src: "/static/audio/two.opus", duration: 240, source: "builtin" },
]

function createPlayer(ok = true) {
  const context = new FakeAudioContext()
  const requests: string[] = []
  const fetchAudio = async function (this: unknown, input: RequestInfo | URL) {
    assert.equal(this, undefined)
    requests.push(String(input))
    return {
      ok,
      status: ok ? 200 : 404,
      arrayBuffer: async () => new ArrayBuffer(8),
    } as Response
  } as typeof fetch
  const player = new AudioPlayerController(tracks, context as unknown as AudioContext, fetchAudio)
  return { context, player, requests }
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe("study player helpers", () => {
  test("formats known and unknown durations", () => {
    assert.equal(formatAudioTime(134.9), "02:14")
    assert.equal(formatAudioTime(Number.NaN), "--:--")
  })

  test("resolves production base paths without changing external sources", () => {
    assert.equal(
      resolveAudioSource("/static/audio/rain.opus", "/Acheba"),
      "/Acheba/static/audio/rain.opus",
    )
    assert.equal(
      resolveAudioSource("https://example.com/rain.opus", "/Acheba"),
      "https://example.com/rain.opus",
    )
  })
})

describe("AudioPlayerController", () => {
  test("decodes the current track and keeps playing while moving through the queue", async () => {
    const { context, player, requests } = createPlayer()

    await player.play()
    player.next()
    await settle()

    assert.equal(player.snapshot.currentTrackId, "two")
    assert.equal(player.snapshot.isPlaying, true)
    assert.match(requests[0], /one\.opus$/)
    assert.match(requests[1], /two\.opus$/)
    assert.equal(context.decodeCount, 2)
    player.pause()
  })

  test("restarts the current buffer before selecting the previous track", async () => {
    const { context, player } = createPlayer()
    await player.play()
    context.currentTime = 8

    player.previous()

    assert.equal(player.snapshot.currentTrackId, "one")
    assert.equal(player.snapshot.currentTime, 0)
    assert.equal(context.sources.at(-1)?.startedOffset, 0)
    player.pause()
  })

  test("schedules the next buffer at the exact end of the current buffer", async () => {
    const { context, player } = createPlayer()
    await player.play()

    player.toggleRepeat()

    const [source, nextSource] = context.sources
    assert.equal(player.snapshot.repeat, "one")
    assert.equal(source.loop, false)
    assert.equal(nextSource.startedAt, source.startedAt + 240 - source.startedOffset)

    context.currentTime = 240
    source.onended?.()

    assert.equal(player.snapshot.isPlaying, true)
    assert.equal(player.snapshot.currentTrackId, "one")
    assert.equal(context.sources.at(-1)?.startedAt, 480)
    player.pause()
  })

  test("keeps a near-end seek playing through a scheduled repeat", async () => {
    const { context, player } = createPlayer()
    await player.play()
    player.toggleRepeat()

    player.seek(239)

    const source = context.sources.at(-2)!
    const nextSource = context.sources.at(-1)!
    assert.equal(source.startedOffset, 239)
    assert.equal(nextSource.startedAt, 1)

    context.currentTime = 1
    source.onended?.()

    assert.equal(player.snapshot.isPlaying, true)
    assert.equal(context.sources.at(-1)?.startedAt, 241)
    player.pause()
  })

  test("reuses the decoded buffer after pause", async () => {
    const { context, player } = createPlayer()
    await player.play()
    player.pause()

    await player.play()

    assert.equal(context.decodeCount, 1)
    player.pause()
  })

  test("advances to the next buffer after a non-looping source ends", async () => {
    const { context, player } = createPlayer()
    await player.play()

    context.sources.at(-1)?.onended?.()
    await settle()

    assert.equal(player.snapshot.currentTrackId, "two")
    assert.equal(player.snapshot.isPlaying, true)
    player.pause()
  })

  test("preserves the existing unavailable-track error", async () => {
    const { player } = createPlayer(false)

    await player.play()

    assert.equal(player.snapshot.isPlaying, false)
    assert.equal(player.snapshot.error, "Track unavailable")
  })
})
