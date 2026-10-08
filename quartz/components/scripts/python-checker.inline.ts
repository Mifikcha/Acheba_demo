import {
  CodingTask,
  completeTask,
  firstIncomplete,
  isUnlocked,
  loadCodingProgress,
  saveCodingProgress,
} from "./coding-tasks"

type PythonRunResult = {
  stdout: string
  stderr: string
  passed: TestResult[]
  failed: TestResult[]
  codeOk: boolean
  errorLine?: number
}

type TestResult = {
  index: number
  code: string
  check: string
  input: string
  expected: string
  actual: string
  message: string
  line?: number
}

type WorkerReply =
  | { id: number; phase: "ready" }
  | { id: number; ok: true; result: PythonRunResult }
  | { id: number; ok: false; error: string }

const pyodideUrl = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js"
const defaultCode = `def solve(x):
    return x * x

print(solve(5))`

const pythonRunner = `
import ast
import contextlib
import io
import json
import re
import traceback

stdout = io.StringIO()
stderr = io.StringIO()
namespace = {"__name__": "__main__"}
tests = [line.strip() for line in (USER_TESTS or "").splitlines() if line.strip()]
passed = []
failed = []
code_ok = True
error_line = None

def short_repr(value, limit=240):
    rendered = repr(value)
    return rendered if len(rendered) <= limit else rendered[:limit - 1] + "…"

def source_line_for_call(expression):
    calls = [node for node in ast.walk(expression) if isinstance(node, ast.Call)]
    names = [node.func.id for node in calls if isinstance(node.func, ast.Name)]
    for line_number, line in enumerate(USER_CODE.splitlines(), 1):
        if any(re.match(rf"\\s*def\\s+{re.escape(name)}\\s*\\(", line) for name in names):
            return line_number
    return None

def inspect_test(test, index):
    detail = {
        "index": index,
        "code": test,
        "check": test.removeprefix("assert ").strip(),
        "input": "",
        "expected": "True",
        "actual": "",
        "message": "",
        "line": None,
    }
    tree = ast.parse(test, mode="exec")
    statement = tree.body[0] if len(tree.body) == 1 else None
    if not isinstance(statement, ast.Assert):
        exec(compile(tree, "<test>", "exec"), namespace)
        detail["actual"] = "выполнено"
        return True, detail

    expression = statement.test
    detail["check"] = ast.unparse(expression)
    detail["line"] = source_line_for_call(expression)
    calls = [ast.unparse(node) for node in ast.walk(expression) if isinstance(node, ast.Call)]
    detail["input"] = ", ".join(dict.fromkeys(calls))

    if (
        isinstance(expression, ast.Compare)
        and len(expression.ops) == 1
        and len(expression.comparators) == 1
        and isinstance(expression.ops[0], (ast.Eq, ast.Is))
    ):
        actual = eval(compile(ast.Expression(expression.left), "<test>", "eval"), namespace)
        expected = eval(
            compile(ast.Expression(expression.comparators[0]), "<test>", "eval"), namespace
        )
        detail["input"] = ast.unparse(expression.left)
        detail["actual"] = short_repr(actual)
        detail["expected"] = short_repr(expected)
        return actual == expected, detail

    actual = bool(eval(compile(ast.Expression(expression), "<test>", "eval"), namespace))
    detail["actual"] = short_repr(actual)
    return actual, detail

try:
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        exec(compile(USER_CODE, "<ученик>", "exec"), namespace)
except Exception as exc:
    code_ok = False
    if isinstance(exc, SyntaxError):
        error_line = exc.lineno
    frames = traceback.extract_tb(exc.__traceback__)
    student_frames = [frame for frame in frames if frame.filename == "<ученик>"]
    if student_frames:
        error_line = student_frames[-1].lineno
    traceback.print_exc(file=stderr)

namespace["__source__"] = USER_CODE
namespace["__output__"] = stdout.getvalue()
namespace["__stderr__"] = stderr.getvalue()

if code_ok and tests:
    for index, test in enumerate(tests, 1):
        detail = {
            "index": index, "code": test, "check": test.removeprefix("assert ").strip(),
            "input": "", "expected": "True", "actual": "не удалось вычислить", "line": None,
        }
        try:
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                ok, detail = inspect_test(test, index)
            if ok:
                passed.append(detail)
            else:
                detail["message"] = "Получено значение, не совпадающее с ожидаемым."
                failed.append(detail)
        except Exception as exc:
            detail["message"] = f"{exc.__class__.__name__}: {exc}"
            failed.append(detail)

json.dumps({
    "stdout": namespace["__output__"],
    "stderr": namespace["__stderr__"],
    "passed": passed,
    "failed": failed,
    "codeOk": code_ok,
    "errorLine": error_line,
}, ensure_ascii=False)
`

