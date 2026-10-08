export type Vector = { x: number; y: number }
export type Parameters = { radius: number; omega: number; tangential: number }

const referenceRadius = 2.8

export function angularVelocity(radius: number, referenceOmega: number, direction: 1 | -1) {
  return direction * referenceOmega * (referenceRadius / radius) ** 2
}

export function rotationDirection(tangential: number, previous: 1 | -1): 1 | -1 {
  return tangential === 0 ? previous : tangential > 0 ? 1 : -1
}

export function advanceAngle(angle: number, omega: number, seconds: number) {
  const turn = 2 * Math.PI
  return (((angle + omega * seconds) % turn) + turn) % turn
}

export function circleVectors(angle: number, { radius, omega, tangential }: Parameters) {
  const radial = { x: Math.cos(angle), y: Math.sin(angle) }
  const tangent = { x: -radial.y, y: radial.x }
  const position = { x: radius * radial.x, y: radius * radial.y }
  const velocity = { x: omega * radius * tangent.x, y: omega * radius * tangent.y }
  const normal = { x: -(omega ** 2) * position.x, y: -(omega ** 2) * position.y }
  const tangentialVector = { x: tangential * tangent.x, y: tangential * tangent.y }
  const total = { x: normal.x + tangentialVector.x, y: normal.y + tangentialVector.y }
  return { position, velocity, normal, tangential: tangentialVector, total }
}
