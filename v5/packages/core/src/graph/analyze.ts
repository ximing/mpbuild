import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import type { Edge, ModuleGraph, PackageInfo, TargetAdapter } from '../types.js'

/** 多源染色写 owner，检测环与独立分包越界。禁止增删节点和边。 */
export function analyzeGraph(
  graph: ModuleGraph,
  packages: PackageInfo[],
  adapter: TargetAdapter,
): { graph: ModuleGraph; diagnostics: Diagnostic[] } {
  graph.packages = packages.slice()
  stainOwners(graph, packages)

  const diagnostics: Diagnostic[] = []
  if (hasOwnershipCycle(graph)) {
    diagnostics.push(
      diagnostic({
        code: 'CYCLE',
        severity: 'warning',
        message: 'circular dependency',
      }),
    )
  }
  if (adapter.independentEdge !== 'ignore') {
    pushIndependentPackageEdges(graph, packages, adapter.independentEdge, diagnostics)
  }
  return { graph, diagnostics }
}

/** 闭包只沿非 external 且 affectsOwnership !== false 的边。未知 EdgeKind 默认参与。 */
function walksOwnership(edge: Edge): boolean {
  return edge.external !== true && edge.affectsOwnership !== false
}

function inSubpackage(id: string, root: string): boolean {
  return id === root || id.startsWith(`${root}/`)
}

/** 主包 root === ''：不属于任何非空 root 的路径前缀。 */
function inMain(id: string, packages: PackageInfo[]): boolean {
  return packages.every((pkg) => pkg.root === '' || !inSubpackage(id, pkg.root))
}

function entryBelongsTo(id: string, pkg: PackageInfo, packages: PackageInfo[]): boolean {
  if (pkg.root === '') {
    return inMain(id, packages)
  }
  return inSubpackage(id, pkg.root)
}

/** 一次多源染色：各包 entry 入队，按包 root 记录触及集，再写 owner。禁止递归 DFS。 */
function stainOwners(graph: ModuleGraph, packages: PackageInfo[]): void {
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (!walksOwnership(edge) || !graph.nodes.has(edge.to)) {
      continue
    }
    const list = outgoing.get(edge.from)
    if (list) {
      list.push(edge.to)
    } else {
      outgoing.set(edge.from, [edge.to])
    }
  }

  const touched = new Map<string, Set<string>>()
  const queue: Array<{ id: string; root: string }> = []

  const mark = (id: string, root: string): boolean => {
    let set = touched.get(id)
    if (!set) {
      set = new Set()
      touched.set(id, set)
    }
    if (set.has(root)) {
      return false
    }
    set.add(root)
    return true
  }

  for (const pkg of packages) {
    for (const entry of graph.entries) {
      if (!graph.nodes.has(entry) || !entryBelongsTo(entry, pkg, packages)) {
        continue
      }
      if (mark(entry, pkg.root)) {
        queue.push({ id: entry, root: pkg.root })
      }
    }
  }

  while (queue.length > 0) {
    const item = queue.shift()
    if (item === undefined) {
      break
    }
    for (const to of outgoing.get(item.id) ?? []) {
      if (mark(to, item.root)) {
        queue.push({ id: to, root: item.root })
      }
    }
  }

  for (const [id, node] of graph.nodes) {
    const roots = touched.get(id)
    if (!roots || roots.size === 0) {
      continue
    }
    if (roots.has('')) {
      node.owner = 'main'
    } else if (roots.size === 1) {
      const only = roots.values().next().value
      if (only !== undefined) {
        node.owner = only
      }
    } else {
      node.owner = 'shared'
    }
  }
}

function hasOwnershipCycle(graph: ModuleGraph): boolean {
  const indegree = new Map<string, number>()
  const outgoing = new Map<string, string[]>()
  for (const id of graph.nodes.keys()) {
    indegree.set(id, 0)
    outgoing.set(id, [])
  }
  for (const edge of graph.edges) {
    if (!walksOwnership(edge) || !graph.nodes.has(edge.from) || !graph.nodes.has(edge.to)) {
      continue
    }
    outgoing.get(edge.from)?.push(edge.to)
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of indegree) {
    if (deg === 0) {
      queue.push(id)
    }
  }
  let seen = 0
  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined) {
      break
    }
    seen += 1
    for (const to of outgoing.get(id) ?? []) {
      const next = (indegree.get(to) ?? 0) - 1
      indegree.set(to, next)
      if (next === 0) {
        queue.push(to)
      }
    }
  }
  return seen < graph.nodes.size
}

/** 独立分包越界按路径前缀判断，不按 owner（owner 在染色之后才写完）。 */
function pushIndependentPackageEdges(
  graph: ModuleGraph,
  packages: PackageInfo[],
  severity: 'error' | 'warning',
  diagnostics: Diagnostic[],
): void {
  const independents = packages.filter((pkg) => pkg.independent === true && pkg.root !== '')
  if (independents.length === 0) {
    return
  }
  for (const edge of graph.edges) {
    if (!walksOwnership(edge)) {
      continue
    }
    const fromMain = inMain(edge.from, packages)
    const toMain = inMain(edge.to, packages)
    for (const pkg of independents) {
      const fromHere = inSubpackage(edge.from, pkg.root)
      const toHere = inSubpackage(edge.to, pkg.root)
      if ((fromHere && toMain) || (toHere && fromMain)) {
        diagnostics.push(
          diagnostic({
            code: 'INDEPENDENT_PACKAGE_EDGE',
            severity,
            message: `independent package '${pkg.root}' has an ownership-affecting edge to/from main (${edge.from} -> ${edge.to})`,
            file: edge.from,
          }),
        )
        break
      }
    }
  }
}
