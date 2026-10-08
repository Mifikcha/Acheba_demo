import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { runInNewContext } from "node:vm"
import { buildSync } from "esbuild"

const source = readFileSync(new URL("./python-checker.inline.ts", import.meta.url), "utf8")
const script = buildSync({
  stdin: {
    contents: `${source}\nglobalThis.runPythonForTest = runPython`,
    loader: "ts",
    resolveDir: dirname(fileURLToPath(import.meta.url)),
  },
  bundle: true,
  write: false,
  format: "iife",
}).outputFiles[0].text

function harness(bootDelay: number, runDelay: number | null, bootDeadline = 60000) {
  const listeners = new Set<(event: { data: unknown }) => void>()
  let workerSource = ""
  let terminated = false

  class FakeBlob {
    constructor(parts: string[]) {
      workerSource = parts.join("")
    }
  }

  class FakeWorker {
    constructor(_url: string) {}

    addEventListener(_type: string, listener: (event: { data: unknown }) => void) {
      listeners.add(listener)
    }

    removeEventListener(_type: string, listener: (event: { data: unknown }) => void) {
      listeners.delete(listener)
    }

    postMessage(data: unknown) {
      const self = {
        onmessage: undefined as undefined | ((event: { data: unknown }) => void),
        postMessage: (reply: unknown) => {
          if (!terminated) for (const listener of listeners) listener({ data: reply })
        },
      }
      runInNewContext(workerSource, {
        self,
        importScripts: () => undefined,
        loadPyodide: (options: { indexURL: string }) => {
          assert.equal(options.indexURL, "https://demo.test/Acheba_demo/static/pyodide/")
          return new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  globals: { set: () => undefined },
                  runPythonAsync: () =>
                    runDelay === null
                      ? new Promise(() => undefined)
                      : new Promise((resolveRun) =>
                          setTimeout(
                            () =>
                              resolveRun(
                                JSON.stringify({
                                  stdout: "ok",
                                  stderr: "",
                                  passed: [],
                                  failed: [],
                                  codeOk: true,
                                }),
                              ),
                            runDelay,
                          ),
                        ),
                }),
              bootDelay,
            ),
          )
        },
      })
      self.onmessage?.({ data })
    }

    terminate() {
      terminated = true
    }
  }

  const context = {
    Blob: FakeBlob,
    Worker: FakeWorker,
    URL: { createObjectURL: () => "worker", revokeObjectURL: () => undefined },
    document: { addEventListener: () => undefined },
    window: {
      location: { origin: "https://demo.test" },
      setTimeout: (callback: () => void, ms: number) =>
        setTimeout(callback, ms === 60000 ? bootDeadline : ms),
      clearTimeout,
      addCleanup: () => undefined,
    },
  } as Record<string, unknown>
  runInNewContext(script, context)
  return {
    runPython: context.runPythonForTest as (
      code: string,
      tests: string,
      timeoutMs: number,
    ) => Promise<{ stdout: string }>,
    wasTerminated: () => terminated,
  }
}

test("cold Pyodide loading does not consume the code execution limit", async () => {
  const worker = harness(40, 2)
  assert.equal((await worker.runPython('print("ok")', "", 20)).stdout, "ok")
  assert.equal(worker.wasTerminated(), false)
})

test("a running program still stops at its execution limit", async () => {
  const worker = harness(2, null)
  await assert.rejects(worker.runPython("while True: pass", "", 20), /Код выполнялся дольше/)
  assert.equal(worker.wasTerminated(), true)
})

test("a stalled runtime reports a loading error", async () => {
  const worker = harness(100, 2, 20)
  await assert.rejects(worker.runPython('print("ok")', "", 10), /Не удалось загрузить Python/)
  assert.equal(worker.wasTerminated(), true)
})
