export function visibleRoots(k: number): number[] {
  const discriminant = k * k - 4
  if (discriminant < -1e-9) return []
  const offset = Math.sqrt(Math.max(0, discriminant))
  const roots = offset < 1e-9 ? [-k / 2] : [(-k - offset) / 2, (-k + offset) / 2]
  return roots.filter((x) => Math.abs(x - 2) > 1e-9)
}
