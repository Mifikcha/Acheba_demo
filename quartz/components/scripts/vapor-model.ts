export const surfaceY = 0.58

export type Molecule = { x: number; y: number; vx: number; vy: number; phase: "liquid" | "vapor" }
export type Exchange = { x: number; time: number; phase: "liquid" | "vapor" }
export type VaporModel = {
  particles: Molecule[]
  events: Exchange[]
  elapsed: number
  evaporated: number
  condensed: number
  random: () => number
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export function createVaporModel(): VaporModel {
  const random = seeded(817)
  const particles = Array.from({ length: 72 }, (_, i): Molecule => {
    const vapor = i < 4
    const angle = random() * Math.PI * 2
    const speed = 0.16 + random() * 0.1
    return {
      x: 0.05 + random() * 0.9,
      y: vapor ? 0.07 + random() * 0.43 : surfaceY + 0.04 + random() * 0.32,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      phase: vapor ? "vapor" : "liquid",
    }
  })
  return { particles, events: [], elapsed: 0, evaporated: 0, condensed: 0, random }
}

export function advanceVapor(model: VaporModel, seconds: number, temperature: number) {
  const dt = Math.max(0, Math.min(seconds, 0.05))
  if (!dt) return
  const t = Math.max(0.5, Math.min(temperature, 2))
  const motion = Math.sqrt(t)
  model.elapsed += dt
  for (const p of model.particles) {
    if (p.phase === "liquid") {
      p.x = Math.max(0.035, Math.min(0.965, p.x + (model.random() - 0.5) * 0.22 * Math.sqrt(dt) * motion))
      p.y = Math.max(surfaceY + 0.018, Math.min(0.965, p.y + (model.random() - 0.5) * 0.22 * Math.sqrt(dt) * motion))
      if (p.y < surfaceY + 0.11 && model.random() < 0.25 * t * t * dt) {
        p.phase = "vapor"
        p.y = surfaceY - 0.018
        p.vx = (model.random() - 0.5) * 0.25
        p.vy = -(0.18 + model.random() * 0.1)
        model.evaporated++
        model.events.push({ x: p.x, time: model.elapsed, phase: "vapor" })
      }
      continue
    }
    const turn = (model.random() - 0.5) * dt * 1.5
    const vx = p.vx * Math.cos(turn) - p.vy * Math.sin(turn)
    p.vy = p.vx * Math.sin(turn) + p.vy * Math.cos(turn)
    p.vx = vx
    p.x += p.vx * dt * motion
    p.y += p.vy * dt * motion
    if (p.x < 0.035 || p.x > 0.965) {
      p.x = Math.max(0.035, Math.min(0.965, p.x))
      p.vx *= -1
    }
    if (p.y < 0.045) {
      p.y = 0.045
      p.vy *= -1
    }
    if (p.y >= surfaceY - 0.018) {
      if (model.random() < 0.8) {
        p.phase = "liquid"
        p.y = surfaceY + 0.018
        model.condensed++
        model.events.push({ x: p.x, time: model.elapsed, phase: "liquid" })
      } else {
        p.y = surfaceY - 0.018
        p.vy = -Math.abs(p.vy)
      }
    }
  }
  model.events = model.events.filter((event) => model.elapsed - event.time < 8)
}
