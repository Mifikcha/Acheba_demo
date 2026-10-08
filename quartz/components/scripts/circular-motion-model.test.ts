import assert from "node:assert/strict"
import { test } from "node:test"
import { advanceAngle, angularVelocity, circleVectors, rotationDirection } from "./circular-motion-model"

test("скорость касательна, нормальное ускорение направлено к центру", () => {
  const vectors = circleVectors(Math.PI / 3, { radius: 2, omega: 1.5, tangential: -0.8 })
  const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y
  assert.ok(Math.abs(dot(vectors.position, vectors.velocity)) < 1e-10)
  assert.ok(dot(vectors.position, vectors.normal) < 0)
  assert.ok(Math.abs(dot(vectors.position, vectors.tangential)) < 1e-10)
  assert.ok(Math.abs(vectors.velocity.x - 2 * 1.5 * -Math.sin(Math.PI / 3)) < 1e-10)
  assert.ok(Math.abs(vectors.normal.x + 2 * 1.5 ** 2 * Math.cos(Math.PI / 3)) < 1e-10)
  assert.ok(Math.abs(vectors.total.x - vectors.normal.x - vectors.tangential.x) < 1e-10)
  assert.ok(Math.abs(vectors.total.y - vectors.normal.y - vectors.tangential.y) < 1e-10)
})

test("угол непрерывно растёт против часовой стрелки и зацикливается", () => {
  const afterTurn = advanceAngle(2 * Math.PI - 0.1, 1, 0.2)
  assert.ok(afterTurn > 0 && afterTurn < 0.11)
  assert.equal(advanceAngle(0, 2, 0), 0)
})

test("уменьшение радиуса повышает линейную скорость при постоянном моменте импульса", () => {
  const outer = circleVectors(0, { radius: 3, omega: angularVelocity(3, 1.2, 1), tangential: 1 })
  const inner = circleVectors(0, { radius: 1.5, omega: angularVelocity(1.5, 1.2, 1), tangential: 1 })
  assert.ok(Math.hypot(inner.velocity.x, inner.velocity.y) > Math.hypot(outer.velocity.x, outer.velocity.y))
  assert.ok(Math.abs(Math.hypot(inner.velocity.x, inner.velocity.y) / Math.hypot(outer.velocity.x, outer.velocity.y) - 2) < 1e-10)
  assert.ok(Math.abs(Math.hypot(inner.normal.x, inner.normal.y) - Math.hypot(inner.velocity.x, inner.velocity.y) ** 2 / 1.5) < 1e-10)
})

test("знак тангенциального параметра сразу разворачивает движение; ноль сохраняет направление", () => {
  assert.equal(rotationDirection(-1, 1), -1)
  assert.equal(rotationDirection(0, -1), -1)
  assert.equal(rotationDirection(1, -1), 1)
  const clockwise = angularVelocity(2.8, 1.2, -1)
  assert.ok(clockwise < 0)
  assert.ok(advanceAngle(1, clockwise, 0.1) < 1)
})
