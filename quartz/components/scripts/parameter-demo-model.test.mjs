import assert from "node:assert/strict"
import { test } from "node:test"
import { visibleRoots } from "./parameter-demo-model.ts"

test("the removed point changes the number of intersections", () => {
  assert.deepEqual(visibleRoots(-2.5), [0.5])
  assert.deepEqual(visibleRoots(-2), [1])
  assert.deepEqual(visibleRoots(2), [-1])
  assert.deepEqual(visibleRoots(0), [])
  assert.equal(visibleRoots(-3).length, 2)
})