const workerSource = `
let runtimePromise;
const runner = ${JSON.stringify(pythonRunner)};

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      importScripts(${JSON.stringify(pyodideUrl)});
      return await loadPyodide();
    })();
  }
  return runtimePromise;
}

self.onmessage = async (event) => {
  const { id, code, tests } = event.data;
  try {
    const pyodide = await loadRuntime();
    self.postMessage({ id, phase: "ready" });
    pyodide.globals.set("USER_CODE", code);
    pyodide.globals.set("USER_TESTS", tests);
    const result = await pyodide.runPythonAsync(runner);
    self.postMessage({ id, ok: true, result: JSON.parse(result) });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: String(error && error.stack ? error.stack : error),
    });
  }
};
`

let worker: Worker | undefined
let workerUrl: string | undefined
let nextRunId = 1

const ensureWorker = () => {
  if (worker) return worker
  const blob = new Blob([workerSource], { type: "text/javascript" })
  workerUrl = URL.createObjectURL(blob)
  worker = new Worker(workerUrl)
  return worker
}

const resetWorker = () => {
  worker?.terminate()
  worker = undefined
  if (workerUrl) URL.revokeObjectURL(workerUrl)
  workerUrl = undefined
}

const runPython = (code: string, tests: string, timeoutMs: number): Promise<PythonRunResult> => {
  const activeWorker = ensureWorker()
  const id = nextRunId++

  return new Promise((resolve, reject) => {
    let timeout = window.setTimeout(() => {
      activeWorker.removeEventListener("message", onMessage)
      resetWorker()
      reject(
        new Error("Не удалось загрузить Python за 60 с. Проверьте соединение и попробуйте снова."),
      )
    }, 60000)

    function onMessage(event: MessageEvent<WorkerReply>) {
      if (event.data.id !== id) return
      if ("phase" in event.data) {
        window.clearTimeout(timeout)
        timeout = window.setTimeout(() => {
          activeWorker.removeEventListener("message", onMessage)
          resetWorker()
          reject(
            new Error(
              `Код выполнялся дольше ${Math.round(timeoutMs / 1000)} с. Выполнение остановлено.`,
            ),
          )
        }, timeoutMs)
        return
      }
      window.clearTimeout(timeout)
      activeWorker.removeEventListener("message", onMessage)
      event.data.ok ? resolve(event.data.result) : reject(new Error(event.data.error))
    }

    activeWorker.addEventListener("message", onMessage)
    activeWorker.postMessage({ id, code, tests })
  })
}

const pythonKeywords = new Set([
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "match",
  "case",
])
const pythonBuiltins = new Set([
  "abs",
  "all",
  "any",
  "bool",
  "dict",
  "enumerate",
  "filter",
  "float",
  "input",
  "int",
  "len",
  "list",
  "map",
  "max",
  "min",
  "open",
  "print",
  "range",
  "reversed",
  "round",
  "set",
  "sorted",
  "str",
  "sum",
  "tuple",
  "type",
  "zip",
])
const pythonConstants = new Set(["True", "False", "None", "NotImplemented", "Ellipsis"])

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const token = (kind: string, value: string) =>
  `<span class="python-token-${kind}" style="display:inline!important">${escapeHtml(value)}</span>`

