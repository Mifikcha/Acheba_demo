import { advanceVapor, createVaporModel, surfaceY } from "./vapor-model"

const active = new Set<() => void>()

function mount(root: HTMLElement) {
  let model = createVaporModel()
  let playing = false
  let visible = true
  let frame = 0
  let last = 0
  let lastStatus = 0
  const canvas = document.createElement("canvas")
  canvas.setAttribute("role", "img")
  canvas.setAttribute("aria-label", "Закрытый сосуд: молекулы жидкости испаряются с поверхности, молекулы пара возвращаются в жидкость при конденсации")
  const ctx = canvas.getContext("2d")
  if (!ctx) return
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
  const status = document.createElement("p")
  status.className = "vapor-status"
  controls.append(play, reset, step, label, status)
  root.replaceChildren(stage, controls)

  function updateStatus() {
    const vapor = model.particles.filter((p) => p.phase === "vapor").length
    const up = model.events.filter((e) => e.phase === "vapor").length
    const down = model.events.length - up
    status.textContent = `В паре: ${vapor} из ${model.particles.length} · за последние 8 с: испарение ↑ ${up}, конденсация ↓ ${down}`
  }

  function draw() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * dpr)
    const pixelHeight = Math.round(height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = "#1a1b26"
    ctx.fillRect(0, 0, width, height)
    const pad = 20
    const w = width - 2 * pad
    const h = height - 2 * pad
    const surface = pad + surfaceY * h
    ctx.fillStyle = "#203349"
    ctx.fillRect(pad, surface, w, h * (1 - surfaceY))
    ctx.strokeStyle = "#565f89"
    ctx.lineWidth = 1.5
    ctx.strokeRect(pad, pad, w, h)
    ctx.strokeStyle = "#7dcfff"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(pad, surface)
    ctx.lineTo(pad + w, surface)
    ctx.stroke()
    ctx.font = "12px sans-serif"
    ctx.fillStyle = "#9aa5ce"
    ctx.fillText("ПАР", pad + 12, pad + 23)
    ctx.fillText("ЖИДКОСТЬ", pad + 12, surface + 22)
    for (const p of model.particles) {
      ctx.beginPath()
      ctx.arc(pad + p.x * w, pad + p.y * h, p.phase === "vapor" ? 4 : 3.5, 0, Math.PI * 2)
      ctx.fillStyle = p.phase === "vapor" ? "#bb9af7" : "#7dcfff"
      ctx.fill()
    }
    for (const event of model.events) {
      const age = model.elapsed - event.time
      if (age > 0.9) continue
      const up = event.phase === "vapor"
      const x = pad + event.x * w
      const tip = surface + (up ? -1 : 1) * (10 + age * 20)
      ctx.globalAlpha = 1 - age / 0.9
      ctx.strokeStyle = up ? "#7dcfff" : "#e0af68"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, surface + (up ? 8 : -8))
      ctx.lineTo(x, tip)
      ctx.moveTo(x - 4, tip + (up ? 5 : -5))
      ctx.lineTo(x, tip)
      ctx.lineTo(x + 4, tip + (up ? 5 : -5))
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function schedule() {
    if (playing && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick)
  }
  function tick(now: number) {
    frame = 0
    if (!playing || !visible || document.hidden) return
    if (last) advanceVapor(model, Math.min((now - last) / 1000, 0.05) * (reduceMotion.matches ? 0.35 : 1), Number(slider.value))
    last = now
    draw()
    if (now - lastStatus > 250) {
      updateStatus()
      lastStatus = now
    }
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
    model = createVaporModel()
    last = 0
    updateStatus()
    draw()
    schedule()
  })
  step.addEventListener("click", () => {
    playing = false
    sync()
    for (let i = 0; i < 10; i++) advanceVapor(model, 0.05, Number(slider.value))
    updateStatus()
    draw()
  })
  slider.addEventListener("input", () => {
    output.textContent = `${Number(slider.value).toFixed(1).replace(".", ",")}×`
    draw()
  })
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
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
  updateStatus()
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
  document.querySelectorAll<HTMLElement>(".vapor-animation").forEach(mount)
})
