import assert from "node:assert/strict"
import test, { describe } from "node:test"
import { GuestProfileProvider } from "./system-console.providers"
import { completeCommand, executeCommand, parseCommand } from "./system-console.registry"
import { createCommandRegistry } from "./system-console.commands"
import type { ConsoleContext } from "./system-console.types"

const guest = new GuestProfileProvider()

const context = (): ConsoleContext => ({
  profile: guest,
  preferences: {
    get: () => null,
    set: () => undefined,
    remove: () => undefined,
  },
  content: {
    async listMaterials() {
      return [{ slug: "physics/orbit", title: "Движение по окружности", tags: ["physics"] }]
    },
  },
  systems: {
    currentTheme: () => "dark",
    setTheme: () => true,
    openGraph: () => true,
    openSearch: () => true,
    player: () => null,
    focusMode: () => null,
    navigate: () => undefined,
    prefersReducedMotion: () => false,
  },
})

describe("system console parser", () => {
  test("parses quoted arguments without implementing shell syntax", () => {
    assert.deepEqual(parseCommand('search "теорема пифагора"'), {
      name: "search",
      args: ["теорема пифагора"],
      raw: 'search "теорема пифагора"',
    })
  })

  test("returns a readable error for an unfinished quote", () => {
    assert.deepEqual(parseCommand('open "рекурсия'), {
      error: "Unclosed quote.",
      raw: 'open "рекурсия',
    })
  })
})

describe("system console registry", () => {
  const registry = createCommandRegistry()

  test("builds autocomplete from commands and their subcommands", () => {
    assert.deepEqual(completeCommand("th", registry), {
      value: "theme",
      suggestions: ["theme"],
    })
    assert.deepEqual(completeCommand("player p", registry), {
      value: "player p",
      suggestions: ["pause", "play", "previous"],
    })
  })

  test("keeps hidden commands out of help-facing registry entries", () => {
    assert.equal(registry.find((command) => command.name === "meaning")?.hidden, true)
    assert.equal(
      registry.filter((command) => !command.hidden).some((command) => command.name === "meaning"),
      false,
    )
  })

  test("renders help as plain terminal text without profile badges", async () => {
    const result = await executeCommand("help", registry, context())
    assert.equal(result.type, "list")
    if (result.type !== "list") return
    assert.equal(result.title, undefined)
    assert.equal(
      result.sections.flatMap((section) => section.items).some((item) => item.badge),
      false,
    )
  })

  test("guest profile commands never fabricate student data", async () => {
    const result = await executeCommand("progress", registry, context())

    assert.deepEqual(result, {
      type: "error",
      title: "Student profile required.",
      detail: "Current mode: guest",
      code: "PROFILE_REQUIRED",
    })
  })

  test("routes future SQL-like input only through the optional safe query engine", async () => {
    const result = await executeCommand("SELECT * FROM progress", registry, context())

    assert.deepEqual(result, {
      type: "error",
      title: "Query mode unavailable in guest mode.",
      code: "QUERY_UNAVAILABLE",
    })
  })

  test("suggests the nearest allowlisted command instead of throwing", async () => {
    const result = await executeCommand("them", registry, context())

    assert.deepEqual(result, {
      type: "error",
      title: "Unknown command: them",
      detail: "Did you mean `theme`?",
      code: "UNKNOWN_COMMAND",
    })
  })
})

describe("guest profile provider", () => {
  test("returns no user and marks every private dataset unavailable", async () => {
    assert.equal(await guest.getCurrentUser(), null)
    assert.deepEqual(await guest.getProgress(), { available: false, reason: "profile-required" })
    assert.deepEqual(await guest.getInventory(), { available: false, reason: "profile-required" })
  })
})
