import { advanceHeat, createHeatModel, heatFlows } from "./heat-model"

const active = new Set<() => void>()
const initialGaps = [40, 20, 60]

function mount(root: HTMLElement) {
  let model = createHeatModel()
  let playing = false
  let visible = true
  let frame = 0
  let last = 0
  const stage = document.createElement("div")
  stage.className = "heat-stage"
  stage.innerHTML = `<svg class="heat-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs><marker id="heat-tip" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8" /></marker></defs>
    <path d="M44 20 H56" marker-end="url(#heat-tip)" />
    <path d="M39 68 Q29 52 24 33" marker-end="url(#heat-tip)" />
    <path d="M61 68 Q71 52 76 33" marker-end="url(#heat-tip)" />
  </svg>
  <div class="heat-body heat-body-a"><span>Тело А</span><strong>60 °C</strong></div>
  <div class="heat-body heat-body-b"><span>Тело Б</span><strong>20 °C</strong></div>
  <div class="heat-body heat-body-c"><span>Тело В</span><strong>80 °C</strong></div>`
  const readings = [...stage.querySelectorAll<HTMLElement>("strong")]
  const bodies = [...stage.querySelectorAll<HTMLElement>(".heat-body")]
  const arrows = [...stage.querySelectorAll<SVGPathElement>(".heat-arrows > path")]
  const controls = document.createElement("div")
  controls.className = "mkt-controls"
  const play = document.createElement("button")
  const reset = document.createElement("button")
  const step = document.createElement("button")
  for (const button of [play, reset, step]) button.type = "button"
  reset.textContent = "Сбросить"
  step.textContent = "Шаг +1 с"
  const status = document.createElement("p")
  status.className = "heat-status"
  status.setAttribute("aria-live", "polite")
  controls.append(play, reset, step, status)
  root.replaceChildren(stage, controls)

  function draw() {
    const equal = heatFlows(model).length === 0
    model.temperatures.forEach((temperature, index) => {
      readings[index].textContent = `${temperature.toFixed(1).replace(".", ",")} °C`
      const hue = 210 - (temperature - 20) * 3
      bodies[index].style.backgroundColor = `hsl(${hue} 45% 30%)`
    })
    const [a, b, c] = model.temperatures
    const gaps = [Math.abs(a - b), Math.abs(c - a), Math.abs(c - b)]
    arrows.forEach((arrow, index) => { arrow.style.opacity = equal ? "0" : String(Math.max(0.12, gaps[index] / initialGaps[index])) })
    if (equal) {
      if (status.textContent !== "Тепловое равновесие: 65 °C у всех тел. Передача тепла прекратилась.") {
        status.textContent = "Тепловое равновесие: 65 °C у всех тел. Передача тепла прекратилась."
      }
    } else if (status.textContent !== "Тепло переходит от более горячего тела к более холодному.") {
      status.textContent = "Тепло переходит от более горячего тела к более холодному."
    }
    if (equal && playing) { playing = false; sync() }
  }

  function schedule() {
    if (playing && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick)
  }
  function tick(now: number) {
    frame = 0
    if (!playing || !visible || document.hidden) return
    if (last) advanceHeat(model, Math.min((now - last) / 1000, 0.05) * (reduceMotion.matches ? 0.35 : 1))
    last = now
    draw()
    schedule()
  }
  function sync() {
    play.textContent = playing ? "Пауза" : heatFlows(model).length ? "Воспроизвести" : "Повторить"
    play.setAttribute("aria-pressed", String(playing))
    stage.classList.toggle("is-playing", playing)
    if (playing) schedule()
    else { cancelAnimationFrame(frame); frame = 0; last = 0 }
  }
  play.addEventListener("click", () => {
    if (!playing && heatFlows(model).length === 0) model = createHeatModel()
    playing = !playing
    draw()
    sync()
  })
  reset.addEventListener("click", () => {
    model = createHeatModel()
    last = 0
    draw()
    sync()
  })
  step.addEventListener("click", () => {
    playing = false
    advanceHeat(model, 1)
    draw()
    sync()
  })
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    last = 0
    if (visible) schedule()
    else { cancelAnimationFrame(frame); frame = 0 }
  })
  intersection.observe(root)
  const visibility = () => {
    last = 0
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0 }
    else schedule()
  }
  document.addEventListener("visibilitychange", visibility)
  draw()
  sync()
  active.add(() => {
    cancelAnimationFrame(frame)
    intersection.disconnect()
    document.removeEventListener("visibilitychange", visibility)
  })
}

document.addEventListener("prenav", () => {
  for (const cleanup of active) cleanup()
  active.clear()
})
document.addEventListener("nav", () => {
  document.querySelectorAll<HTMLElement>(".heat-animation").forEach(mount)
})
