import { createCommandRegistry } from "./system-console.commands"
import {
  BrowserPreferencesStore,
  BrowserSystemAdapter,
  GuestProfileProvider,
  QuartzContentProvider,
  SessionHistoryStore,
} from "./system-console.providers"
import { completeCommand, executeCommand } from "./system-console.registry"
import {
  createShellIdentity,
  formatExamCountdown,
  shouldFocusPromptFromSurface,
} from "./system-console.presentation"
import type { ConsoleContext, ConsoleResult } from "./system-console.types"

type ConsoleBinding = { cleanup(): void }

const registry = createCommandRegistry()
const preferences = new BrowserPreferencesStore()
const historyStore = new SessionHistoryStore()
const systems = new BrowserSystemAdapter()
const context: ConsoleContext = {
  profile: new GuestProfileProvider(),
  preferences,
  content: new QuartzContentProvider(),
  systems,
}

let binding: ConsoleBinding | undefined

const interactiveSelector =
  'a, button, input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [data-console-interactive], [role="button"], [role="link"], [role="slider"]'

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

const resolvedHref = (href: string): string => {
  if (!href.startsWith("/")) return href
  const base = (document.body?.dataset.basepath ?? "").replace(/\/$/, "")
  return `${base}${href}`
}

function link(label: string, href: string, className: string): HTMLAnchorElement {
  const anchor = element("a", className, label)
  anchor.href = resolvedHref(href)
  return anchor
}

function renderResult(result: ConsoleResult): HTMLElement {
  const container = element("div", `home-console-result is-${result.type}`)

  if (result.type === "text") {
    if (result.title) container.append(element("strong", "home-console-result-title", result.title))
    for (const line of result.lines) container.append(element("p", undefined, line))
  } else if (result.type === "error") {
    container.append(element("p", "home-console-error", result.title))
    if (result.detail) container.append(element("p", "home-console-result-detail", result.detail))
  } else if (result.type === "system") {
    container.append(element("strong", "home-console-result-title", result.title))
    const rows = element("dl", "home-console-system-rows")
    for (const row of result.rows) {
      const wrapper = element("div", "home-console-system-row")
      wrapper.dataset.state = row.state ?? "neutral"
      wrapper.append(element("dt", undefined, row.label), element("dd", undefined, row.value))
      rows.append(wrapper)
    }
    container.append(rows)
  } else if (result.type === "list") {
    if (result.title) container.append(element("strong", "home-console-result-title", result.title))
    const sections = element("div", "home-console-list-sections")
    for (const section of result.sections) {
      const sectionNode = element("section", "home-console-list-section")
      if (section.title) sectionNode.append(element("h3", undefined, section.title))
      const listNode = element("ul")
      for (const item of section.items) {
        const itemNode = element("li")
        const labelNode = item.href
          ? link(item.label, item.href, "home-console-result-link")
          : element("span", "home-console-command-name", item.label)
        itemNode.append(labelNode)
        if (item.detail) itemNode.append(element("span", undefined, item.detail))
        if (item.badge) itemNode.append(element("small", undefined, item.badge))
        listNode.append(itemNode)
      }
      sectionNode.append(listNode)
      sections.append(sectionNode)
    }
    container.append(sections)
  } else if (result.type === "navigation") {
    container.append(element("span", "home-console-result-eyebrow", result.eyebrow))
    const anchor = link(result.title, result.href, "home-console-navigation")
    anchor.append(element("span", undefined, `${result.detail ?? "OPEN"} ↗`))
    container.append(anchor)
  } else if (result.type === "table") {
    if (result.title) container.append(element("strong", "home-console-result-title", result.title))
    const scroll = element("div", "home-console-table-scroll")
    const table = element("table")
    const head = element("thead")
    const headRow = element("tr")
    result.columns.forEach((column) => headRow.append(element("th", undefined, column)))
    head.append(headRow)
    const body = element("tbody")
    result.rows.forEach((row) => {
      const tableRow = element("tr")
      row.forEach((cell) => tableRow.append(element("td", undefined, cell)))
      body.append(tableRow)
    })
    table.append(head, body)
    scroll.append(table)
    container.append(scroll)
  } else if (result.type === "progress") {
    if (result.title) container.append(element("strong", "home-console-result-title", result.title))
    const rows = element("div", "home-console-progress")
    for (const row of result.rows) {
      const rowNode = element("div")
      rowNode.append(element("span", undefined, row.label))
      const meter = element("span", "home-console-progress-meter")
      meter.style.setProperty("--console-progress", `${Math.max(0, Math.min(100, row.value))}%`)
      meter.setAttribute("role", "progressbar")
      meter.setAttribute("aria-valuemin", "0")
      meter.setAttribute("aria-valuemax", "100")
      meter.setAttribute("aria-valuenow", String(row.value))
      rowNode.append(meter, element("strong", undefined, `${row.value}%`))
      rows.append(rowNode)
    }
    container.append(rows)
  }

  return container
}

