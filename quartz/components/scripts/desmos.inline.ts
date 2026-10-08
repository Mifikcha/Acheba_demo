type DesmosExpression = {
  id: string
  latex: string
}

type DesmosCalculator = {
  setExpression(expression: DesmosExpression): void
  destroy(): void
}

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator(element: HTMLElement, options?: Record<string, unknown>): DesmosCalculator
    }
  }
}

const desmosScriptUrl =
  "https://www.desmos.com/api/v1.12/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"
let desmosScriptPromise: Promise<void> | undefined
const activeCalculators = new Set<DesmosCalculator>()
let desmosObserver: IntersectionObserver | undefined
let navigationGeneration = 0

const loadDesmos = () => {
  if (window.Desmos) return Promise.resolve()
  if (desmosScriptPromise) return desmosScriptPromise

  desmosScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = desmosScriptUrl
    script.async = true
    const timeout = window.setTimeout(() => fail(new Error("Desmos не ответил вовремя.")), 15000)
    let settled = false
    const fail = (error: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      script.remove()
      desmosScriptPromise = undefined
      reject(error)
    }
    script.onload = () => {
      if (settled) return
      if (window.Desmos) {
        settled = true
        window.clearTimeout(timeout)
        resolve()
      } else fail(new Error("Desmos не запустился после загрузки."))
    }
    script.onerror = () => fail(new Error("Не удалось загрузить Desmos."))
    document.head.append(script)
  })

  return desmosScriptPromise
}

const parseExpressions = (value: string | undefined) =>
  (value ?? "")
    .split(";")
    .map((latex) => latex.trim())
    .filter(Boolean)

const keepWheelForPageScroll = (event: WheelEvent) => {
  if (event.shiftKey) return
  event.stopImmediatePropagation()
}

const prepareDesmosEmbed = (root: HTMLElement) => {
  if (root.dataset.desmosPrepared === "true") {
    return root.querySelector<HTMLElement>(".desmos-stage")
  }
  root.dataset.desmosPrepared = "true"
  const title = root.dataset.title?.trim()
  const shell = document.createElement("figure")
  shell.className = "desmos-shell"

  if (title) {
    const caption = document.createElement("figcaption")
    caption.textContent = title
    shell.append(caption)
  }

  const stage = document.createElement("div")
  stage.className = "desmos-stage is-loading"
  stage.setAttribute("aria-label", title ? `График Desmos: ${title}` : "График Desmos")
  stage.textContent = "Загрузка Desmos..."
  shell.append(stage)

  const hint = document.createElement("p")
  hint.className = "desmos-hint"
  hint.textContent =
    "Колесо прокручивает страницу. Масштаб графика: кнопки +/- в Desmos или Shift+колесо."
  shell.append(hint)

  root.replaceChildren(shell)
  return stage
}

const initDesmosEmbed = async (root: HTMLElement) => {
  if (root.dataset.desmosReady === "true" || root.dataset.desmosLoading === "true") return
  root.dataset.desmosLoading = "true"
  const generation = navigationGeneration

  const expressions = parseExpressions(root.dataset.expressions)
  const stage = prepareDesmosEmbed(root)
  if (!stage) {
    delete root.dataset.desmosLoading
    return
  }
  if (expressions.length === 0) {
    stage.classList.remove("is-loading")
    stage.classList.add("desmos-stage-error")
    stage.textContent = "Для графика не заданы выражения."
    delete root.dataset.desmosLoading
    return
  }
  stage.classList.add("is-loading")
  stage.classList.remove("desmos-stage-error")
  stage.textContent = "Загрузка Desmos..."
  if (stage.dataset.desmosWheelReady !== "true") {
    stage.dataset.desmosWheelReady = "true"
    stage.addEventListener("wheel", keepWheelForPageScroll, { capture: true })
  }

  let calculator: DesmosCalculator | undefined
  try {
    try {
      await loadDesmos()
    } catch (error) {
      if (generation !== navigationGeneration || !root.isConnected) return
      await loadDesmos()
    }
    if (generation !== navigationGeneration || !root.isConnected || !stage.isConnected) return
    stage.textContent = ""
    calculator = window.Desmos!.GraphingCalculator(stage, {
      expressions: true,
      expressionsCollapsed: false,
      settingsMenu: false,
      keypad: false,
      lockViewport: root.dataset.lockViewport === "true",
      border: false,
      invertedColors: true,
      invertedColorsControl: false,
      language: "ru",
    })
    expressions.forEach((latex, index) => {
      calculator!.setExpression({ id: `expr-${index}`, latex })
    })
    activeCalculators.add(calculator)
    root.dataset.desmosReady = "true"
    stage.classList.remove("is-loading")
  } catch (error) {
    calculator?.destroy()
    if (generation !== navigationGeneration || !root.isConnected || !stage.isConnected) return
    stage.classList.remove("is-loading")
    stage.classList.add("desmos-stage-error")
    const message = document.createElement("p")
    message.textContent = error instanceof Error ? error.message : "Не удалось загрузить Desmos."
    const retry = document.createElement("button")
    retry.type = "button"
    retry.textContent = "Повторить загрузку"
    retry.addEventListener("click", () => void initDesmosEmbed(root))
    stage.replaceChildren(message, retry)
  } finally {
    if (generation === navigationGeneration) delete root.dataset.desmosLoading
  }
}

const cleanupDesmosEmbeds = () => {
  navigationGeneration++
  desmosObserver?.disconnect()
  desmosObserver = undefined
  document.querySelectorAll<HTMLElement>(".desmos-stage").forEach((stage) => {
    stage.removeEventListener("wheel", keepWheelForPageScroll, { capture: true })
    delete stage.dataset.desmosWheelReady
  })
  for (const calculator of activeCalculators) calculator.destroy()
  activeCalculators.clear()
  document.querySelectorAll<HTMLElement>(".desmos-embed").forEach((root) => {
    delete root.dataset.desmosReady
    delete root.dataset.desmosLoading
    delete root.dataset.desmosObserved
  })
}

const initDesmosEmbeds = () => {
  window.addCleanup?.(cleanupDesmosEmbeds)
  document.querySelectorAll<HTMLElement>(".desmos-embed").forEach((root) => {
    prepareDesmosEmbed(root)

    if (!("IntersectionObserver" in window)) {
      void initDesmosEmbed(root)
      return
    }

    if (!desmosObserver) {
      desmosObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const root = entry.target as HTMLElement
            desmosObserver?.unobserve(root)
            void initDesmosEmbed(root)
          })
        },
        { rootMargin: "900px 0px" },
      )
    }

    if (root.dataset.desmosObserved === "true") return
    root.dataset.desmosObserved = "true"
    desmosObserver.observe(root)
  })
}

document.addEventListener("nav", initDesmosEmbeds)

export {}
