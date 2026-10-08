const sidebarQuery = window.matchMedia("(max-width: 800px)")
type Theme = "dark" | "light"

const readStoredTheme = (): Theme => {
  let theme: string = "dark"

  try {
    theme = localStorage.getItem("hopes-color-theme") ?? localStorage.getItem("theme") ?? "dark"
  } catch {}

  return theme === "light" ? "light" : "dark"
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement

  root.setAttribute("saved-theme", theme)
  root.style.colorScheme = theme
  document.body?.classList.toggle("theme-light", theme === "light")
  document.body?.classList.toggle("theme-dark", theme === "dark")
  document.querySelectorAll<HTMLButtonElement>(".hopes-theme-toggle").forEach((button) => {
    button.setAttribute(
      "aria-label",
      theme === "light" ? "Включить тёмную тему" : "Включить светлую тему",
    )
    button.setAttribute("title", theme === "light" ? "Тёмная тема" : "Светлая тема")
    button.setAttribute("aria-pressed", theme === "light" ? "false" : "true")
    button.dataset.theme = theme
    button.innerHTML =
      theme === "light"
        ? `<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3a6 6 0 0 0 9 7.5A8 8 0 1 1 12 3Z"/></svg>`
        : `<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`
  })
}

const applyStoredTheme = () => applyTheme(readStoredTheme())

const notifyThemeChange = (theme: "dark" | "light") => {
  document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }))
}

const toggleTheme = () => {
  const nextTheme =
    document.documentElement.getAttribute("saved-theme") === "light" ? "dark" : "light"

  document.documentElement.dataset.themeChanging = "true"

  try {
    localStorage.setItem("hopes-color-theme", nextTheme)
    localStorage.setItem("theme", nextTheme)
  } catch {}

  applyTheme(nextTheme)
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (document.documentElement.getAttribute("saved-theme") !== nextTheme) return

      notifyThemeChange(nextTheme)
      document.documentElement.removeAttribute("data-theme-changing")
    }),
  )
}

const bindThemeToggle = (button: HTMLButtonElement) => {
  if (button.dataset.themeToggleReady === "true") {
    return
  }

  button.dataset.themeToggleReady = "true"
  button.type = "button"
  button.addEventListener("click", toggleTheme)
}

const bindThemeToggles = () => {
  document.querySelectorAll<HTMLButtonElement>(".hopes-theme-toggle").forEach(bindThemeToggle)
}

const setSidebarState = (open: boolean) => {
  document.documentElement.dataset.sidebarLeft = open ? "open" : "closed"
}

const getSiteRootHref = () => {
  const domain = document
    .querySelector<HTMLMetaElement>('meta[property="twitter:domain"]')
    ?.content?.trim()

  if (!domain) {
    return "/"
  }

  const path = new URL(`https://${domain}`).pathname.replace(/\/?$/, "/")
  return path || "/"
}

const ensurePageTitleHomeLink = () => {
  const href = getSiteRootHref()

  document.querySelectorAll<HTMLAnchorElement>(".page-title a").forEach((link) => {
    link.href = href
  })
}

const ensureThemeToggle = () => {
  const leftSidebar = document.querySelector<HTMLElement>(".left.sidebar")

  if (!leftSidebar) {
    return
  }

  if (!leftSidebar.querySelector(".hopes-theme-toggle")) {
    const button = document.createElement("button")
    button.className = "hopes-theme-toggle"

    const pageTitle = leftSidebar.querySelector(".page-title")
    pageTitle?.insertAdjacentElement("afterend", button)
  }
}

const ensureFrameThemeToggle = () => {
  const excalidrawFrame = document.querySelector<HTMLElement>(
    '#quartz-root.page[data-frame="excalidraw"]',
  )

  if (!excalidrawFrame || excalidrawFrame.querySelector(".excalidraw-theme-toggle")) {
    return
  }

  const button = document.createElement("button")
  button.className = "hopes-theme-toggle hopes-frame-theme-toggle excalidraw-theme-toggle"
  excalidrawFrame.append(button)
}

