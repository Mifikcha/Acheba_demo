export type AudioTrackSource = "builtin" | "user"

export type AudioTrack = {
  id: string
  title: string
  artist?: string
  src: string
  duration?: number
  category?: string
  source: AudioTrackSource
}

const builtinTracks: AudioTrack[] = [
  {
    id: "rain-2",
    title: "Rain-2",
    category: "Ambient sound",
    src: "/static/audio/Rain-2.opus",
    duration: 467.154271,
    source: "builtin",
  },
  {
    id: "cyberpunk",
    title: "Cyberpunk",
    category: "Study ambience",
    src: "/static/audio/Cyberpunk.opus",
    duration: 476.3755,
    source: "builtin",
  },
  {
    id: "quite-stars",
    title: "Quite-Stars",
    category: "Study ambience",
    src: "/static/audio/Quite-Stars.opus",
    duration: 537.293042,
    source: "builtin",
  },
]

export function getBuiltinTracks(): AudioTrack[] {
  return builtinTracks.map((track) => ({ ...track }))
}

// Future API/auth/storage integration can return user tracks through this seam.
export function getUserTracks(): AudioTrack[] {
  return []
}

export function getAudioTracks(): AudioTrack[] {
  return [...getBuiltinTracks(), ...getUserTracks()]
}
