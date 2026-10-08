import micromorph from "micromorph"
import { FullSlug, RelativeURL, getFullSlug, normalizeRelativeURLs } from "../../util/path"
import { fetchCanonical } from "./util"

// adapted from `micromorph`
// https://github.com/natemoo-re/micromorph
const NODE_TYPE_ELEMENT = 1
let announcer = document.createElement("route-announcer")
const isElement = (target: EventTarget | null): target is Element =>
  (target as Node)?.nodeType === NODE_TYPE_ELEMENT
const isLocalUrl = (href: string) => {
  try {
    const url = new URL(href)
    if (window.location.origin === url.origin) {
      return true
    }
  } catch (e) {}
  return false
}

const isSamePage = (url: URL): boolean => {
  const sameOrigin = url.origin === window.location.origin
  const normalizePath = (path: string) =>
    path
      .replace(/\/index\.html?$/i, "/")
      .replace(/\.html$/i, "")
      .replace(/\/$/i, "") || "/"

  const samePath = normalizePath(url.pathname) === normalizePath(window.location.pathname)
  return sameOrigin && samePath
}

const getHashElement = (hash: string): HTMLElement | null => {
  if (!hash) return null

  try {
    return document.getElementById(decodeURIComponent(hash.substring(1)))
  } catch {
    return document.getElementById(hash.substring(1))
  }
}

let hashScrollTimers: number[] = []

const cancelHashScroll = () => {
  hashScrollTimers.forEach(window.clearTimeout)
  hashScrollTimers = []
}

const alignHashElement = (hash: string) => {
  const el = getHashElement(hash)
  if (!el) return false

  // CSS smooth scrolling makes repeated layout-shift corrections compete with each other.
  // Correct instantly, then let the later passes account for images and component renders.
  const rootBehavior = document.documentElement.style.scrollBehavior
  const bodyBehavior = document.body.style.scrollBehavior
  document.documentElement.style.scrollBehavior = "auto"
  document.body.style.scrollBehavior = "auto"
  el.scrollIntoView({ block: "start", behavior: "auto" })
  document.documentElement.style.scrollBehavior = rootBehavior
  document.body.style.scrollBehavior = bodyBehavior
  return true
}

const scrollToHash = (url: URL, updateHistory: boolean): boolean => {
  if (!getHashElement(url.hash)) return false

  if (updateHistory) {
    const next = `${url.pathname}${url.search}${url.hash}`
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (next !== current) {
      history.pushState({}, "", url)
    }
  }

  cancelHashScroll()
  alignHashElement(url.hash)
  requestAnimationFrame(() => alignHashElement(url.hash))
  hashScrollTimers = [120, 360, 900].map((delay) =>
    window.setTimeout(() => alignHashElement(url.hash), delay),
  )
  return true
}

const getOpts = ({ target }: Event): { url: URL; scroll?: boolean } | undefined => {
  if (!isElement(target)) return
  if (target.attributes.getNamedItem("target")?.value === "_blank") return
  const a = target.closest("a")
  if (!a) return
  if ("routerIgnore" in a.dataset) return
  const { href } = a
  if (!isLocalUrl(href)) return
  return { url: new URL(href), scroll: "routerNoscroll" in a.dataset ? false : undefined }
}

function notifyNav(url: FullSlug) {
  const event: CustomEventMap["nav"] = new CustomEvent("nav", { detail: { url } })
  document.dispatchEvent(event)
}

const cleanupFns: Set<(...args: any[]) => void> = new Set()
window.addCleanup = (fn) => cleanupFns.add(fn)

function startLoading() {
  document.querySelector(".navigation-progress")?.remove()
  const loadingBar = document.createElement("div")
  loadingBar.className = "navigation-progress"
  loadingBar.style.width = "0"
  document.body.prepend(loadingBar)

  setTimeout(() => {
    loadingBar.style.width = "80%"
  }, 100)
}

function stopLoading() {
  const loadingBar = document.querySelector(".navigation-progress")
  if (loadingBar) {
    loadingBar.remove()
  }
}

let isNavigating = false
let p: DOMParser
type NavigationDirection = "neutral" | "forward" | "back"

