import assert from "node:assert/strict"
import test from "node:test"
import {
  CodingTask,
  completeTask,
  emptyProgress,
  firstIncomplete,
  isUnlocked,
  loadCodingProgress,
  saveCodingProgress,
} from "./coding-tasks"

const tasks: CodingTask[] = ["p1", "p2", "p3", "final"].map((id) => ({
  id,
  prompt: id,
  starterCode: "",
  tests: "assert True",
}))

test("practice unlocks in order and final follows all practice", () => {
  let progress = emptyProgress()
  assert.equal(firstIncomplete(tasks, progress.completed), 0)
  assert.equal(isUnlocked(tasks, progress.completed, 3), false)
  assert.deepEqual(completeTask(tasks, progress, 2), progress)
  for (let index = 0; index < tasks.length; index++) {
    assert.equal(isUnlocked(tasks, progress.completed, index), true)
    progress = completeTask(tasks, progress, index)
    assert.equal(firstIncomplete(tasks, progress.completed), Math.min(index + 1, 3))
  }
  assert.deepEqual(progress.completed, ["p1", "p2", "p3", "final"])
  assert.equal(isUnlocked(tasks, progress.completed, 0), true)
})

test("zero practice starts on final, one practice gates final", () => {
  assert.equal(firstIncomplete(tasks.slice(-1), []), 0)
  assert.equal(isUnlocked(tasks.slice(-1), [], 0), true)
  assert.equal(isUnlocked([tasks[0], tasks[3]], [], 1), false)
  assert.equal(isUnlocked([tasks[0], tasks[3]], ["p1"], 1), true)
})

test("drafts and completion survive reload and reset affects one draft", () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  const progress = completeTask(tasks, emptyProgress(), 0)
  progress.drafts.p1 = "print('A')"
  progress.drafts.p2 = "print('B')"
  saveCodingProgress("lesson", progress, storage)
  const loaded = loadCodingProgress("lesson", storage)
  assert.equal(firstIncomplete(tasks, loaded.completed), 1)
  assert.equal(loaded.drafts.p2, "print('B')")
  delete loaded.drafts.p1
  saveCodingProgress("lesson", loaded, storage)
  assert.deepEqual(loadCodingProgress("lesson", storage).drafts, { p2: "print('B')" })
  assert.deepEqual(loadCodingProgress("other", storage), emptyProgress())
})