const highlightPython = (source: string) => {
  let output = ""
  let index = 0

  while (index < source.length) {
    const rest = source.slice(index)
    const char = source[index]

    if (char === "#") {
      const end = source.indexOf("\n", index)
      const value = source.slice(index, end === -1 ? source.length : end)
      output += token("comment", value)
      index += value.length
      continue
    }

    if (char === '"' || char === "'") {
      const triple = source.slice(index, index + 3) === char.repeat(3)
      const delimiter = triple ? char.repeat(3) : char
      let end = index + delimiter.length
      while (end < source.length) {
        if (source[end] === "\\") {
          end += 2
          continue
        }
        if (source.slice(end, end + delimiter.length) === delimiter) {
          end += delimiter.length
          break
        }
        end++
      }
      output += token("string", source.slice(index, end))
      index = end
      continue
    }

    const number = rest.match(
      /^(?:0[xX][\da-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/,
    )?.[0]
    if (number) {
      output += token("number", number)
      index += number.length
      continue
    }

    const identifier = rest.match(/^[A-Za-z_]\w*/)?.[0]
    if (identifier) {
      const kind = pythonKeywords.has(identifier)
        ? "keyword"
        : pythonBuiltins.has(identifier)
          ? "builtin"
          : pythonConstants.has(identifier)
            ? "constant"
            : "plain"
      output += kind === "plain" ? escapeHtml(identifier) : token(kind, identifier)
      index += identifier.length
      continue
    }

    if (/[+\-*/%=<>!&|^~:@]/.test(char)) output += token("operator", char)
    else output += escapeHtml(char)
    index++
  }

  return `${output}\n`
}

const readInitialCode = (root: HTMLElement) => {
  if (root.dataset.code) return root.dataset.code
  const source =
    root.querySelector<HTMLTextAreaElement>("textarea") ??
    root.querySelector<HTMLElement>(".python-checker-code, pre code, code")
  return (source as HTMLTextAreaElement | null)?.value || source?.textContent?.trim() || defaultCode
}

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
) => {
  const element = document.createElement(tagName)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

const createIcon = (path: string) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 24 24")
  svg.setAttribute("aria-hidden", "true")
  const iconPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
  iconPath.setAttribute("d", path)
  svg.append(iconPath)
  return svg
}

const splitExpected = (test: string) => {
  const expression = test.replace(/^assert\s+/, "").trim()
  const equality = expression.match(/^(.+?)\s*==\s*(.+)$/)
  return equality
    ? { check: equality[1].trim(), expected: equality[2].trim() }
    : { check: expression, expected: "True" }
}

const renderTestPlan = (output: HTMLElement, tests: string, hidden = false) => {
  output.innerHTML = ""
  const rows = tests
    .split("\n")
    .map((test) => test.trim())
    .filter(Boolean)

  if (rows.length === 0) {
    output.append(createElement("div", "python-output-empty", "Вывод появится здесь."))
    return
  }

  if (hidden) {
    output.append(
      createElement("div", "python-output-label", "СКРЫТЫЕ ПРОВЕРКИ"),
      createElement(
        "div",
        "python-output-empty",
        `После запуска будет видно, сколько проверок прошло: ${rows.length}.`,
      ),
    )
    return
  }

  output.append(createElement("div", "python-output-label", "ПРОВЕРКИ ДО ЗАПУСКА"))
  rows.forEach((test, index) => {
    const { check, expected } = splitExpected(test)
    const row = createElement("div", "python-test-plan")
    row.append(
      createElement("span", "python-test-index", String(index + 1).padStart(2, "0")),
      createElement("code", "python-test-check", check),
      createElement("span", "python-test-expect", `ожидается ${expected}`),
    )
    output.append(row)
  })
}

const appendOutputBlock = (output: HTMLElement, label: string, value: string) => {
  if (!value.trim()) return
  const block = createElement("section", "python-output-block")
  const renderedValue = createElement("pre", "python-output-value")
  value
    .trimEnd()
    .split("\n")
    .forEach((line, index) => {
      const renderedLine = createElement("span", "python-output-line", line)
      renderedLine.style.animationDelay = `${Math.min(index * 34, 340)}ms`
      renderedValue.append(renderedLine)
    })
  block.append(createElement("div", "python-output-label", label), renderedValue)
  output.append(block)
}

const renderResult = (output: HTMLElement, result: PythonRunResult, hiddenTests = false) => {
  output.innerHTML = ""
  appendOutputBlock(output, "PROGRAM OUTPUT", result.stdout)
  appendOutputBlock(output, "PYTHON ERROR", result.stderr)

  const total = result.passed.length + result.failed.length
  if (total > 0) {
    const summary = createElement("section", "python-test-summary")
    const summaryLine = createElement("div", "python-test-summary-line")
    summaryLine.append(
      createElement("strong", undefined, `${result.passed.length} / ${total} TESTS PASSED`),
      createElement("span", undefined, result.failed.length ? "FAILED" : "DONE"),
    )
    const progress = createElement("span", "python-test-progress")
    progress.style.setProperty("--python-test-progress", `${(result.passed.length / total) * 100}%`)
    summary.append(summaryLine, progress)
    output.append(summary)

    if (hiddenTests) return

    for (const test of [...result.failed, ...result.passed]) {
      const row = createElement(
        "section",
        `python-test-result ${result.failed.includes(test) ? "is-failed" : "is-passed"}`,
      )
      row.append(
        createElement(
          "strong",
          "python-test-result-title",
          `TEST ${test.index} · ${result.failed.includes(test) ? "FAILED" : "PASSED"}`,
        ),
        createElement("code", "python-test-result-check", test.check),
      )
      if (test.input) row.append(createElement("div", undefined, `Подставляется: ${test.input}`))
      row.append(
        createElement("div", undefined, `Ожидалось: ${test.expected}`),
        createElement("div", undefined, `Получено: ${test.actual}`),
      )
      if (test.message) row.append(createElement("div", "python-test-message", test.message))
      output.append(row)
    }
  }

  if (output.childElementCount === 0)
    output.append(createElement("div", "python-output-empty", "Код выполнен без вывода."))
}

const initPythonChecker = (root: HTMLElement) => {
  if (root.dataset.pythonReady === "true") return
  root.dataset.pythonReady = "true"

  const initialCode = readInitialCode(root)
  const tests = root.dataset.tests ?? ""
  const hiddenTests = root.dataset.hiddenTests === "true"
  const timeoutMs = Number(root.dataset.timeout ?? 8000)
  const lessonLayout = root.dataset.layout === "lesson"
  let tasks: CodingTask[] = []
  try {
    const parsed = JSON.parse(root.dataset.tasks ?? "[]")
    if (
      Array.isArray(parsed) &&
      parsed.length > 1 &&
      parsed.every(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.prompt === "string" &&
          typeof item.starterCode === "string" &&
          typeof item.tests === "string" &&
          item.tests.trim().length > 0,
      )
    )
      tasks = parsed
  } catch {
    // Invalid authored task data falls back to the original single challenge.
  }
  const lesson = root.dataset.lesson ?? ""
  let progress = loadCodingProgress(lesson, localStorage)
  let activeIndex = tasks.length ? firstIncomplete(tasks, progress.completed) : 0
  root.innerHTML = ""

  const header = createElement("div", "python-checker-header")
  const titleGroup = createElement("div", "python-checker-title")
  const languageDot = createElement("span", "python-language-dot")
  const title = createElement("strong", undefined, root.dataset.title ?? "Проверка Python")
  const lineCount = createElement("span", "python-line-count")
  titleGroup.append(languageDot, title, lineCount)

  const controls = createElement("div", "python-checker-controls")
  const runButton = createElement("button", "python-checker-run") as HTMLButtonElement
  runButton.type = "button"
  const runIcon = createIcon("m5 3 14 9-14 9V3z")
  const runIconPath = runIcon.querySelector("path")!
  runButton.append(runIcon, createElement("span", undefined, "Запустить"))
  const resetButton = createElement("button", "python-checker-reset") as HTMLButtonElement
  resetButton.type = "button"
  resetButton.title = "Сбросить код"
  resetButton.setAttribute("aria-label", "Сбросить код")
  resetButton.append(createIcon("M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"))
  controls.append(runButton, resetButton)
  header.append(titleGroup, controls)

  const task =
    root.dataset.task || tasks.length
      ? createElement("div", "python-checker-task", root.dataset.task)
      : undefined
  const taskLabel = tasks.length ? createElement("small", "python-task-label") : undefined
  const taskPrompt = tasks.length ? createElement("span", "python-task-prompt") : undefined
  const taskHint = tasks.length ? createElement("details", "python-task-hint") : undefined
  if (task && taskLabel && taskPrompt && taskHint)
    task.replaceChildren(taskLabel, taskPrompt, taskHint)
  const rail = tasks.length ? createElement("nav", "python-task-rail") : undefined
  if (rail) rail.setAttribute("aria-label", "Задачи урока")

  const editorShell = createElement("div", "python-editor-shell")
  const lineNumbersViewport = createElement("div", "python-line-numbers-viewport")
  lineNumbersViewport.setAttribute("aria-hidden", "true")
  const lineNumbers = createElement("div", "python-line-numbers")
  lineNumbersViewport.append(lineNumbers)
  const editorStack = createElement("div", "python-editor-stack")
  const activeLine = createElement("div", "python-active-line")
  const errorLine = createElement("div", "python-error-line")
  errorLine.hidden = true
  const highlight = createElement("pre", "python-checker-highlight")
  highlight.setAttribute("aria-hidden", "true")
  const highlightedCode = createElement("code")
  highlight.append(highlightedCode)
  const editor = createElement("textarea", "python-checker-editor") as HTMLTextAreaElement
  editor.value = initialCode
  editor.spellcheck = false
  editor.autocomplete = "off"
  editor.setAttribute("autocapitalize", "off")
  editor.setAttribute("aria-label", "Python-код")
  editorStack.append(activeLine, errorLine, highlight, editor)
  editorShell.append(lineNumbersViewport, editorStack)

  const consolePanel = createElement("section", "python-console")
  const consoleSplitter = lessonLayout ? createElement("div", "python-console-splitter") : undefined
  if (consoleSplitter) {
    consoleSplitter.setAttribute("role", "separator")
    consoleSplitter.setAttribute("aria-label", "Изменить высоту редактора и консоли")
    consoleSplitter.setAttribute("aria-orientation", "horizontal")
    consoleSplitter.setAttribute("aria-valuemin", "35")
    consoleSplitter.setAttribute("aria-valuemax", "78")
    consoleSplitter.setAttribute("aria-valuenow", "67")
    consoleSplitter.tabIndex = 0
    consoleSplitter.append(createElement("span"))
  }
  const consoleHeader = createElement("div", "python-console-header")
  const consoleTitle = createElement("strong", undefined, "STDOUT")
  const status = createElement("span", "python-checker-status", "READY")
  consoleHeader.append(consoleTitle, status)
  const output = createElement("div", "python-checker-output")
  output.setAttribute("aria-live", "polite")
  consolePanel.append(consoleHeader, output)
  let currentErrorLine: number | undefined

  const lineMetrics = () => {
    const styles = getComputedStyle(editor)
    return {
      lineHeight: Number.parseFloat(styles.lineHeight),
      paddingTop: Number.parseFloat(styles.paddingTop),
    }
  }

  const syncEditor = () => {
    highlightedCode.innerHTML = highlightPython(editor.value)
    const count = Math.max(1, editor.value.split("\n").length)
    lineNumbers.textContent = Array.from({ length: count }, (_, index) => String(index + 1)).join(
      "\n",
    )
    const nextLineCount = `${count} LOC`
    if (lineCount.textContent && lineCount.textContent !== nextLineCount) {
      lineCount.classList.remove("is-updated")
      void lineCount.offsetWidth
      lineCount.classList.add("is-updated")
    }
    lineCount.textContent = nextLineCount
    highlight.scrollTop = editor.scrollTop
    highlight.scrollLeft = editor.scrollLeft
    lineNumbers.style.transform = `translateY(${-editor.scrollTop}px)`
    const { lineHeight, paddingTop } = lineMetrics()
    const line = editor.value.slice(0, editor.selectionStart).split("\n").length - 1
    activeLine.style.transform = `translateY(${paddingTop + line * lineHeight - editor.scrollTop}px)`
    if (currentErrorLine)
      errorLine.style.transform = `translateY(${paddingTop + (currentErrorLine - 1) * lineHeight - editor.scrollTop}px)`
  }

  const markErrorLine = (line?: number) => {
    currentErrorLine = line
    if (!line) {
      errorLine.hidden = true
      return
    }
    errorLine.hidden = false
    syncEditor()
  }

  const initConsoleSplitter = (splitter: HTMLElement) => {
    const setRatio = (ratio: number) => {
      const top = editorShell.getBoundingClientRect().top
      const bottom = consolePanel.getBoundingClientRect().bottom
      const available = bottom - top - splitter.getBoundingClientRect().height
      if (available <= 0) return
      const minimum = Math.min(35, (176 / available) * 100)
      const maximum = Math.max(minimum, Math.min(78, ((available - 112) / available) * 100))
      const clamped = Math.min(maximum, Math.max(minimum, ratio))
      root.style.setProperty("--python-editor-height", `${(available * clamped) / 100}px`)
      splitter.setAttribute("aria-valuemin", String(Math.round(minimum)))
      splitter.setAttribute("aria-valuemax", String(Math.round(maximum)))
      splitter.setAttribute("aria-valuenow", String(Math.round(clamped)))
    }
    const reset = () => {
      root.style.removeProperty("--python-editor-height")
      requestAnimationFrame(() => {
        const editorHeight = editorShell.getBoundingClientRect().height
        const total = editorHeight + consolePanel.getBoundingClientRect().height
        if (total > 0)
          splitter.setAttribute("aria-valuenow", String(Math.round((editorHeight / total) * 100)))
      })
    }
    const updateFromPointer = (clientY: number) => {
      const top = editorShell.getBoundingClientRect().top
      const bottom = consolePanel.getBoundingClientRect().bottom
      const available = bottom - top - splitter.getBoundingClientRect().height
      setRatio(((clientY - top) / available) * 100)
    }
    const stopDragging = () => {
      root.removeAttribute("data-console-resizing")
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", stopDragging)
    }
    const onPointerMove = (event: PointerEvent) => updateFromPointer(event.clientY)

    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault()
      root.dataset.consoleResizing = "true"
      updateFromPointer(event.clientY)
      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", stopDragging, { once: true })
    })
    splitter.addEventListener("dblclick", reset)
    splitter.addEventListener("keydown", (event) => {
      const current = Number(splitter.getAttribute("aria-valuenow") ?? 67)
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        setRatio(current + (event.key === "ArrowDown" ? 5 : -5))
      } else if (event.key === "Home") {
        event.preventDefault()
        reset()
      }
    })
    reset()
  }

  const setRunning = (isRunning: boolean) => {
    runButton.disabled = isRunning
    resetButton.disabled = isRunning
    editor.disabled = isRunning
    if (rail)
      rail.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.disabled = isRunning || button.dataset.locked === "true"
      })
    runButton.dataset.running = String(isRunning)
    runIconPath.setAttribute(
      "d",
      isRunning ? "M12 3a9 9 0 1 1-8.3 5.5M4 4v4h4" : "m5 3 14 9-14 9V3z",
    )
    if (isRunning) {
      root.dataset.state = "loading"
      status.textContent = "RUNNING"
    }
    runButton.querySelector("span")!.textContent = isRunning ? "Запуск..." : "Запустить"
  }

  const execute = async () => {
    const runIndex = activeIndex
    const runCode = editor.value
    const activeTests = tasks.length ? tasks[runIndex].tests : tests
    setRunning(true)
    output.innerHTML = ""
    output.append(
      createElement("div", "python-output-loading", "Загрузка Python и запуск тестов..."),
    )
    markErrorLine()
    try {
      const result = await runPython(runCode, activeTests, timeoutMs)
      const failed =
        result.failed.length > 0 ||
        !result.codeOk ||
        (tasks.length > 0 && result.passed.length === 0)
      root.dataset.state = failed ? "error" : "success"
      status.textContent = failed ? "ERROR" : "PASS"
      renderResult(output, result, hiddenTests)
      markErrorLine(result.errorLine ?? result.failed.find((test) => test.line)?.line)
      if (!failed && tasks.length) {
        progress = completeTask(tasks, progress, runIndex)
        saveCodingProgress(lesson, progress, localStorage)
        renderTaskState()
        if (runIndex < tasks.length - 1) {
          window.setTimeout(() => {
            if (activeIndex === runIndex && editor.value === runCode) selectTask(runIndex + 1)
          }, 900)
        }
      }
    } catch (error) {
      root.dataset.state = "error"
      status.textContent = "ERROR"
      output.innerHTML = ""
      appendOutputBlock(
        output,
        "RUNTIME ERROR",
        error instanceof Error ? error.message : String(error),
      )
    } finally {
      setRunning(false)
    }
  }

  editor.addEventListener("input", () => {
    syncEditor()
    if (tasks.length) {
      progress.drafts[tasks[activeIndex].id] = editor.value
      saveCodingProgress(lesson, progress, localStorage)
    }
  })
  editor.addEventListener("scroll", syncEditor)
  editor.addEventListener("click", syncEditor)
  editor.addEventListener("keyup", syncEditor)
  editor.addEventListener("select", syncEditor)
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault()
      const start = editor.selectionStart
      editor.setRangeText("    ", start, editor.selectionEnd, "end")
      syncEditor()
    } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault()
      void execute()
    }
  })
  runButton.addEventListener("click", () => void execute())
  resetButton.addEventListener("click", () => {
    editor.value = tasks.length ? tasks[activeIndex].starterCode : initialCode
    if (tasks.length) {
      delete progress.drafts[tasks[activeIndex].id]
      saveCodingProgress(lesson, progress, localStorage)
    }
    renderTestPlan(output, tasks.length ? tasks[activeIndex].tests : tests, hiddenTests)
    status.textContent = "READY"
    root.dataset.state = "idle"
    markErrorLine()
    syncEditor()
    editor.focus()
  })

  const renderTaskState = () => {
    if (!rail || !taskLabel || !taskPrompt) return
    rail.replaceChildren(createElement("span", "python-task-rail-caption", "PRACTICE"))
    tasks.forEach((item, index) => {
      const completed = progress.completed.includes(item.id)
      const unlocked = isUnlocked(tasks, progress.completed, index)
      const current = index === activeIndex
      const button = createElement("button", "python-task-step") as HTMLButtonElement
      button.type = "button"
      button.dataset.locked = String(!unlocked)
      button.disabled = !unlocked
      button.setAttribute("aria-current", current ? "step" : "false")
      const name = index === tasks.length - 1 ? "Итог" : `Практика ${index + 1}`
      const state = completed
        ? "выполнена"
        : current
          ? "текущая"
          : unlocked
            ? "доступна"
            : "закрыта"
      button.setAttribute("aria-label", `${name} — ${state}`)
      button.title = unlocked
        ? `${name}: ${item.title || item.prompt}`
        : "Сначала заверши предыдущую практику"
      button.append(
        createElement(
          "span",
          undefined,
          index === tasks.length - 1 ? "FINAL" : String(index + 1).padStart(2, "0"),
        ),
        createElement(
          "span",
          "python-task-mark",
          completed ? "✓" : unlocked ? (current ? "●" : "○") : "🔒",
        ),
      )
      button.addEventListener("click", () => selectTask(index))
      rail.append(button)
    })
    const currentStep = rail.querySelector<HTMLElement>('[aria-current="step"]')
    if (currentStep) {
      const stepBounds = currentStep.getBoundingClientRect()
      const railBounds = rail.getBoundingClientRect()
      if (stepBounds.right > railBounds.right) rail.scrollLeft += stepBounds.right - railBounds.right
      if (stepBounds.left < railBounds.left) rail.scrollLeft -= railBounds.left - stepBounds.left
    }
    const final = activeIndex === tasks.length - 1
    taskLabel.textContent = final
      ? "FINAL CHALLENGE"
      : `PRACTICE ${String(activeIndex + 1).padStart(2, "0")} / ${String(tasks.length - 1).padStart(2, "0")}`
    taskPrompt.textContent = tasks[activeIndex].prompt
    if (taskHint) {
      taskHint.replaceChildren()
      if (tasks[activeIndex].hint) {
        taskHint.append(
          createElement("summary", undefined, "Подсказка"),
          createElement("span", undefined, tasks[activeIndex].hint),
        )
        taskHint.hidden = false
        taskHint.open = false
      } else taskHint.hidden = true
    }
    const leftCount = document.querySelector<HTMLElement>("[data-practice-progress]")
    if (leftCount)
      leftCount.textContent = `${progress.completed.filter((id) => id !== "final").length} / ${tasks.length - 1} выполнено`
    document.querySelectorAll<HTMLAnchorElement>("[data-coding-next]").forEach((link) => {
      const locked = !progress.completed.includes("final")
      link.setAttribute("aria-disabled", String(locked))
      link.tabIndex = locked ? -1 : 0
      link.title = locked ? "Сначала заверши итоговое задание" : ""
    })
  }

  const selectTask = (index: number) => {
    if (!tasks.length || !isUnlocked(tasks, progress.completed, index)) return
    activeIndex = index
    const item = tasks[index]
    editor.value = progress.drafts[item.id] ?? item.starterCode
    root.dataset.state = "idle"
    status.textContent = "READY"
    markErrorLine()
    syncEditor()
    renderTestPlan(output, item.tests, hiddenTests)
    renderTaskState()
    editor.focus({ preventScroll: true })
  }

  if (tasks.length) {
    const heading = [
      ...document.querySelectorAll<HTMLElement>(".coding-lesson-reading article h3"),
    ].find((element) => element.textContent?.trim() === "Задачи")
    if (heading?.nextElementSibling?.tagName === "OL") {
      const summary = createElement("section", "coding-practice-summary")
      const headingText = createElement("h3", undefined, "Практика")
      const detail = createElement(
        "p",
        undefined,
        "Короткие упражнения закрепят тему. Затем откроется итоговое задание.",
      )
      const count = createElement("span", "coding-practice-progress")
      count.dataset.practiceProgress = ""
      const action = createElement(
        "button",
        "coding-practice-action",
        "Перейти к текущей задаче →",
      ) as HTMLButtonElement
      action.type = "button"
      action.addEventListener("click", () => {
        selectTask(firstIncomplete(tasks, progress.completed))
        if (matchMedia("(max-width: 900px)").matches)
          root.scrollIntoView({ behavior: "smooth", block: "start" })
        editor.focus({ preventScroll: true })
      })
      summary.append(headingText, detail, count, action)
      let sibling: Element | null = heading.nextElementSibling
      while (sibling && !/^H[1-3]$/.test(sibling.tagName)) {
        const next: Element | null = sibling.nextElementSibling
        sibling.remove()
        sibling = next
      }
      heading.replaceWith(summary)
    }
    document.querySelectorAll<HTMLAnchorElement>("[data-coding-next]").forEach((link) =>
      link.addEventListener("click", (event) => {
        if (!progress.completed.includes("final")) event.preventDefault()
      }),
    )
  }

  root.classList.add("python-checker-enhanced")
  root.append(header)
  if (rail) root.append(rail)
  if (task) root.append(task)
  root.append(editorShell)
  if (consoleSplitter) {
    root.append(consoleSplitter)
    initConsoleSplitter(consoleSplitter)
  }
  root.append(consolePanel)
  if (!lessonLayout) root.classList.add("python-checker-inline")
  syncEditor()
  if (tasks.length) selectTask(activeIndex)
  else renderTestPlan(output, tests, hiddenTests)
}