const ensureMobileToggle = () => {
  if (document.querySelector(".mobile-sidebar-toggle")) {
    return
  }

  const button = document.createElement("button")
  button.className = "mobile-sidebar-toggle"
  button.type = "button"
  button.setAttribute("aria-label", "Открыть проводник")
  button.setAttribute("title", "Проводник")
  button.setAttribute("aria-expanded", "false")
  button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M4 5h16v2H4V5Zm0 6h16v2H4v-2Zm0 6h16v2H4v-2Z"/></svg>`
  button.addEventListener("click", () => {
    const open = document.documentElement.dataset.sidebarLeft !== "open"
    setSidebarState(open)
    button.setAttribute("aria-expanded", String(open))
    button.setAttribute("aria-label", open ? "Закрыть проводник" : "Открыть проводник")
  })

  document.body.append(button)
}

const sortInfoTaskCards = () => {
  const slug = document.body.dataset.slug ?? ""

  if (!slug.includes("информатика/разбор-задач")) {
    return
  }

  document.querySelectorAll<HTMLUListElement>(".page-listing .section-ul").forEach((list) => {
    const items = [...list.querySelectorAll<HTMLElement>(":scope > li.section-li")]
    const numberOf = (item: HTMLElement) => {
      const text = item.querySelector("h3 a")?.textContent ?? ""
      const match = text.match(/№\s*(\d+)/)
      return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
    }

    items.sort((a, b) => numberOf(a) - numberOf(b))
    items.forEach((item) => list.append(item))
  })
}

const hideHomeGraphLinks = () => {
  if (document.body.dataset.slug !== "index") {
    return
  }

  document.querySelectorAll<HTMLAnchorElement>('.toc a[href="#graph-links"]').forEach((link) => {
    link.closest("li")?.remove()
  })

  const heading = document.querySelector<HTMLElement>("article h2#graph-links")
  if (!heading) {
    return
  }

  let current = heading.nextElementSibling
  while (current && !/^H[1-6]$/.test(current.tagName)) {
    const next = current.nextElementSibling
    current.remove()
    current = next
  }
  heading.remove()
}

const lowSignalTocHeading = /^(?:примеры?|решение|ответ|проверка|демоверсия)\s*(?:\d+|[):.]|$)/i

const prepareTableOfContents = () => {
  document.querySelectorAll<HTMLElement>(".toc").forEach((toc) => {
    if (toc.dataset.hopesTocReady === "true") return
    toc.dataset.hopesTocReady = "true"

    const content = toc.querySelector<HTMLElement>(".toc-content")
    if (!content) return

    const entries = [...content.querySelectorAll<HTMLAnchorElement>("a[data-for]")]
      .map((link) => ({ link, heading: document.getElementById(link.dataset.for ?? "") }))
      .filter(({ link, heading }) => {
        const hidden =
          !heading ||
          Boolean(heading.closest(".callout, .transclude")) ||
          lowSignalTocHeading.test(heading.textContent?.trim() ?? "")
        link.closest("li")?.toggleAttribute("hidden", hidden)
        return !hidden && Boolean(heading)
      }) as { link: HTMLAnchorElement; heading: HTMLElement }[]

    if (entries.length < 2) {
      toc.hidden = true
      return
    }

    let frame = 0
    const update = () => {
      frame = 0
      const readingLine = Math.min(180, window.innerHeight * 0.28)
      let activeIndex = 0
      entries.forEach(({ heading }, index) => {
        if (heading.getBoundingClientRect().top <= readingLine) activeIndex = index
      })

      entries.forEach(({ link }, index) => {
        link.classList.toggle("is-past", index < activeIndex)
        link.classList.toggle("is-active", index === activeIndex)
        link.classList.toggle("is-future", index > activeIndex)
      })

      const activeItem = entries[activeIndex].link.closest<HTMLElement>("li")
      if (!activeItem) return
      const marker = activeItem.offsetTop + activeItem.offsetHeight / 2
      content.style.setProperty("--toc-marker-y", `${marker}px`)
    }
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    window.addEventListener("scroll", scheduleUpdate, { passive: true })
    window.addEventListener("resize", scheduleUpdate)
    update()
    window.addCleanup?.(() => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", scheduleUpdate)
      window.removeEventListener("resize", scheduleUpdate)
      delete toc.dataset.hopesTocReady
    })
  })
}

