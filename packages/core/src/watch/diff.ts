import { topologyFingerprint } from '../graph/fingerprint.js'
import type { ModuleGraph, OutputPlan } from '../types.js'

/** 节点 id、边元组、entries、packages、suite 伴生任一变化则为 true。 */
export function topologyChanged(before: ModuleGraph, after: ModuleGraph): boolean {
  return topologyFingerprint(before) !== topologyFingerprint(after)
}

/** topology 变则为 true；否则比较 placement 三元组与 shared 模块的包集合。 */
export function planChanged(input: {
  topologyChanged: boolean
  before: OutputPlan
  after: OutputPlan
}): boolean {
  if (input.topologyChanged) {
    return true
  }
  return (
    placementFingerprint(input.before) !== placementFingerprint(input.after) ||
    sharedPlacementFingerprint(input.before) !== sharedPlacementFingerprint(input.after)
  )
}

function placementFingerprint(plan: OutputPlan): string {
  return JSON.stringify(
    plan.placements
      .map((placement) => `${placement.moduleId}\0${placement.destPath}\0${placement.package}`)
      .sort(),
  )
}

/** 出现在多个 placement 的模块视为 shared，比较其包集合。 */
function sharedPlacementFingerprint(plan: OutputPlan): string {
  const packagesByModule = new Map<string, Set<string>>()
  for (const placement of plan.placements) {
    let pkgs = packagesByModule.get(placement.moduleId)
    if (!pkgs) {
      pkgs = new Set()
      packagesByModule.set(placement.moduleId, pkgs)
    }
    pkgs.add(placement.package)
  }
  const shared = [...packagesByModule.entries()]
    .filter(([, pkgs]) => pkgs.size > 1)
    .map(([id, pkgs]) => `${id}\0${[...pkgs].sort().join('\0')}`)
    .sort()
  return JSON.stringify(shared)
}
