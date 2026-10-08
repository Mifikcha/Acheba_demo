export type HeatModel = { temperatures: [number, number, number]; elapsed: number }

const capacities = [3, 1, 4] as const
const equilibrium = 65

export function createHeatModel(): HeatModel {
  return { temperatures: [60, 20, 80], elapsed: 0 }
}

export function heatEnergy(model: HeatModel): number {
  return model.temperatures.reduce((sum, temperature, index) => sum + temperature * capacities[index], 0)
}

export function heatFlows(model: HeatModel): { from: number; to: number }[] {
  return ([[0, 1], [2, 0], [2, 1]] as const).flatMap(([a, b]) => {
    const difference = model.temperatures[a] - model.temperatures[b]
    return Math.abs(difference) < 0.001 ? [] : [{ from: difference > 0 ? a : b, to: difference > 0 ? b : a }]
  })
}

export function advanceHeat(model: HeatModel, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return
  model.elapsed += seconds
  const fraction = Math.exp(-0.55 * seconds)
  model.temperatures = model.temperatures.map((temperature) => equilibrium + (temperature - equilibrium) * fraction) as HeatModel["temperatures"]
  if (model.temperatures.every((temperature) => Math.abs(temperature - equilibrium) < 0.1)) {
    model.temperatures = [equilibrium, equilibrium, equilibrium]
  }
}