const prepareHomeAtmosphere = () => {
  if (document.body.dataset.slug !== "index") return
  const entry = document.querySelector<HTMLElement>(".home-entry")
  if (!entry || entry.dataset.atmosphereReady === "true") return
  entry.dataset.atmosphereReady = "true"

  let starSeed = 104729
  const nextStarValue = () => (starSeed = (starSeed * 48271) % 2147483647) / 2147483647
  const starLayer = (count: number, layer: "far" | "mid") =>
    Array.from({ length: count }, (_, index) => {
      const x = (nextStarValue() * 1200).toFixed(1)
      const y = (nextStarValue() * 360).toFixed(1)
      const radius =
        layer === "far"
          ? (0.28 + nextStarValue() * 0.48).toFixed(2)
          : (0.65 + nextStarValue() * 0.7).toFixed(2)
      const opacity =
        layer === "far"
          ? (0.03 + nextStarValue() * 0.07).toFixed(2)
          : (0.1 + nextStarValue() * 0.15).toFixed(2)
      const twinkle = layer === "mid" && index % 6 === 0 ? " home-star-twinkle" : ""
      const timing = twinkle
        ? ` style="--star-duration:${[4.7, 6.3, 8.8, 11.2, 13.5][index % 5]}s;--star-delay:-${(
            nextStarValue() * 11
          ).toFixed(1)}s"`
        : ""
      return `<circle class="home-star-${layer}${twinkle}" cx="${x}" cy="${y}" r="${radius}" opacity="${opacity}"${timing}/>`
    }).join("")

  const atmosphere = document.createElement("div")
  atmosphere.className = "home-atmosphere"
  atmosphere.setAttribute("aria-hidden", "true")
  atmosphere.innerHTML = `
    <div class="home-nebula"></div>
    <svg class="home-star-field" viewBox="0 0 1200 360" preserveAspectRatio="none" focusable="false">
      ${starLayer(160, "far")}
      ${starLayer(32, "mid")}
      <g class="home-star-bright home-star-bright-1" transform="translate(660 34)"><circle r="1.8"/><path d="M0-8V8M-8 0H8"/></g>
      <g class="home-star-bright home-star-bright-2" transform="translate(817 318)"><circle r="2.2"/></g>
      <g class="home-star-bright home-star-bright-3" transform="translate(955 48)"><circle r="1.4"/><path d="M0-5V5M-5 0H5"/></g>
      <g class="home-star-bright home-star-bright-4" transform="translate(1065 184)"><circle r="2.6"/></g>
      <g class="home-star-bright home-star-bright-5" transform="translate(1168 72)"><circle r="1.6"/></g>
      <g class="home-star-bright home-star-bright-6" transform="translate(278 327)"><circle r="1.3"/></g>
      <g class="home-star-bright home-star-bright-7" transform="translate(1140 304)"><circle r="2"/><circle class="home-star-ring" r="5"/></g>
    </svg>
    <svg class="home-constellations" viewBox="0 0 1200 360" preserveAspectRatio="none" focusable="false">
      <g class="home-constellation home-constellation-1" transform="translate(44 30)">
        <path d="M0 21 30 4 61 20 91 7 122 31 89 53 48 45 30 4"/>
        <circle cx="0" cy="21" r="1.6"/><circle cx="30" cy="4" r="1.3"/><circle cx="61" cy="20" r="1.8"/>
        <circle cx="91" cy="7" r="1.2"/><circle cx="122" cy="31" r="1.5"/><circle cx="89" cy="53" r="1.3"/><circle cx="48" cy="45" r="1.4"/>
      </g>
      <g class="home-constellation home-constellation-2" transform="translate(560 286)">
        <path d="M0 19 33 2 62 24 93 8 121 31M33 2 31 42 62 24 84 51 121 31"/>
        <circle cx="0" cy="19" r="1.3"/><circle cx="33" cy="2" r="1.7"/><circle cx="62" cy="24" r="1.4"/>
        <circle cx="93" cy="8" r="1.2"/><circle cx="121" cy="31" r="1.6"/><circle cx="31" cy="42" r="1.2"/><circle cx="84" cy="51" r="1.3"/>
      </g>
      <g class="home-constellation home-constellation-3" transform="translate(1082 92)">
        <path d="M0 17 27 0 53 23 84 11 113 36 139 17M53 23 63 55 91 66 113 36"/>
        <circle cx="0" cy="17" r="1.5"/><circle cx="27" cy="0" r="1.2"/><circle cx="53" cy="23" r="1.7"/>
        <circle cx="84" cy="11" r="1.2"/><circle cx="113" cy="36" r="1.4"/><circle cx="139" cy="17" r="1.2"/><circle cx="63" cy="55" r="1.2"/><circle cx="91" cy="66" r="1.4"/>
      </g>
    </svg>
    <span class="home-comet"></span>
    <div class="home-orbit-system">
      ${[1, 2, 3, 4, 5]
        .map(
          (orbit) =>
            `<span class="home-orbit home-orbit-${orbit}">${orbit < 5 ? `<b class="home-orbit-body home-orbit-body-${orbit}"></b>` : ""}</span>`,
        )
        .join("")}
      <svg class="home-dyson-sphere" viewBox="0 0 120 120" focusable="false">
        <g class="home-dyson-shell">
          <circle class="home-dyson-frame" cx="60" cy="60" r="42" pathLength="100"/>
          <ellipse cx="60" cy="60" rx="42" ry="16"/>
          <ellipse cx="60" cy="60" rx="18" ry="42"/>
          <ellipse cx="60" cy="60" rx="42" ry="16" transform="rotate(43 60 60)"/>
          <path class="home-dyson-segment" d="M24 39A42 42 0 0 1 52 19M83 25A42 42 0 0 1 101 52M98 78A42 42 0 0 1 75 99M44 99A42 42 0 0 1 20 74"/>
          <g class="home-dyson-nodes"><circle cx="18" cy="60" r="2"/><circle cx="92" cy="36" r="1.8"/><circle cx="78" cy="96" r="1.6"/><circle cx="38" cy="27" r="1.5"/></g>
        </g>
        <g class="home-dyson-star">
          <circle class="home-dyson-halo" cx="60" cy="60" r="12"/>
          <path class="home-dyson-rays" d="M60 43V52M60 68V77M43 60H52M68 60H77"/>
          <circle class="home-dyson-core" cx="60" cy="60" r="3.3"/>
        </g>
      </svg>
    </div>
  `
  entry.prepend(atmosphere)

  const comet = atmosphere.querySelector<HTMLElement>(".home-comet")!
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let cometTimer = 0
  const scheduleComet = () => {
    window.clearTimeout(cometTimer)
    if (reducedMotion.matches) return
    cometTimer = window.setTimeout(
      () => {
        if (atmosphere.classList.contains("is-live")) {
          comet.style.setProperty("--comet-x", `${58 + Math.random() * 30}%`)
          comet.style.setProperty("--comet-y", `${10 + Math.random() * 56}%`)
          comet.style.setProperty("--comet-angle", `${-18 - Math.random() * 14}deg`)
          comet.classList.remove("is-flying")
          requestAnimationFrame(() => comet.classList.add("is-flying"))
        }
        scheduleComet()
      },
      15000 + Math.random() * 25000,
    )
  }
  const handleMotionPreference = () => scheduleComet()
  reducedMotion.addEventListener("change", handleMotionPreference)
  scheduleComet()

  const observer = new IntersectionObserver(([state]) => {
    atmosphere.classList.toggle("is-live", state.isIntersecting && !document.hidden)
  })
  const handleVisibility = () => {
    if (document.hidden) atmosphere.classList.remove("is-live")
    else if (entry.getBoundingClientRect().bottom > 0) atmosphere.classList.add("is-live")
  }

  document.addEventListener("visibilitychange", handleVisibility)
  observer.observe(entry)
  window.addCleanup?.(() => {
    window.clearTimeout(cometTimer)
    observer.disconnect()
    reducedMotion.removeEventListener("change", handleMotionPreference)
    document.removeEventListener("visibilitychange", handleVisibility)
  })
}

