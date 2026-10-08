import assert from "node:assert/strict"
import { test } from "node:test"
import { advanceHeat, createHeatModel, heatFlows, heatEnergy } from "./heat-model"

test("тепло идёт от горячего к холодному, суммарная энергия сохраняется", () => {
  const model = createHeatModel()
  const initialEnergy = heatEnergy(model)
  assert.deepEqual(heatFlows(model).map(({ from, to }) => [from, to]), [[0, 1], [2, 0], [2, 1]])
  advanceHeat(model, 0.5)
  assert.ok(model.temperatures[1] > 20)
  assert.ok(model.temperatures[2] < 80)
  assert.ok(Math.abs(heatEnergy(model) - initialEnergy) < 1e-9)
})

test("все три тела приходят к 65 °C, а поток прекращается", () => {
  const model = createHeatModel()
  for (let i = 0; i < 600; i++) advanceHeat(model, 0.05)
  assert.deepEqual(model.temperatures, [65, 65, 65])
  assert.deepEqual(heatFlows(model), [])
  assert.deepEqual(createHeatModel().temperatures, [60, 20, 80])
})
