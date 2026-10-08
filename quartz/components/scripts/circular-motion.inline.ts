import {
  advanceAngle,
  angularVelocity,
  circleVectors,
  rotationDirection,
  type Parameters,
  type Vector,
} from "./circular-motion-model"

const active = new Set<() => void>()

function mount(root: HTMLElement) {
  const params: Parameters = { radius: 2.8, omega: 1.2, tangential: 1 }
  let direction: 1 | -1 = 1
  let angle = 0
  let playing = false
  let visible = true
  let frame = 0
  let last = 0
  const canvas = document.createElement("canvas")
  canvas.setAttribute("role", "img")
  canvas.setAttribute(
    "aria-label",
    "Движение тела по окружности: скорость по касательной, нормальное ускорение к центру, тангенциальное и полное ускорения. Направление задаётся знаком тангенциального параметра.",
  )
  const context = canvas.getContext("2d")
  if (!context) return
  const stage = document.createElement("div")
  stage.className = "mkt-stage"
  stage.append(canvas)
  const legend = document.createElement("div")
  legend.className = "circle-legend"
  for (const [name, color] of [
    ["v — скорость", "#7dcfff"],
    ["aₙ — нормальное", "#bb9af7"],
    ["aτ — тангенциальное", "#e0af68"],
    ["a — полное", "#f7768e"],
  ]) {
    const item = document.createElement("span")
    item.style.setProperty("--circle-color", color)
    item.textContent = name
    legend.append(item)
  }
  const controls = document.createElement("div")
  controls.className = "mkt-controls circle-controls"
  const actions = document.createElement("div")
  actions.className = "circle-actions"
  const play = document.createElement("button")
  const reset = document.createElement("button")
  const step = document.createElement("button")
  for (const button of [play, reset, step]) button.type = "button"
  reset.textContent = "Сбросить"
  step.textContent = "Шаг"
  actions.append(play, reset, step)
  const sliders = document.createElement("div")
  sliders.className = "circle-sliders"
  const readout = document.createElement("p")
  readout.className = "circle-readout"
  readout.setAttribute("aria-live", "polite")
  const currentOmega = () => angularVelocity(params.radius, params.omega, direction)
  function updateReadout() {
    const omega = currentOmega()
    const speed = Math.abs(omega * params.radius)
    readout.textContent = `v = ${speed.toFixed(1).replace(".", ",")} м/с · aₙ = ${(speed ** 2 / params.radius).toFixed(1).replace(".", ",")} м/с² · ${direction > 0 ? "против часовой стрелки" : "по часовой стрелке"}`
  }
  const addSlider = (
    text: string,
    key: keyof Parameters,
    min: number,
    max: number,
    increment: number,
  ) => {
    const label = document.createElement("label")
    const name = document.createElement("span")
    name.textContent = text
    const input = document.createElement("input")
    input.type = "range"
    input.min = String(min)
    input.max = String(max)
    input.step = String(increment)
    input.value = String(params[key])
    const output = document.createElement("output")
    const update = () => {
      params[key] = Number(input.value)
      direction = rotationDirection(params.tangential, direction)
      output.textContent = params[key].toFixed(1).replace(".", ",")
      updateReadout()
      draw()
    }
    input.addEventListener("input", update)
    update()
    label.append(name, input, output)
    sliders.append(label)
  }
  addSlider("R, м", "radius", 1, 4, 0.1)
  addSlider("ω₀, рад/с", "omega", 0.5, 2, 0.1)
  addSlider("aτ, м/с²", "tangential", -4, 4, 0.2)
  controls.append(actions, sliders, readout)
  root.replaceChildren(stage, legend, controls)

  function draw() {
    if (!context) return
    const ctx = context
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * dpr)
    const pixelHeight = Math.round(height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.fillStyle = "#1a1b26"
    context.fillRect(0, 0, width, height)
    const size = Math.min(width, height)
    const unit = size * 0.086
    const cx = width / 2
    const cy = height / 2
    const vectors = circleVectors(angle, { ...params, omega: currentOmega() })
    const x = cx + vectors.position.x * unit
    const y = cy - vectors.position.y * unit
    context.strokeStyle = "#565f89"
    context.lineWidth = 1.5
    context.beginPath()
    context.arc(cx, cy, params.radius * unit, 0, 2 * Math.PI)
    context.stroke()
    context.setLineDash([5, 6])
    context.beginPath()
    context.moveTo(cx, cy)
    context.lineTo(x, y)
    context.stroke()
    context.setLineDash([])

    const accelScale = unit * Math.min(0.42, 2.5 / Math.max(1, Math.hypot(vectors.total.x, vectors.total.y), Math.hypot(vectors.normal.x, vectors.normal.y)))
    const end = (vector: Vector, scale: number) => ({
      x: x + vector.x * scale,
      y: y - vector.y * scale,
    })
    const n = end(vectors.normal, accelScale)
    const t = end(vectors.tangential, accelScale)
    const sum = end(vectors.total, accelScale)
    context.strokeStyle = "#818bb6"
    context.setLineDash([5, 6])
    context.beginPath()
    context.moveTo(n.x, n.y)
    context.lineTo(sum.x, sum.y)
    context.moveTo(t.x, t.y)
    context.lineTo(sum.x, sum.y)
    context.stroke()
    context.setLineDash([])

    function arrow(vector: Vector, scale: number, color: string, shift = 0) {
      const length = Math.hypot(vector.x, vector.y)
      if (length < 0.01) return
      const radialX = Math.cos(angle) * shift
      const radialY = -Math.sin(angle) * shift
      const sx = x + radialX
      const sy = y + radialY
      const ex = sx + vector.x * scale
      const ey = sy - vector.y * scale
      const heading = Math.atan2(ey - sy, ex - sx)
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      if (Math.hypot(ex - sx, ey - sy) > 10) {
        ctx.beginPath()
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - 10 * Math.cos(heading - 0.45), ey - 10 * Math.sin(heading - 0.45))
        ctx.lineTo(ex - 10 * Math.cos(heading + 0.45), ey - 10 * Math.sin(heading + 0.45))
        ctx.closePath()
        ctx.fill()
      }
    }
    arrow(vectors.normal, accelScale, "#bb9af7")
    arrow(vectors.tangential, accelScale, "#e0af68")
    arrow(vectors.total, accelScale, "#f7768e")
    arrow(vectors.velocity, unit * Math.min(0.32, 2.5 / Math.hypot(vectors.velocity.x, vectors.velocity.y)), "#7dcfff", 12)
    context.fillStyle = "#818bb6"
    context.beginPath()
    context.arc(cx, cy, 4, 0, 2 * Math.PI)
    context.fill()
    context.fillStyle = "#e0e6ff"
    context.beginPath()
    context.arc(x, y, 7, 0, 2 * Math.PI)
    context.fill()
  }

  function schedule() {
    if (playing && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick)
  }
  function tick(now: number) {
    frame = 0
    if (!playing || !visible || document.hidden) return
    if (last) angle = advanceAngle(angle, currentOmega(), Math.min((now - last) / 1000, 0.05))
    last = now
    draw()
    schedule()
  }
  function sync() {
    play.textContent = playing ? "Пауза" : "Воспроизвести"
    play.setAttribute("aria-pressed", String(playing))
    if (playing) schedule()
    else {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }
  }
  play.addEventListener("click", () => {
    playing = !playing
    sync()
  })
  reset.addEventListener("click", () => {
    angle = 0
    last = 0
    draw()
    schedule()
  })
  step.addEventListener("click", () => {
    playing = false
    sync()
    angle = advanceAngle(angle, currentOmega(), 0.2)
    draw()
  })
  const resize = new ResizeObserver(draw)
  resize.observe(stage)
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    last = 0
    if (visible) schedule()
    else {
      cancelAnimationFrame(frame)
      frame = 0
    }
  })
  intersection.observe(root)
  const visibility = () => {
    last = 0
    if (document.hidden) {
      cancelAnimationFrame(frame)
      frame = 0
    } else schedule()
  }
  document.addEventListener("visibilitychange", visibility)
  sync()
  draw()
  active.add(() => {
    cancelAnimationFrame(frame)
    resize.disconnect()
    intersection.disconnect()
    document.removeEventListener("visibilitychange", visibility)
  })
}

document.addEventListener("prenav", () => {
  for (const cleanup of active) cleanup()
  active.clear()
})
document.addEventListener("nav", () => {
  document.querySelectorAll<HTMLElement>(".circle-animation").forEach(mount)
})
