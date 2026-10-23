// watch 与 patch 必须共用这份图身份。
import { EdgeKinds, type ModuleGraph, type PackageInfo } from '../types.js'

export function topologyFingerprint(graph: ModuleGraph): string {
  const nodeIds = [...graph.nodes.keys()].sort()
  const edgeTuples = graph.edges
    .map((edge) => `${edge.from}\0${edge.to}\0${edge.kind}\0${edge.raw}`)
    .sort()
  const entries = [...graph.entries].sort()
  const packages = graph.packages.map((pkg) => packageKey(pkg)).sort()
  const suites = nodeIds.map((id) => {
    const companions = graph.edges
      .filter(
        (edge) =>
          edge.from === id &&
          (edge.kind === EdgeKinds.pageSuite || edge.kind === EdgeKinds.componentSuite),
      )
      .map((edge) => edge.to)
      .sort()
    return `${id}\0${companions.join('\0')}`
  })
  return JSON.stringify({ nodeIds, edgeTuples, entries, packages, suites })
}

function packageKey(pkg: PackageInfo): string {
  return `${pkg.root}\0${pkg.independent === true ? '1' : '0'}`
}
