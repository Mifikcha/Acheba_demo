export type Kind = "brownian" | "diffusion"
export type Particle = { x: number; y: number; vx: number; vy: number; group: number }
export type Model = {
  kind: Kind
  particles: Particle[]
  tracer: Particle
  trail: { x: number; y: number }[]
  elapsed: number
  trailElapsed: number
  random: () => number
}

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

export function createModel(kind: Kind): Model {
  const random = seeded(kind === "brownian" ? 137 : 509)
  const particles = Array.from({ length: kind === "brownian" ? 54 : 72 }, (_, i) => {
    const angle = random() * Math.PI * 2
    const group = i % 2
    return {
      x: kind === "diffusion" ? (group ? 0.55 : 0.05) + random() * 0.4 : 0.04 + random() * 0.92,
      y: 0.05 + random() * 0.9,
      vx: Math.cos(angle) * 0.25,
      vy: Math.sin(angle) * 0.25,
      group,
    }
  })
  const tracer = { x: 0.5, y: 0.5, vx: 0, vy: 0, group: 2 }
  return {
    kind,
    particles,
    tracer,
    trail: [{ x: 0.5, y: 0.5 }],
    elapsed: 0,
    trailElapsed: 0,
    random,
  }
}

function reflect(p: Particle, margin: number) {
  if (p.x < margin || p.x > 1 - margin) {
    p.x = Math.max(margin, Math.min(1 - margin, p.x))
    p.vx *= -1
  }
  if (p.y < margin || p.y > 1 - margin) {
    p.y = Math.max(margin, Math.min(1 - margin, p.y))
    p.vy *= -1
  }
}

export function advanceModel(model: Model, dt: number, temperature: number) {
  const scale = Math.sqrt(temperature)
  model.elapsed += dt
  for (const p of model.particles) {
    // Schematic thermal scattering: the visible dots stand in for many molecules.
    const turn = (model.random() - 0.5) * dt * 2.8
    const vx = p.vx * Math.cos(turn) - p.vy * Math.sin(turn)
    p.vy = p.vx * Math.sin(turn) + p.vy * Math.cos(turn)
    p.vx = vx
    p.x += p.vx * dt * scale
    p.y += p.vy * dt * scale
    reflect(p, 0.014)
  }
  if (model.kind === "brownian") {
    const p = model.tracer
    p.vx = (p.vx + (model.random() - 0.5) * 0.9 * dt * scale) * Math.exp(-dt * 1.8)
    p.vy = (p.vy + (model.random() - 0.5) * 0.9 * dt * scale) * Math.exp(-dt * 1.8)
    p.x += p.vx * dt
    p.y += p.vy * dt
    reflect(p, 0.055)
    model.trailElapsed += dt
    if (model.trailElapsed >= 0.05) {
      model.trailElapsed %= 0.05
      model.trail.push({ x: p.x, y: p.y })
      if (model.trail.length > 140) model.trail.shift()
    }
  }
}