async function _navigate(
  url: URL,
  isBack: boolean = false,
  direction: NavigationDirection = "neutral",
) {
  isNavigating = true
  startLoading()
  p = p || new DOMParser()
  const contents = await fetchCanonical(url)
    .then((res) => {
      const contentType = res.headers.get("content-type")
      if (contentType?.startsWith("text/html")) {
        return res.text()
      } else {
        window.location.assign(url)
      }
    })
    .catch(() => {
      window.location.assign(url)
    })

  if (!contents) return

  // notify about to nav
  const event: CustomEventMap["prenav"] = new CustomEvent("prenav", { detail: {} })
  document.dispatchEvent(event)

  // cleanup old
  cleanupFns.forEach((fn) => fn())
  cleanupFns.clear()

  const html = p.parseFromString(contents, "text/html")
  normalizeRelativeURLs(html, url)

  let title = html.querySelector("title")?.textContent
  if (title) {
    document.title = title
  } else {
    const h1 = document.querySelector("h1")
    title = h1?.innerText ?? h1?.textContent ?? url.pathname
  }
  if (announcer.textContent !== title) {
    announcer.textContent = title
  }
  announcer.dataset.persist = ""
  html.body.appendChild(announcer)

  document.querySelector(".navigation-progress")?.remove()
  micromorph(document.body, html.body)
  document.documentElement.dataset.pageEnter = direction
  requestAnimationFrame(() => {
    window.setTimeout(() => document.documentElement.removeAttribute("data-page-enter"), 190)
  })

  // scroll into place and add history
  if (!isBack) {
    if (url.hash) {
      scrollToHash(url, false)
    } else {
      window.scrollTo({ top: 0 })
    }
  }

  // now, patch head, re-executing scripts
  const elementsToRemove = document.head.querySelectorAll(":not([data-persist])")
  elementsToRemove.forEach((el) => el.remove())
  const elementsToAdd = html.head.querySelectorAll(":not([data-persist])")
  elementsToAdd.forEach((el) => document.head.appendChild(el))

  // delay setting the url until now
  // at this point everything is loaded so changing the url should resolve to the correct addresses
  if (!isBack) {
    history.pushState({}, "", url)
  }

  notifyNav(getFullSlug(window))
  delete announcer.dataset.persist
}

async function navigate(
  url: URL,
  isBack: boolean = false,
  direction: NavigationDirection = "neutral",
) {
  if (isNavigating) return
  isNavigating = true
  try {
    await _navigate(url, isBack, direction)
  } catch (e) {
    console.error(e)
    window.location.assign(url)
  } finally {
    stopLoading()
    isNavigating = false
  }
}

window.spaNavigate = navigate

function createRouter() {
  if (typeof window !== "undefined") {
    window.addEventListener("click", async (event) => {
      const { url } = getOpts(event) ?? {}
      // dont hijack behaviour, just let browser act normally
      if (!url || event.ctrlKey || event.metaKey || event.button !== 0) return
      event.preventDefault()

      if (isSamePage(url) && url.hash) {
        scrollToHash(url, true)
        return
      }

      const anchor = isElement(event.target) ? event.target.closest("a") : null
      const direction: NavigationDirection =
        anchor?.rel === "next" ? "forward" : anchor?.rel === "prev" ? "back" : "neutral"
      navigate(url, false, direction)
    })

    window.addEventListener("popstate", (event) => {
      const { url } = getOpts(event) ?? {}
      if (window.location.hash && window.location.pathname === url?.pathname) return
      navigate(new URL(window.location.toString()), true)
      return
    })
  }

  return new (class Router {
    go(pathname: RelativeURL) {
      const url = new URL(pathname, window.location.toString())
      return navigate(url, false)
    }

    back() {
      return window.history.back()
    }

    forward() {
      return window.history.forward()
    }
  })()
}

createRouter()
notifyNav(getFullSlug(window))

if (!customElements.get("route-announcer")) {
  const attrs = {
    "aria-live": "assertive",
    "aria-atomic": "true",
    style:
      "position: absolute; left: 0; top: 0; clip: rect(0 0 0 0); clip-path: inset(50%); overflow: hidden; white-space: nowrap; width: 1px; height: 1px",
  }

  customElements.define(
    "route-announcer",
    class RouteAnnouncer extends HTMLElement {
      constructor() {
        super()
      }
      connectedCallback() {
        for (const [key, value] of Object.entries(attrs)) {
          this.setAttribute(key, value)
        }
      }
    },
  )
}
