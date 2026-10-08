import assert from "node:assert/strict"
import { test } from "node:test"
import { advanceVapor, createVaporModel, surfaceY } from "./vapor-model"

test("сброс воспроизводим, а число молекул сохраняется при переходах", () => {
  const a = createVaporModel()
  const b = createVaporModel()
  assert.deepEqual(a.particles, b.particles)
  for (let i = 0; i < 600; i++) advanceVapor(a, 0.05, 1)
  assert.equal(a.particles.length, b.particles.length)
  assert.ok(a.evaporated > 0 && a.condensed > 0)
  assert.ok(a.particles.every((p) => p.phase === "vapor" ? p.y < surfaceY : p.y > surfaceY))
  assert.ok(a.events.every((event) => a.elapsed - event.time < 8))
})

test("более высокая температура оставляет больше молекул в паре", () => {
  const cold = createVaporModel()
  const hot = createVaporModel()
  for (let i = 0; i < 400; i++) {
    advanceVapor(cold, 0.05, 0.5)
    advanceVapor(hot, 0.05, 2)
  }
  const vaporCount = (model: ReturnType<typeof createVaporModel>) => model.particles.filter((p) => p.phase === "vapor").length
  assert.ok(vaporCount(hot) > vaporCount(cold))
})
