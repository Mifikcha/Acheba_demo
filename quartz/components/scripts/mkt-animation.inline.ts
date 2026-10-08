import { advanceModel, createModel, type Kind } from "./mkt-model"

const active = new Set<() => void>()

function mount(root: HTMLElement) {
  const kind: Kind = root.dataset.model === "diffusion" ? "diffusion" : "brownian"
  let model = createModel(kind)
  let playing = false
  let visible = true
  let frame = 0
  let last = 0
  const canvas = document.createElement("canvas")
  canvas.setAttribute("role", "img")
  canvas.setAttribute(
    "aria-label",
    kind === "brownian"
      ? "Молекулы и траектория броуновской частицы"
      : "Перемешивание молекул двух веществ",
  )
  const context = canvas.getContext("2d")
  if (!context) return
  const stage = document.createElement("div")
  stage.className = "mkt-stage"
  stage.append(canvas)
  const controls = document.createElement("div")
  controls.className = "mkt-controls"
  const play = document.createElement("button")
  const reset = document.createElement("button")
  const step = document.createElement("button")
  for (const button of [play, reset, step]) button.type = "button"
  reset.textContent = "Сбросить"
  step.textContent = "Шаг"
  const label = document.createElement("label")
  label.textContent = "Температура T "
  const slider = document.createElement("input")
  slider.type = "range"
  slider.min = "0.5"
  slider.max = "2"
  slider.step = "0.1"
  slider.value = "1"
  const output = document.createElement("output")
  output.textContent = "1,0×"
  label.append(slider, output)
  controls.append(play, reset, step, label)
  root.replaceChildren(stage, controls)

  function draw() {
    if (!context) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * dpr)
    const pixelHeight = Math.round(height * dpr)
    if (!width || !height) return
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.fillStyle = "#1a1b26"
    context.fillRect(0, 0, width, height)
    const pad = 22
    const w = width - pad * 2
    const h = height - pad * 2
    context.strokeStyle = "#565f89"
    context.lineWidth = 1
    context.strokeRect(pad, pad, w, h)
    if (kind === "diffusion" && model.elapsed < 4) {
      context.save()
      context.setLineDash([6, 7])
      context.globalAlpha = 1 - model.elapsed / 4
      context.beginPath()
      context.moveTo(width / 2, pad)
      context.lineTo(width / 2, height - pad)
      context.stroke()
      context.restore()
    }
    const point = (x: number, y: number) => [pad + x * w, pad + y * h] as const
    if (kind === "brownian") {
      context.beginPath()
      model.trail.forEach((p, i) => {
        const [x, y] = point(p.x, p.y)
        if (i === 0) context.moveTo(x, y)
        else context.lineTo(x, y)
      })
      context.strokeStyle = "#e0af6888"
      context.lineWidth = 2
      context.stroke()
    }
    for (const p of model.particles) {
      const [x, y] = point(p.x, p.y)
      context.beginPath()
      context.arc(x, y, kind === "brownian" ? 3.2 : 4.2, 0, Math.PI * 2)
      context.fillStyle = kind === "brownian" || p.group === 0 ? "#7dcfff" : "#bb9af7"
      context.fill()
    }
    if (kind === "brownian") {
      const [x, y] = point(model.tracer.x, model.tracer.y)
      context.beginPath()
      context.arc(x, y, 14, 0, Math.PI * 2)
      context.fillStyle = "#e0af68"
      context.fill()
      context.strokeStyle = "#f5d9a2"
      context.lineWidth = 2
      context.stroke()
    }
  }

  function schedule() {
    if (playing && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick)
  }
  function tick(now: number) {
    frame = 0
    if (!playing || !visible || document.hidden) return
    if (last) advanceModel(model, Math.min((now - last) / 1000, 0.05), Number(slider.value))
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
    model = createModel(kind)
    last = 0
    draw()
    schedule()
  })
  step.addEventListener("click", () => {
    playing = false
    sync()
    for (let i = 0; i < 12; i++) advanceModel(model, 1 / 60, Number(slider.value))
    draw()
  })
  slider.addEventListener("input", () => {
    output.textContent = `${Number(slider.value).toFixed(1).replace(".", ",")}×`
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
  document.querySelectorAll<HTMLElement>(".mkt-animation").forEach(mount)
})
