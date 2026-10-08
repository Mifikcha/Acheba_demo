import { visibleRoots } from "./parameter-demo-model"

const toX = (x: number) => 320 + x * 100
const toY = (y: number) => 30 * (2 - y)
const fmt = (value: number) => value.toFixed(1).replace(".", ",")

function parabola(start: number, end: number) {
  const points = []
  for (let x = start; x <= end + 1e-9; x += 0.05) {
    points.push(`${points.length ? "L" : "M"}${toX(x).toFixed(1)} ${toY(-x * x - 1).toFixed(1)}`)
  }
  return points.join(" ")
}

function mount(root: HTMLElement) {
  if (root.dataset.ready === "true") return
  root.dataset.ready = "true"

  const figure = document.createElement("figure")
  figure.className = "desmos-shell parameter-figure"
  const caption = document.createElement("figcaption")
  caption.textContent = "Прямая y = kx и парабола без точки (2; −5)"
  const stage = document.createElement("div")
  stage.className = "desmos-stage parameter-stage"
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 640 360")
  svg.setAttribute("role", "img")
  stage.append(svg)
  const controls = document.createElement("div")
  controls.className = "parameter-controls"
  const label = document.createElement("label")
  label.textContent = "Параметр k"
  const slider = document.createElement("input")
  slider.type = "range"
  slider.min = "-3"
  slider.max = "3"
  slider.step = "0.1"
  slider.value = "-2.5"
  const value = document.createElement("output")
  const result = document.createElement("p")
  result.setAttribute("aria-live", "polite")
  label.append(slider, value)
  controls.append(label, result)
  figure.append(caption, stage, controls)
  root.replaceChildren(figure)

  function draw() {
    const k = Number(slider.value)
    const roots = visibleRoots(k)
    value.textContent = fmt(k)
    result.textContent = `${roots.length} ${roots.length === 0 ? "пересечений" : roots.length === 1 ? "пересечение" : "пересечения"}${roots.length ? ` · x = ${roots.map(fmt).join("; ")}` : ""}`
    svg.setAttribute("aria-label", `При k = ${fmt(k)} на графике ${result.textContent}. Точка (2; −5) исключена.`)
    svg.innerHTML = `
      <rect width="640" height="360" fill="#1a1b26" />
      <path d="M320 0V360M0 60H640" stroke="#565f89" stroke-width="1.5" />
      <path d="${parabola(-3.2, 1.95)} ${parabola(2.05, 3.2)}" fill="none" stroke="#bb9af7" stroke-width="3" />
      <path d="M${toX(-3.2)} ${toY(k * -3.2)}L${toX(3.2)} ${toY(k * 3.2)}" fill="none" stroke="#7dcfff" stroke-width="3" />
      ${roots.map((x) => `<circle cx="${toX(x)}" cy="${toY(k * x)}" r="6" fill="#7dcfff" />`).join("")}
      <circle cx="520" cy="210" r="7" fill="#1a1b26" stroke="#e0af68" stroke-width="3" />
      <text x="505" y="200" text-anchor="end" fill="#e0af68" font-size="17">точка исключена</text>
    `
  }

  slider.addEventListener("input", draw)
  draw()
}

document.addEventListener("nav", () => {
  document.querySelectorAll<HTMLElement>(".parameter-demo").forEach(mount)
})