const runnablePrompt = /^(?:запусти|попробуй)(?=\s|:)/i

const enhanceRunnableExamples = () => {
  document.querySelectorAll<HTMLElement>(".coding-lesson-reading article p").forEach((prompt) => {
    if (!runnablePrompt.test(prompt.textContent?.trim() ?? "")) return

    const block = prompt.nextElementSibling
    const code = block?.matches("pre, figure[data-rehype-pretty-code-figure]")
      ? block.querySelector("code")
      : null
    if (!block || !code || block.nextElementSibling?.classList.contains("python-run-example"))
      return

    const checker = createElement("div", "python-checker python-run-example")
    checker.dataset.title = "Пример"
    checker.dataset.code = code.textContent?.trim() ?? ""
    block.replaceWith(checker)
  })
}

const initPythonCheckers = () => {
  enhanceRunnableExamples()
  document.querySelectorAll<HTMLElement>(".python-checker").forEach(initPythonChecker)
  initCodingSplitter()
}

const initCodingSplitter = () => {
  document.querySelectorAll<HTMLElement>(".coding-lesson-split").forEach((split) => {
    const splitter = split.querySelector<HTMLElement>(".coding-splitter")
    if (!splitter || splitter.dataset.ready === "true") return
    splitter.dataset.ready = "true"

    const setRatio = (ratio: number) => {
      const width = split.getBoundingClientRect().width
      if (width < 900) {
        split.style.setProperty("--coding-reading-width", "50%")
        return
      }
      const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
      const minimum = Math.max(32, ((22 * rootSize) / width) * 100)
      const maximum = Math.min(68, ((width - 28 * rootSize - 0.7 * rootSize) / width) * 100)
      const clamped = Math.min(maximum, Math.max(minimum, ratio))
      split.style.setProperty("--coding-reading-width", `${clamped}%`)
      splitter.setAttribute("aria-valuemin", String(Math.ceil(minimum)))
      splitter.setAttribute("aria-valuemax", String(Math.floor(maximum)))
      splitter.setAttribute("aria-valuenow", String(Math.round(clamped)))
    }
    const updateFromPointer = (clientX: number) => {
      const bounds = split.getBoundingClientRect()
      setRatio(((clientX - bounds.left) / bounds.width) * 100)
    }
    const stopDragging = () => {
      split.removeAttribute("data-resizing")
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", stopDragging)
    }
    const onPointerMove = (event: PointerEvent) => updateFromPointer(event.clientX)

    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault()
      split.dataset.resizing = "true"
      updateFromPointer(event.clientX)
      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", stopDragging, { once: true })
    })
    splitter.addEventListener("dblclick", () => setRatio(50))
    splitter.addEventListener("keydown", (event) => {
      const current = Number(splitter.getAttribute("aria-valuenow") ?? 50)
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault()
        setRatio(current + (event.key === "ArrowRight" ? 4 : -4))
      } else if (event.key === "Home") {
        event.preventDefault()
        setRatio(50)
      }
    })
    setRatio(50)
  })
}

document.addEventListener("nav", initPythonCheckers)
window.addCleanup?.(resetWorker)
