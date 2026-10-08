import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { runInNewContext } from "node:vm"
import { transformSync } from "esbuild"

const source = readFileSync(new URL("./desmos.inline.ts", import.meta.url), "utf8")
const script = transformSync(source + "\nglobalThis.desmosTest = { initDesmosEmbeds }", {
  loader: "ts",
  format: "cjs",
}).code

function harness() {
  class Element {
    className = ""
    dataset: Record<string, string> = {}
    textContent = ""
    children: Element[] = []
    listeners: Record<string, () => void> = {}
    isConnected = true
    removed = false
    onload?: () => void
    onerror?: () => void
    classList = {
      add: () => undefined,
      remove: () => undefined,
    }

    append(...children: Element[]) {
      this.children.push(...children)
    }

    replaceChildren(...children: Element[]) {
      this.children = children
    }

    querySelector(selector: string): Element | undefined {
      for (const child of this.children) {
        if (selector === ".desmos-stage" && child.className.includes("desmos-stage")) return child
        const found = child.querySelector(selector)
        if (found) return found
      }
    }

    addEventListener(name: string, callback: () => void) {
      this.listeners[name] = callback
    }

    removeEventListener() {}
    setAttribute() {}
    remove() {
      this.removed = true
    }
  }

  const scripts: Element[] = []
  const calculators: { expressions: string[]; destroyed: boolean }[] = []
  const cleanups = new Set<() => void>()
  const listeners: Record<string, () => void> = {}
  let root = new Element()
  root.dataset.expressions = "a=1; y=ax"
  const document = {
    createElement: () => new Element(),
    head: { append: (script: Element) => scripts.push(script) },
    addEventListener: (name: string, callback: () => void) => (listeners[name] = callback),
    querySelectorAll: (selector: string) =>
      selector === ".desmos-embed" ? [root] : [root.querySelector(".desmos-stage")].filter(Boolean),
  }
  const window: {
    Desmos?: { GraphingCalculator: () => unknown }
    addCleanup: (callback: () => void) => void
    setTimeout: typeof setTimeout
    clearTimeout: typeof clearTimeout
  } = {
    addCleanup: (callback) => cleanups.add(callback),
    setTimeout,
    clearTimeout,
  }
  const context = { document, window, exports: {}, module: { exports: {} } } as Record<
    string,
    unknown
  >
  runInNewContext(script, context)

  return {
    scripts,
    calculators,
    cleanups,
    nav: listeners.nav,
    get root() {
      return root
    },
    nextRoot() {
      root = new Element()
      root.dataset.expressions = "a=1; y=ax"
      return root
    },
    finishLoad() {
      window.Desmos = {
        GraphingCalculator: () => {
          const calculator = { expressions: [] as string[], destroyed: false }
          calculators.push(calculator)
          return {
            setExpression: ({ latex }: { latex: string }) => calculator.expressions.push(latex),
            setMathBounds: () => {
              throw new Error("Custom viewport must not be set")
            },
            destroy: () => {
              calculator.destroyed = true
            },
          }
        },
      }
      scripts.at(-1)!.onload!()
    },
    cleanup() {
      for (const cleanup of cleanups) cleanup()
      cleanups.clear()
    },
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

test("failed first load can retry, and each navigation registers cleanup", async () => {
  const app = harness()
  app.nav()
  assert.equal(app.scripts.length, 1)
  app.scripts[0].onerror!()
  await settle()
  assert.equal(app.scripts[0].removed, true)
  assert.equal(app.scripts.length, 2, "first failure should retry automatically")
  app.scripts[0].onerror!() // A late event from the old request must not poison the retry.
  app.scripts[1].onerror!()
  await settle()
  const stage = app.root.querySelector(".desmos-stage")!
  const retry = stage.children.find((child) => child.textContent === "Повторить загрузку")!
  assert.ok(retry)
  retry.listeners.click()
  assert.equal(app.scripts.length, 3)
  app.finishLoad()
  await settle()
  assert.equal(app.root.dataset.desmosReady, "true")
  assert.deepEqual(app.calculators[0].expressions, ["a=1", "y=ax"])

  app.cleanup()
  assert.equal(app.calculators[0].destroyed, true)
  app.nextRoot()
  app.nav()
  await settle()
  assert.equal(app.cleanups.size, 1)
  assert.equal(app.root.dataset.desmosReady, "true")
})

test("a script resolving after SPA cleanup mounts only the new page", async () => {
  const app = harness()
  app.nav()
  const oldRoot = app.root
  app.cleanup()
  oldRoot.isConnected = false
  app.nextRoot()
  app.nav()
  app.finishLoad()
  await settle()
  assert.equal(app.calculators.length, 1)
  assert.equal(oldRoot.dataset.desmosReady, undefined)
  assert.equal(app.root.dataset.desmosReady, "true")
})
