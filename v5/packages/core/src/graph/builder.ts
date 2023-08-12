import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, resolve } from 'node:path'
import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import { resolveId } from '../resolve/resolver.js'
import {
  EdgeKinds,
  type AbstractKind,
  type Edge,
  type Module,
  type ModuleGraph,
  type TargetAdapter,
} from '../types.js'
import { extractEdges } from './extract.js'

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
  const nodes = new Map<string, Module>()
  const edges: Edge[] = []
  const entries: string[] = []
  const diagnostics: Diagnostic[] = []
  const visited = new Set<string>()
  const queue: string[] = []

  const enqueue = (id: string): boolean => {
    if (visited.has(id)) {
      return false
    }
    visited.add(id)
    queue.push(id)
    return true
  }

  for (const entry of entryScripts) {
    // `/` 在 resolveId 里相对 srcDir；入口先归一到绝对路径，再发 `./basename`
    const abs = isAbsolute(entry) ? entry : resolve(rootDir, entry)
    const result = tryResolve({
      request: `./${basename(abs)}`,
      importer: abs,
      kind: 'script',
      adapter,
      srcDir,
      alias,
      diagnostics,
    })
    if (!result || result.external) {
      continue
    }
    if (enqueue(result.id)) {
      entries.push(result.id)
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined) {
      break
    }
    const code = await readFile(id, 'utf8')
    const kind = kindFromExt(id, adapter)
    nodes.set(id, {
      id,
      kind,
      sourcePath: id,
      owner: 'main',
      hash: createHash('sha256').update(code).digest('hex'),
      meta: {},
    })

    for (const extracted of extractEdges({ id, kind, code, adapter })) {
      const result = tryResolve({
        request: extracted.raw,
        importer: id,
        kind: targetKindFromEdge(extracted.kind),
        adapter,
        srcDir,
        alias,
        diagnostics,
      })
      if (!result) {
        continue
      }
      const edge: Edge = {
        from: id,
        to: result.id,
        kind: extracted.kind,
        raw: extracted.raw,
        loc: extracted.loc,
        rewritePath: extracted.rewritePath,
        meta: {},
      }
      if (result.external) {
        edge.external = true
        edges.push(edge)
        continue
      }
      edges.push(edge)
      enqueue(result.id)
    }
  }

  return {
    graph: { entries, nodes, edges, packages: [] },
    diagnostics,
  }
}

function tryResolve(input: {
  request: string
  importer: string
  kind: AbstractKind
  adapter: TargetAdapter
  srcDir: string
  alias?: Record<string, string>
  diagnostics: Diagnostic[]
}) {
  const { diagnostics, ...req } = input
  try {
    return resolveId(req)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    diagnostics.push(
      diagnostic({
        code: 'RESOLVE_MISS',
        severity: 'error',
        message,
        file: req.importer,
      }),
    )
    return undefined
  }
}

/** 当前模块 kind：按 adapter.sourceExts 最长后缀反查，未命中则 script。 */
function kindFromExt(id: string, adapter: TargetAdapter): AbstractKind {
  let matched: AbstractKind | undefined
  let matchedLen = -1
  for (const kind of Object.keys(adapter.sourceExts) as AbstractKind[]) {
    for (const ext of adapter.sourceExts[kind] ?? []) {
      if (ext.length > matchedLen && id.endsWith(ext)) {
        matched = kind
        matchedLen = ext.length
      }
    }
  }
  return matched ?? 'script'
}

/** 边目标 kind，不是 importer 的 kind。 */
function targetKindFromEdge(kind: string): AbstractKind {
  switch (kind) {
    case EdgeKinds.import:
    case EdgeKinds.require:
    case EdgeKinds.dynamicImport:
    case EdgeKinds.usingComponent:
      return 'script'
    case EdgeKinds.templateImport:
    case EdgeKinds.templateInclude:
      return 'template'
    case EdgeKinds.scriptModule:
      return 'script-module'
    case EdgeKinds.styleImport:
      return 'style'
    case EdgeKinds.jsonPath:
      return 'json'
    default:
      return 'script'
  }
}
