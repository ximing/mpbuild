import type { ModuleGraph, OutputPlan } from './types.js'

/** 可 JSON.stringify 的图 + plan 快照。 */
export function formatAnalyzeJson(graph: ModuleGraph, plan: OutputPlan): unknown {
  const nodes = [...graph.nodes.values()]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      owner: node.owner,
      sourcePath: node.sourcePath,
      pageType: node.pageType,
      virtual: node.virtual,
    }))
  return {
    entries: graph.entries,
    packages: graph.packages,
    nodes,
    edges: graph.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      raw: edge.raw,
      rewritePath: edge.rewritePath,
      external: edge.external,
    })),
    placements: plan.placements,
    rewrites: plan.rewrites,
  }
}