const prepareGraphScrollContract = () => {
  document
    .querySelectorAll<HTMLElement>(".graph-container, .global-graph-container")
    .forEach((graph) => {
      if (graph.dataset.scrollContractReady === "true") return
      graph.dataset.scrollContractReady = "true"

      graph.addEventListener(
        "wheel",
        (event) => {
          if (event.shiftKey || graph.classList.contains("global-graph-container")) return
          event.stopPropagation()
        },
        { capture: true },
      )
    })
}

const passWheelToPage = (event: WheelEvent) => {
  if (event.ctrlKey || event.defaultPrevented) return
  event.preventDefault()
  event.stopImmediatePropagation()

  const root = document.documentElement
  const scrollBehavior = root.style.scrollBehavior
  root.style.scrollBehavior = "auto"
  window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: "auto" })
  root.style.scrollBehavior = scrollBehavior
}

const prepareRightSidebarScrollContract = () => {
  document.querySelectorAll<HTMLElement>(".right.sidebar").forEach((sidebar) => {
    if (sidebar.dataset.pageWheelReady === "true") return
    sidebar.dataset.pageWheelReady = "true"
    sidebar.addEventListener("wheel", passWheelToPage, { capture: true, passive: false })
  })
}

const ensureGlobalGraphControls = () => {
  document.querySelectorAll<HTMLElement>(".global-graph-outer").forEach((outer) => {
    if (outer.querySelector(".global-graph-controls")) return
    const container = outer.querySelector<HTMLElement>(".global-graph-container")
    if (!container) return

    const panel = document.createElement("aside")
    panel.className = "global-graph-controls"
    panel.setAttribute("aria-label", "Настройка графа")
    panel.innerHTML = `
      <header>
        <h2>Настройка графа</h2>
        <button type="button" class="global-graph-close" aria-label="Закрыть граф" title="Закрыть">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </header>
      <details>
        <summary>Фильтры</summary>
        <label class="global-graph-switch"><span>Показывать теги</span><input type="checkbox" data-graph-key="showTags"></label>
      </details>
      <details>
        <summary>Группировка</summary>
        <label class="global-graph-switch"><span>Радиальное расположение</span><input type="checkbox" data-graph-key="enableRadial"></label>
        <label class="global-graph-switch"><span>Фокус по наведению</span><input type="checkbox" data-graph-key="focusOnHover"></label>
      </details>
      <details open>
        <summary>Отображение</summary>
        <label><span>Порог исчезновения текста <output data-graph-output="opacityScale"></output></span><input type="range" min="0.35" max="1.4" step="0.05" data-graph-key="opacityScale"></label>
        <label><span>Размер подписей <output data-graph-output="fontSize"></output></span><input type="range" min="0.22" max="0.8" step="0.02" data-graph-key="fontSize"></label>
        <label><span>Размер узла <output data-graph-output="nodeScale"></output></span><input type="range" min="0.35" max="1.6" step="0.05" data-graph-key="nodeScale"></label>
        <label><span>Толщина линий <output data-graph-output="lineWidth"></output></span><input type="range" min="0.25" max="1.5" step="0.05" data-graph-key="lineWidth"></label>
        <button type="button" class="global-graph-run">Запустить анимацию</button>
      </details>
      <details open>
        <summary>Силы</summary>
        <label><span>Сила притяжения <output data-graph-output="centerForce"></output></span><input type="range" min="0.05" max="1" step="0.05" data-graph-key="centerForce"></label>
        <label><span>Сила отталкивания <output data-graph-output="repelForce"></output></span><input type="range" min="0.2" max="1.6" step="0.05" data-graph-key="repelForce"></label>
        <label><span>Сила связей <output data-graph-output="linkStrength"></output></span><input type="range" min="0.2" max="1.5" step="0.05" data-graph-key="linkStrength"></label>
        <label><span>Расстояние между узлами <output data-graph-output="linkDistance"></output></span><input type="range" min="20" max="180" step="2" data-graph-key="linkDistance"></label>
      </details>
    `
    outer.append(panel)

    const defaults = {
      opacityScale: 1.2,
      fontSize: 0.22,
      nodeScale: 0.5,
      lineWidth: 0.26,
      centerForce: 0.08,
      repelForce: 1.35,
      linkStrength: 0.72,
      linkDistance: 118,
      showTags: true,
      enableRadial: false,
      focusOnHover: true,
      ...JSON.parse(container.dataset.cfg ?? "{}"),
    }
    const render = () => document.dispatchEvent(new CustomEvent("render", { detail: {} }))

    panel.addEventListener("click", (event) => event.stopPropagation())
    panel.querySelector<HTMLButtonElement>(".global-graph-close")?.addEventListener("click", () => {
      outer.classList.remove("active")
      const sidebar = outer.closest<HTMLElement>(".sidebar")
      if (sidebar) sidebar.style.zIndex = ""
    })
    panel.querySelector<HTMLButtonElement>(".global-graph-run")?.addEventListener("click", render)
    panel.querySelectorAll<HTMLInputElement>("[data-graph-key]").forEach((input) => {
      const key = input.dataset.graphKey ?? ""
      const value = defaults[key as keyof typeof defaults]
      if (input.type === "checkbox") input.checked = Boolean(value)
      else input.value = String(value)

      const output = panel.querySelector<HTMLOutputElement>(`[data-graph-output="${key}"]`)
      const updateOutput = () => {
        if (output) output.value = input.value
      }
      updateOutput()
      input.addEventListener("input", updateOutput)
      input.addEventListener("change", () => {
        const config = JSON.parse(container.dataset.cfg ?? "{}")
        config[key] = input.type === "checkbox" ? input.checked : Number(input.value)
        container.dataset.cfg = JSON.stringify(config)
        render()
      })
    })
  })
}

