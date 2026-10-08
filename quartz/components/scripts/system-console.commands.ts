import type {
  CommandCategory,
  ConsoleCommand,
  ConsoleResult,
  ContentMaterial,
} from "./system-console.types"

const themeName = (theme: "dark" | "light") => (theme === "dark" ? "Tokyo Night" : "Light")
const slugHref = (slug: string) => `/${slug.replace(/^\//, "")}`

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("ru")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
}

function findMaterials(materials: ContentMaterial[], query: string): ContentMaterial[] {
  const needle = normalize(query)
  return materials
    .filter((material) =>
      normalize(`${material.title} ${material.slug.replaceAll("-", " ")}`).includes(needle),
    )
    .slice(0, 5)
}

function usage(usageText: string): ConsoleResult {
  return { type: "error", title: `Usage: ${usageText}`, code: "INVALID_USAGE" }
}

function unavailable(system: string): ConsoleResult {
  return { type: "error", title: `${system} unavailable.` }
}

export function createCommandRegistry(): ConsoleCommand[] {
  let registry: ConsoleCommand[] = []

  const profileCommands = (
    [
      ["progress", "student progress"],
      ["today", "today's study state"],
      ["weak", "topics needing attention"],
      ["strong", "strongest topics"],
      ["mistakes", "recent mistakes"],
      ["bookmarks", "saved materials"],
      ["achievements", "earned achievements"],
      ["inventory", "unlocked system features"],
      ["streak", "study consistency"],
      ["stats", "student statistics"],
    ] as const
  ).map<ConsoleCommand>(([name, description]) => ({
    name,
    description,
    category: "PROFILE",
    requiresProfile: true,
    execute: (context) => {
      if (name in (context.analytics ?? {})) {
        const method =
          context.analytics?.[
            name as "progress" | "today" | "weak" | "strong" | "mistakes" | "stats"
          ]
        if (method) return method.call(context.analytics)
      }
      return unavailable(`${name} provider`)
    },
  }))

  registry = [
    {
      name: "help",
      aliases: ["?"],
      description: "available system commands",
      category: "SYSTEM",
      execute: () => {
        const categories: CommandCategory[] = [
          "SYSTEM",
          "INTERFACE",
          "STUDY",
          "PROFILE",
          "NAVIGATION",
        ]
        return {
          type: "list",
          sections: categories.map((category) => ({
            title: category,
            items: registry
              .filter((command) => command.category === category && !command.hidden)
              .map((command) => ({
                label: command.name,
                detail: command.description,
              })),
          })),
        }
      },
    },
    {
      name: "clear",
      aliases: ["cls"],
      description: "clear console output",
      category: "SYSTEM",
      execute: () => ({ type: "system", title: "Output cleared.", rows: [], action: "clear" }),
    },
    {
      name: "whoami",
      description: "current profile",
      category: "SYSTEM",
      execute: async ({ profile }) => {
        const user = await profile.getCurrentUser()
        return user
          ? { type: "text", title: user.displayName, lines: ["student profile connected"] }
          : { type: "text", title: "guest", lines: ["student profile not connected"] }
      },
    },
    {
      name: "status",
      description: "real system capabilities",
      category: "SYSTEM",
      execute: async ({ content, profile, systems }) => {
        let materials: ContentMaterial[] = []
        let contentOnline = false
        try {
          materials = await content.listMaterials()
          contentOnline = true
        } catch {}
        const player = systems.player()
        return {
          type: "system",
          title: "H&D SYSTEM",
          rows: [
            {
              label: "content",
              value: contentOnline ? "online" : "unavailable",
              state: contentOnline ? "ready" : "unavailable",
            },
            {
              label: "graph",
              value: document.querySelector(".global-graph-icon") ? "ready" : "unavailable",
              state: document.querySelector(".global-graph-icon") ? "ready" : "unavailable",
            },
            {
              label: "sandbox",
              value: materials.some((item) => item.slug === "песочница-python")
                ? "ready"
                : "unavailable",
              state: materials.some((item) => item.slug === "песочница-python")
                ? "ready"
                : "unavailable",
            },
            {
              label: "audio",
              value: player ? player.snapshot().state : "unavailable",
              state: player ? "ready" : "unavailable",
            },
            { label: "profile", value: profile.mode, state: "neutral" },
          ],
        }
      },
    },
    {
      name: "about",
      description: "about Hopes and Dreams",
      category: "SYSTEM",
      execute: () => ({
        type: "text",
        title: "Hopes and Dreams",
        lines: [
          "Учебная среда по физике, математике и информатике.",
          "Console controls the system; the Student Shell comes next.",
        ],
      }),
    },
    {
      name: "theme",
      description: "inspect or change site theme",
      category: "INTERFACE",
      usage: "theme [list|dark|light]",
      subcommands: ["dark", "light", "list"],
      execute: ({ systems }, args) => {
        const requested = args[0]?.toLowerCase()
        if (!requested)
          return {
            type: "text",
            title: themeName(systems.currentTheme()),
            lines: ["current site theme"],
          }
        if (requested === "list") {
          const current = systems.currentTheme()
          return {
            type: "list",
            title: "THEMES",
            sections: [
              {
                items: [
                  { label: "Tokyo Night", badge: current === "dark" ? "current" : undefined },
                  { label: "Light", badge: current === "light" ? "current" : undefined },
                ],
              },
            ],
          }
        }
        if (requested !== "dark" && requested !== "light") return usage("theme [list|dark|light]")
        return systems.setTheme(requested)
          ? { type: "text", title: `Theme changed: ${themeName(requested)}`, lines: [] }
          : unavailable("Theme control")
      },
    },
    {
      name: "settings",
      description: "interface settings and capabilities",
      category: "INTERFACE",
      execute: ({ profile, systems }) => ({
        type: "system",
        title: "SYSTEM SETTINGS",
        rows: [
          { label: "theme", value: themeName(systems.currentTheme()), state: "ready" },
          { label: "motion", value: systems.currentMotion?.() ?? "system", state: "ready" },
          {
            label: "player",
            value: systems.player() ? "ready" : "unavailable",
            state: systems.player() ? "ready" : "unavailable",
          },
          {
            label: "graph",
            value: document.querySelector(".global-graph-icon") ? "ready" : "unavailable",
            state: document.querySelector(".global-graph-icon") ? "ready" : "unavailable",
          },
          {
            label: "focus",
            value: systems.focusMode() ? "ready" : "unavailable",
            state: systems.focusMode() ? "ready" : "unavailable",
          },
          { label: "profile", value: profile.mode, state: "neutral" },
        ],
      }),
    },
    {
      name: "motion",
      description: "ambient motion preference",
      category: "INTERFACE",
      usage: "motion [system|reduce]",
      subcommands: ["reduce", "system"],
      execute: ({ preferences, systems }, args) => {
        const requested = args[0]?.toLowerCase()
        if (!requested) {
          const current = systems.prefersReducedMotion()
            ? "reduce (OS)"
            : (systems.currentMotion?.() ?? "system")
          return { type: "text", title: `current: ${current}`, lines: [] }
        }
        if (requested !== "system" && requested !== "reduce") return usage("motion [system|reduce]")
        systems.setMotion?.(requested)
        if (requested === "system") preferences.remove("motion")
        else preferences.set("motion", requested)
        return {
          type: "text",
          title: `motion: ${requested}`,
          lines: [
            systems.prefersReducedMotion()
              ? "OS reduced-motion remains respected."
              : "preference saved locally",
          ],
        }
      },
    },
    {
      name: "player",
      description: "control the existing study player",
      category: "INTERFACE",
      usage: "player [play|pause|previous|next|volume N]",
      subcommands: ["play", "pause", "previous", "next", "volume"],
      execute: async ({ systems }, args) => {
        const player = systems.player()
        if (!player) return unavailable("Player")
        const action = args[0]?.toLowerCase()
        if (!action) {
          const snapshot = player.snapshot()
          return {
            type: "system",
            title: "STUDY PLAYER",
            rows: [
              {
                label: "track",
                value: snapshot.title,
                state: snapshot.error ? "unavailable" : "ready",
              },
              { label: "state", value: snapshot.state, state: "neutral" },
              { label: "volume", value: `${Math.round(snapshot.volume * 100)}%`, state: "neutral" },
            ],
          }
        }
        if (action === "play") await player.play()
        else if (action === "pause") player.pause()
        else if (action === "previous") player.previous()
        else if (action === "next") player.next()
        else if (action === "volume") {
          const volume = Number(args[1])
          if (!Number.isFinite(volume) || volume < 0 || volume > 100)
            return usage("player volume 0..100")
          player.setVolume(volume / 100)
        } else return usage("player [play|pause|previous|next|volume N]")
        const snapshot = player.snapshot()
        return {
          type: "text",
          title: `player: ${snapshot.state}`,
          lines: [snapshot.title, `volume: ${Math.round(snapshot.volume * 100)}%`],
        }
      },
    },
    {
      name: "focus",
      description: "focus mode",
      category: "INTERFACE",
      usage: "focus [on|off]",
      subcommands: ["off", "on"],
      execute: ({ systems }, args) => {
        const focus = systems.focusMode()
        if (!focus) return unavailable("Focus mode")
        const requested = args[0]?.toLowerCase()
        if (!requested) return { type: "text", title: `focus: ${focus.snapshot()}`, lines: [] }
        if (requested !== "on" && requested !== "off") return usage("focus [on|off]")
        focus.set(requested === "on")
        return { type: "text", title: `focus: ${requested}`, lines: [] }
      },
    },
    {
      name: "sidebar",
      description: "sidebar layout control",
      category: "INTERFACE",
      subcommands: ["compact", "normal"],
      hidden: true,
      execute: () => unavailable("Sidebar layout control"),
    },
    {
      name: "random",
      description: "discover a public study material",
      category: "STUDY",
      execute: async ({ content }) => {
        const materials = await content.listMaterials()
        if (materials.length === 0) return unavailable("Content index")
        const material = materials[Math.floor(Math.random() * materials.length)]
        return {
          type: "navigation",
          eyebrow: "FOUND / MATERIAL",
          title: material.title,
          href: slugHref(material.slug),
          detail: "OPEN",
        }
      },
    },
    {
      name: "continue",
      description: "resume the last local study page",
      category: "STUDY",
      execute: ({ preferences }) => {
        const previous = preferences.get<{ slug: string; title: string }>("lastStudyPage")
        return previous
          ? {
              type: "navigation",
              eyebrow: "CONTINUE",
              title: previous.title,
              href: slugHref(previous.slug),
              detail: "RESUME",
            }
          : { type: "text", title: "No previous study session.", lines: [] }
      },
    },
    {
      name: "graph",
      description: "open the existing knowledge map",
      category: "STUDY",
      execute: ({ systems }) =>
        systems.openGraph()
          ? { type: "text", title: "Opening knowledge map…", lines: [] }
          : unavailable("Knowledge map"),
    },
    ...profileCommands,
    {
      name: "open",
      description: "open a known material",
      category: "NAVIGATION",
      usage: "open <material>",
      execute: async ({ content }, args) => {
        if (args.length === 0) return usage("open <material>")
        const matches = findMaterials(await content.listMaterials(), args.join(" "))
        if (matches.length === 0)
          return { type: "error", title: "No matching material.", detail: "Try `search <query>`." }
        if (matches.length === 1) {
          const material = matches[0]
          return {
            type: "navigation",
            eyebrow: "FOUND / MATERIAL",
            title: material.title,
            href: slugHref(material.slug),
            detail: "OPEN",
          }
        }
        return {
          type: "list",
          title: `FOUND ${matches.length} MATERIALS`,
          sections: [
            {
              items: matches.map((material, index) => ({
                label: `${index + 1}  ${material.title}`,
                href: slugHref(material.slug),
              })),
            },
          ],
        }
      },
    },
    {
      name: "search",
      aliases: ["find"],
      description: "open the existing Quartz search",
      category: "NAVIGATION",
      usage: "search [query]",
      execute: ({ systems }, args) =>
        systems.openSearch(args.join(" "))
          ? { type: "text", title: "Quartz search opened.", lines: [] }
          : unavailable("Search"),
    },
    {
      name: "meaning",
      description: "the answer",
      category: "FUN",
      hidden: true,
      execute: () => ({ type: "text", title: "42", lines: [] }),
    },
    {
      name: "sudo",
      description: "request elevated privileges",
      category: "FUN",
      hidden: true,
      execute: (_context, args) => ({
        type: "text",
        title: args.join(" ").toLowerCase() === "unlock all" ? "Nice try." : "Permission denied.",
        lines: [],
      }),
    },
    {
      name: "rm",
      description: "absolutely not a shell",
      category: "FUN",
      hidden: true,
      execute: () => ({ type: "text", title: "You have enough problems already.", lines: [] }),
    },
    {
      name: "give",
      description: "ask for a score",
      category: "FUN",
      hidden: true,
      execute: () => ({ type: "text", title: "Study harder.", lines: [] }),
    },
    {
      name: "dream",
      description: "stay determined",
      category: "FUN",
      hidden: true,
      execute: () => ({ type: "text", title: "Stay determined.", lines: [] }),
    },
  ]

  return registry
}