function rememberStudyPage(): void {
  const slug = document.body?.dataset.slug ?? ""
  if (!/^(?:предметы|_программы-обучения)\//u.test(slug) && slug !== "песочница-python") return
  const title = document
    .querySelector<HTMLElement>("article h1, .article-title")
    ?.textContent?.trim()
  if (title) preferences.set("lastStudyPage", { slug, title })
}

function applyMotionPreference(): void {
  if (preferences.get<string>("motion") === "reduce") systems.setMotion?.("reduce")
  else systems.setMotion?.("system")
}

function bindConsole(root: HTMLElement): ConsoleBinding {
  const abort = new AbortController()
  const { signal } = abort
  const countdown = root.querySelector<HTMLTimeElement>("[data-exam-countdown]")
  const form = root.querySelector<HTMLFormElement>("[data-console-form]")!
  const input = root.querySelector<HTMLInputElement>("[data-console-input]")!
  const output = root.querySelector<HTMLElement>("[data-console-output]")!
  const suggestions = root.querySelector<HTMLElement>("[data-console-suggestions]")!
  const prompt = root.querySelector<HTMLElement>("[data-console-prompt]")!
  const profileStatus = root.querySelector<HTMLElement>("[data-console-profile]")!
  const quickCommands = ["help", "settings", "random", "whoami"]
  let commandHistory = historyStore.read()
  let historyIndex = commandHistory.length
  let promptText = ""
  const focusPrompt = () => input.focus({ preventScroll: true })

  if (countdown) {
    const renderCountdown = () => (countdown.textContent = formatExamCountdown(new Date()))
    renderCountdown()
    const countdownTimer = window.setInterval(renderCountdown, 1000)
    signal.addEventListener("abort", () => window.clearInterval(countdownTimer), { once: true })
  }

  const clickedScrollbar = (event: PointerEvent): boolean => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return false
    return (
      (target.scrollHeight > target.clientHeight && event.offsetX >= target.clientWidth) ||
      (target.scrollWidth > target.clientWidth && event.offsetY >= target.clientHeight)
    )
  }

  const renderIdentity = (user: Awaited<ReturnType<typeof context.profile.getCurrentUser>>) => {
    const identity = createShellIdentity(context.profile.mode, user)
    promptText = identity.prompt
    prompt.textContent = promptText
    profileStatus.textContent = identity.profile
    root
      .querySelectorAll<HTMLElement>("[data-console-user]")
      .forEach((node) => (node.textContent = identity.user))
  }

  renderIdentity(null)
  void context.profile
    .getCurrentUser()
    .then((user) => {
      if (!signal.aborted) renderIdentity(user)
    })
    .catch(() => undefined)

  const renderSuggestions = (commands: string[], executeOnClick: boolean) => {
    suggestions.replaceChildren()
    suggestions.hidden = commands.length === 0
    if (executeOnClick)
      suggestions.append(element("span", "home-console-suggestions-label", "try:"))
    for (const command of commands.slice(0, 4)) {
      const button = element("button", undefined, command)
      button.type = "button"
      button.dataset.consoleSuggestion = command
      button.dataset.execute = String(executeOnClick)
      suggestions.append(button)
    }
  }

  const showQuickCommands = () => renderSuggestions(quickCommands, true)

  const appendTranscript = (command: string, result: ConsoleResult) => {
    const transcript = element("div", "home-console-transcript")
    const commandLine = element("div", "home-console-command")
    commandLine.append(
      element("span", "home-console-history-prompt", promptText),
      element("code", undefined, command),
    )
    transcript.append(commandLine, renderResult(result))
    output.append(transcript)
    while (output.children.length > 12) output.firstElementChild?.remove()
    root.dataset.hasOutput = "true"
    output.scrollTop = output.scrollHeight
  }

  const run = async (rawCommand: string) => {
    const command = rawCommand.trim()
    if (!command) return
    input.disabled = true
    root.dataset.busy = "true"

    if (commandHistory.at(-1) !== command) commandHistory.push(command)
    commandHistory = commandHistory.slice(-30)
    historyStore.write(commandHistory)
    historyIndex = commandHistory.length

    const result = await executeCommand(command, registry, context)
    if (result.type === "system" && result.action === "clear") {
      output.replaceChildren()
      root.dataset.hasOutput = "false"
    } else {
      appendTranscript(command, result)
    }

    input.value = ""
    input.disabled = false
    delete root.dataset.busy
    showQuickCommands()
    focusPrompt()
  }

  root.addEventListener(
    "pointerup",
    (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (
        !shouldFocusPromptFromSurface({
          button: event.button,
          pointerType: event.pointerType,
          hasSelection: Boolean(window.getSelection()?.toString().length),
          clickedInteractive: Boolean(target?.closest(interactiveSelector)),
          clickedScrollbar: clickedScrollbar(event),
        })
      )
        return
      focusPrompt()
    },
    { signal },
  )

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault()
      void run(input.value)
    },
    { signal },
  )

  input.addEventListener(
    "input",
    () => {
      if (!input.value.trim()) {
        showQuickCommands()
        return
      }
      const completion = completeCommand(input.value, registry)
      renderSuggestions(completion.suggestions, false)
    },
    { signal },
  )

  input.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault()
        void run(input.value)
      } else if (event.key === "Tab") {
        event.preventDefault()
        const completion = completeCommand(input.value, registry)
        input.value = completion.value
        renderSuggestions(completion.suggestions, false)
      } else if (event.key === "ArrowUp") {
        if (commandHistory.length === 0) return
        event.preventDefault()
        historyIndex = Math.max(0, historyIndex - 1)
        input.value = commandHistory[historyIndex] ?? ""
        input.setSelectionRange(input.value.length, input.value.length)
      } else if (event.key === "ArrowDown") {
        if (commandHistory.length === 0) return
        event.preventDefault()
        historyIndex = Math.min(commandHistory.length, historyIndex + 1)
        input.value = commandHistory[historyIndex] ?? ""
        input.setSelectionRange(input.value.length, input.value.length)
      } else if (event.key === "Escape") {
        event.preventDefault()
        suggestions.hidden = true
        focusPrompt()
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault()
        output.replaceChildren()
        root.dataset.hasOutput = "false"
      }
    },
    { signal },
  )

  suggestions.addEventListener(
    "click",
    (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>("[data-console-suggestion]")
          : null
      if (!button) return
      const suggestion = button.dataset.consoleSuggestion ?? ""
      if (button.dataset.execute === "true") {
        void run(suggestion)
        return
      }
      const parsed = input.value.trim().split(/\s+/u)
      input.value = parsed.length <= 1 ? suggestion : `${parsed[0]} ${suggestion}`
      focusPrompt()
    },
    { signal },
  )

  showQuickCommands()
  return { cleanup: () => abort.abort() }
}

function initializeSystemConsole(): void {
  binding?.cleanup()
  binding = undefined
  rememberStudyPage()
  applyMotionPreference()

  const root = document.querySelector<HTMLElement>("[data-hopes-console]")
  if (!root) return
  binding = bindConsole(root)
}

document.addEventListener("nav", initializeSystemConsole)
