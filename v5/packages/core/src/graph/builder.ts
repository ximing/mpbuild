import { basename, isAbsolute, resolve } from 'node:path'
import type { Diagnostic } from '../diagnostic/index.js'
import type { ModuleGraph, TargetAdapter } from '../types.js'
import {
  drainQueue,
  enqueue,
  intern,
  isAppScriptId,
  tryResolve,
  type GraphWalk,
} from './walk.js'

export interface BuildGraphOptions {
  rootDir: string
  srcDir: string
  adapter: TargetAdapter
  entryScripts: string[] // 绝对或相对 rootDir 的 script 路径
  alias?: Record<string, string>
}

/** 从 entry 入队，按最终 id BFS；环边照常写入，不递归 process。 */
export async function buildGraph(opts: BuildGraphOptions): Promise<{
  graph: ModuleGraph
  diagnostics: Diagnostic[]
}> {
  const { rootDir, srcDir, adapter, entryScripts, alias } = opts
  const walk: GraphWalk = {
    srcDir,
    adapter,
    alias,
    nodes: new Map(),
    edges: [],
    entries: [],
    packages: [],
    diagnostics: [],
    visited: new Set(),
    queue: [],
  }

  for (const entry of entryScripts) {
    // `/` 在 resolveId 里相对 srcDir；入口先归一到绝对路径，再发 `./basename`
    const abs = isAbsolute(entry) ? entry : resolve(rootDir, entry)
    const result = tryResolve(walk, {
      request: `./${basename(abs)}`,
      importer: abs,
      kind: 'script',
    })
    if (!result || result.external) {
      continue
    }
    const id = intern(walk, result.id)
    const entryNode = walk.nodes.get(id)
    if (entryNode && isAppScriptId(id, adapter)) {
      entryNode.pageType = 'app'
    }
    if (enqueue(walk, id)) {
      walk.entries.push(id)
    }
  }

  await drainQueue(walk)

  return {
    graph: {
      entries: walk.entries,
      nodes: walk.nodes,
      edges: walk.edges,
      packages: walk.packages,
    },
    diagnostics: walk.diagnostics,
  }
}
