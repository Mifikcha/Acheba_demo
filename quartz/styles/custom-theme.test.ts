import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const scss = await readFile(new URL("./custom.scss", import.meta.url), "utf8")
const config = await readFile(new URL("../../quartz.config.yaml", import.meta.url), "utf8")

const themeBlock = (theme: "dark" | "light") => {
  const match = scss.match(new RegExp(`:root\\[saved-theme="${theme}"\\] \\{([\\s\\S]*?)\\n\\}`))
  assert.ok(match, `${theme} theme block is present`)
  return match[1]
}

const componentBlock = (selector: string) => {
  const matches = [...scss.matchAll(new RegExp(`\\.${selector} \\{([\\s\\S]*?)\\n\\}`, "g"))]
  assert.ok(matches.length, `${selector} block is present`)
  return matches.at(-1)![1]
}

const property = (source: string, name: string) => {
  const match = source.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))
  assert.ok(match, `${name} is a six-digit hex color`)
  return match[1]
}

const luminance = (hex: string) => {
  const [red, green, blue] = hex
    .slice(1)
    .match(/../g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

test("light palette stays light while reducing the paper-white glare", () => {
  const base = property(scss, "--ap-light-base")
  assert.ok(luminance(base) >= 0.8 && luminance(base) <= 0.87)
  assert.match(config, new RegExp(`light:\\s*"${base}"`, "i"))
})

test("console and sandbox inherit semantic colors from both themes", () => {
  for (const theme of ["dark", "light"] as const) {
    const block = themeBlock(theme)
    for (const token of [
      "--console-surface",
      "--console-foreground",
      "--console-muted",
      "--console-accent",
      "--console-error",
      "--console-selection",
    ]) {
      assert.match(block, new RegExp(`${token}:`))
    }
  }

  const consoleBlock = componentBlock("home-system-console")
  assert.doesNotMatch(
    consoleBlock,
    /--console-(?:surface|foreground|muted|accent|error|selection):/,
  )

  const sandboxBlock = [...scss.matchAll(/\.home-python-sandbox \{([\s\S]*?)\n\}/g)].find((match) =>
    match[1].includes("--console-surface"),
  )?.[1]
  assert.ok(sandboxBlock, "sandbox has a theme-aware visual block")
  assert.doesNotMatch(sandboxBlock, /#121420|#0f111c|#272c40|#c7cbea|#aeb7e8/i)

  const light = themeBlock("light")
  const surface = property(light, "--console-surface")
  assert.ok(contrast(property(light, "--console-muted"), surface) >= 4.5)
  assert.ok(contrast(property(light, "--console-accent"), surface) >= 4.5)
})

test("homepage art has theme-aware card and hero treatments", () => {
  const light = themeBlock("light")
  assert.match(light, /--home-scene-ink:/)
  assert.match(light, /--home-scene-accent:/)
  assert.match(scss, /:root\[saved-theme="light"\] \.home-program-raster-visual::before/)
  assert.match(scss, /mask:\s*var\(--home-program-image\)/)

  const starField = componentBlock("home-star-field circle")
  assert.match(starField, /var\(--home-scene-ink\)/)
})