const prepareSidebar = () => {
  setSidebarState(!sidebarQuery.matches)

  document.querySelectorAll(".floating-sidebar-toggle").forEach((button) => button.remove())
  document
    .querySelectorAll<HTMLButtonElement>("button.readermode")
    .forEach((button) => button.remove())
  document
    .querySelectorAll<HTMLButtonElement>("button.darkmode")
    .forEach((button) => button.remove())

  document.querySelectorAll<HTMLElement>(".explorer").forEach((explorer) => {
    explorer.classList.remove("collapsed")
    explorer.setAttribute("aria-expanded", "true")
  })

  document.querySelectorAll<HTMLElement>(".explorer-content").forEach((content) => {
    content.classList.remove("collapsed")
    content.setAttribute("aria-expanded", "true")
  })

  document.querySelectorAll<HTMLButtonElement>(".explorer-toggle").forEach((button) => {
    button.setAttribute("aria-hidden", "true")
    button.tabIndex = -1
  })

  try {
    localStorage.removeItem("quartz-sidebar-collapse")
  } catch {}

  ensureThemeToggle()
  ensureFrameThemeToggle()
  bindThemeToggles()
  ensurePageTitleHomeLink()
  ensureMobileToggle()
  sortInfoTaskCards()
  hideHomeGraphLinks()
  prepareTableOfContents()
  prepareHomeAtmosphere()
  prepareGraphScrollContract()
  prepareRightSidebarScrollContract()
  ensureGlobalGraphControls()
  applyStoredTheme()
}

sidebarQuery.addEventListener("change", () => setSidebarState(!sidebarQuery.matches))
document.addEventListener("nav", prepareSidebar)
document.addEventListener("render", prepareSidebar)
prepareSidebar()
