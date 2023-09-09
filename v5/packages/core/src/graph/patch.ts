import { dirname, resolve } from 'node:path'
import type { AliasValue, SubProject } from '../config/schema.js'
import type { Diagnostic } from '../diagnostic/index.js'
import {
  EdgeKinds,
  type ModuleGraph,
  type PackageInfo,
  type TargetAdapter,
} from '../types.js'
import { companionPath } from './suite.js'
import {
  addSuiteEdge,
  attachVirtualAppJson,
  drainQueue,
  enqueue,
  intern,
  posixRelative,
  processModule,
  suiteEdgeKind,
  type GraphWalk,
} from './walk.js'

export async function applyGraphChange(opts: {
  graph: ModuleGraph
  srcDir: string
  rootDir: string
  adapter: TargetAdapter
  alias?: Record<string, AliasValue>
  projects?: SubProject[]
  skipAppJsonPages?: boolean
  changedIds: string[] // src-relative，文件仍在
  deletedIds: string[] // src-relative，文件已删
  addedRelPaths: string[] // src-relative，新出现的文件（可能尚未入图）
}): Promise<{ graph: ModuleGraph; diagnostics: Diagnostic[]; topologyChanged: boolean }> {
  const { graph, srcDir, adapter, alias, projects, changedIds, deletedIds, addedRelPaths } = opts
  const skipAppJsonPages = opts.skipAppJsonPages === true
  const before = topologyFingerprint(graph)
  const walk: GraphWalk = {
    srcDir,
    adapter,
    alias,
    projects,
    nodes: graph.nodes,
    edges: graph.edges,
    entries: graph.entries,
    packages: graph.packages,
    diagnostics: [],
    visited: new Set(),
    queue: [],
    skipAppJsonPages,
  }

  removeDeleted(walk, deletedIds)

  const existed = new Set(walk.nodes.keys())
  for (const id of existed) {
    walk.visited.add(id)
  }

  attachAddedCompanions(walk, addedRelPaths)

  for (const id of changedIds) {
    if (!existed.has(id) || !walk.nodes.has(id)) {
      continue
    }
    dropOutgoing(walk, id)
    await processModule(walk, id)
    removeFromQueue(walk, id)
  }

  await drainQueue(walk)
  if (skipAppJsonPages) {
    attachVirtualAppJson(walk)
  }
  gcUnreachable(walk)

  return {
    graph,
    diagnostics: walk.diagnostics,
    topologyChanged: topologyFingerprint(graph) !== before,
  }
}

function removeDeleted(walk: GraphWalk, deletedIds: string[]): void {
  const deleted = new Set(deletedIds)
  for (const id of deleted) {
    walk.nodes.delete(id)
  }
  replaceArray(
    walk.edges,
    walk.edges.filter((edge) => !deleted.has(edge.from) && !deleted.has(edge.to)),
  )
  replaceArray(
    walk.entries,
    walk.entries.filter((id) => !deleted.has(id)),
  )
}

function attachAddedCompanions(walk: GraphWalk, addedRelPaths: string[]): void {
  const { adapter, srcDir } = walk
  for (const rel of addedRelPaths) {
    const id = rel.split(/[\\/]/).join('/')
    const abs = resolve(srcDir, ...id.split('/'))
    const addedDir = dirname(abs)
    for (const node of [...walk.nodes.values()]) {
      if (node.kind !== 'script' || dirname(node.sourcePath) !== addedDir) {
        continue
      }
      for (const slot of Object.keys(adapter.suite) as Array<keyof TargetAdapter['suite']>) {
        if (slot === 'script') {
          continue
        }
        const companionKind = adapter.suite[slot]
        if (companionKind === 'script') {
          continue
        }
        if (walk.skipAppJsonPages && node.pageType === 'app' && companionKind === 'json') {
          continue
        }
        const hit = companionPath(node.sourcePath, companionKind, adapter)
        if (!hit || posixRelative(srcDir, hit) !== id) {
          continue
        }
        const kind = suiteEdgeKind(node, walk.edges)
        const to = intern(walk, hit)
        const exists = walk.edges.some(
          (edge) => edge.from === node.id && edge.to === to && edge.kind === kind,
        )
        if (!exists) {
          addSuiteEdge(walk, node, hit, kind)
        } else {
          enqueue(walk, to)
        }
        break
      }
    }
  }
}

function dropOutgoing(walk: GraphWalk, id: string): void {
  replaceArray(
    walk.edges,
    walk.edges.filter((edge) => edge.from !== id),
  )
}

function removeFromQueue(walk: GraphWalk, id: string): void {
  replaceArray(
    walk.queue,
    walk.queue.filter((queued) => queued !== id),
  )
}

/** 从 entries 沿非 external 边走，删不可达节点及其边。 */
function gcUnreachable(walk: GraphWalk): void {
  const reachable = new Set<string>()
  const queue: string[] = []
  for (const id of walk.entries) {
    if (walk.nodes.has(id)) {
      queue.push(id)
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined || reachable.has(id)) {
      continue
    }
    reachable.add(id)
    for (const edge of walk.edges) {
      if (edge.from === id && !edge.external && walk.nodes.has(edge.to) && !reachable.has(edge.to)) {
        queue.push(edge.to)
      }
    }
  }
  for (const id of [...walk.nodes.keys()]) {
    if (!reachable.has(id)) {
      walk.nodes.delete(id)
    }
  }
  replaceArray(
    walk.edges,
    walk.edges.filter(
      (edge) => walk.nodes.has(edge.from) && (edge.external || walk.nodes.has(edge.to)),
    ),
  )
  replaceArray(
    walk.entries,
    walk.entries.filter((id) => walk.nodes.has(id)),
  )
}

function topologyFingerprint(graph: ModuleGraph): string {
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

function replaceArray<T>(target: T[], next: T[]): void {
  target.length = 0
  target.push(...next)
}
