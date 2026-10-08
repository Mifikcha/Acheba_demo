import assert from "node:assert/strict"
import { test } from "node:test"
import { advanceModel, createModel } from "./mkt-model"

test("сброс воспроизводит исходное состояние и броуновская частица движется", () => {
  const model = createModel("brownian")
  const initial = createModel("brownian")
  assert.deepEqual(model.particles, initial.particles)
  for (let i = 0; i < 600; i++) advanceModel(model, 1 / 60, 1)
  assert.notDeepEqual(model.tracer, initial.tracer)
  assert.ok(model.trail.length > 2 && model.trail.length <= 140)
  assert.ok(model.particles.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1))
})

test("при диффузии обе группы пересекают исходную границу", () => {
  const model = createModel("diffusion")
  for (let i = 0; i < 1200; i++) advanceModel(model, 1 / 60, 1)
  assert.ok(model.particles.some((p) => p.group === 0 && p.x > 0.5))
  assert.ok(model.particles.some((p) => p.group === 1 && p.x < 0.5))
})
