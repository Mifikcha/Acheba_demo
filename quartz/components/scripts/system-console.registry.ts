import type {
  ConsoleCommand,
  ConsoleContext,
  ConsoleResult,
  ParsedCommand,
} from "./system-console.types"

export function parseCommand(input: string): ParsedCommand {
  const raw = input.trim()
  const tokens: string[] = []
  let token = ""
  let quote: '"' | "'" | null = null
  let escaped = false

  for (const character of raw) {
    if (escaped) {
      token += character
      escaped = false
    } else if (character === "\\" && quote) {
      escaped = true
    } else if (quote) {
      if (character === quote) quote = null
      else token += character
    } else if (character === '"' || character === "'") {
      quote = character
    } else if (/\s/u.test(character)) {
      if (token) tokens.push(token)
      token = ""
    } else {
      token += character
    }
  }

  if (quote) return { error: "Unclosed quote.", raw }
  if (escaped) token += "\\"
  if (token) tokens.push(token)

  return {
    name: (tokens.shift() ?? "").toLowerCase(),
    args: tokens,
    raw,
  }
}

function findCommand(
  name: string,
  registry: readonly ConsoleCommand[],
): ConsoleCommand | undefined {
  return registry.find((command) => command.name === name || command.aliases?.includes(name))
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= right.length; j++) {
      const current = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[right.length]
}

function nearestCommand(name: string, registry: readonly ConsoleCommand[]): string | null {
  const candidates = registry.filter((command) => !command.hidden).map((command) => command.name)
  const nearest = candidates
    .map((candidate) => ({ candidate, distance: editDistance(name, candidate) }))
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))[0]
  return nearest && nearest.distance <= Math.max(1, Math.floor(name.length / 3))
    ? nearest.candidate
    : null
}

export function completeCommand(
  input: string,
  registry: readonly ConsoleCommand[],
): { value: string; suggestions: string[] } {
  const trailingSpace = /\s$/u.test(input)
  const parsed = parseCommand(input)
  if ("error" in parsed) return { value: input, suggestions: [] }

  const visible = registry.filter((command) => !command.hidden)
  if (parsed.args.length === 0 && !trailingSpace) {
    const suggestions = visible
      .map((command) => command.name)
      .filter((name) => name.startsWith(parsed.name))
      .sort()
      .slice(0, 5)
    return {
      value: suggestions.length === 1 ? suggestions[0] : input,
      suggestions,
    }
  }

  const command = findCommand(parsed.name, visible)
  if (!command?.subcommands) return { value: input, suggestions: [] }
  const prefix = trailingSpace ? "" : (parsed.args.at(-1)?.toLowerCase() ?? "")
  const suggestions = command.subcommands
    .filter((subcommand) => subcommand.startsWith(prefix))
    .sort()
    .slice(0, 5)
  const value =
    suggestions.length === 1
      ? `${command.name} ${[...parsed.args.slice(0, trailingSpace ? parsed.args.length : -1), suggestions[0]].join(" ")}`
      : input
  return { value, suggestions }
}

export async function executeCommand(
  input: string,
  registry: readonly ConsoleCommand[],
  context: ConsoleContext,
): Promise<ConsoleResult> {
  const raw = input.trim()
  if (/^select\b/iu.test(raw)) {
    return context.queryEngine
      ? context.queryEngine.execute(raw, context)
      : {
          type: "error",
          title: "Query mode unavailable in guest mode.",
          code: "QUERY_UNAVAILABLE",
        }
  }

  const parsed = parseCommand(raw)
  if ("error" in parsed) {
    return { type: "error", title: parsed.error, code: "INVALID_USAGE" }
  }
  if (!parsed.name) {
    return { type: "text", lines: ["Type `help` to inspect the system."] }
  }

  const command = findCommand(parsed.name, registry)
  if (!command) {
    const suggestion = nearestCommand(parsed.name, registry)
    return {
      type: "error",
      title: `Unknown command: ${parsed.name}`,
      detail: suggestion ? `Did you mean \`${suggestion}\`?` : "Try `help`.",
      code: "UNKNOWN_COMMAND",
    }
  }

  if (command.requiresProfile && (await context.profile.getCurrentUser()) === null) {
    return {
      type: "error",
      title: "Student profile required.",
      detail: `Current mode: ${context.profile.mode}`,
      code: "PROFILE_REQUIRED",
    }
  }

  try {
    return await command.execute(context, parsed.args)
  } catch {
    return {
      type: "error",
      title: "Command failed safely.",
      detail: "Try again or run `status`.",
    }
  }
}
