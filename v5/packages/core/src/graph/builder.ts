import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import { resolveId } from '../resolve/resolver.js'
import {
  EdgeKinds,
  type AbstractKind,
  type Edge,
  type Module,
  type ModuleGraph,
  type PackageInfo,
  type TargetAdapter,
} from '../types.js'
import { pageScriptsFromAppJson } from './entries.js'
import { extractEdges } from './extract.js'
import { companionPath } from './suite.js'

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
  let packages: PackageInfo[] = []

  const intern = (absPath: string, pageType?: Module['pageType']): string => {
    const id = posixRelative(srcDir, absPath)
    const existing = nodes.get(id)
    if (!existing) {
      nodes.set(id, {
        id,
        kind: kindFromExt(absPath, adapter),
        sourcePath: absPath,
        owner: 'main',
        hash: '',
        meta: {},
        ...(pageType ? { pageType } : {}),
      })
    } else if (pageType && existing.pageType === undefined) {
      existing.pageType = pageType
    }
    return id
  }

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
    const id = intern(result.id)
    const entryNode = nodes.get(id)
    if (entryNode && isAppScriptId(id, adapter)) {
      entryNode.pageType = 'app'
    }
    if (enqueue(id)) {
      entries.push(id)
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined) {
      break
    }
    const node = nodes.get(id)
    if (node === undefined) {
      break
    }
    const code = await readFile(node.sourcePath, 'utf8')
    node.hash = createHash('sha256').update(code).digest('hex')

    if (node.kind === 'script') {
      expandSuite({ node, adapter, intern, enqueue, edges })
    }

    if (node.kind === 'json' && isAppJsonId(id, adapter)) {
      const nextPackages = enqueuePagesFromAppJson({
        code,
        adapter,
        srcDir,
        alias,
        intern,
        enqueue,
        entries,
        diagnostics,
      })
      if (nextPackages) {
        packages = nextPackages
      }
    }

    for (const extracted of extractEdges({ id, kind: node.kind, code, adapter })) {
      const result = tryResolve({
        request: extracted.raw,
        importer: node.sourcePath,
        kind: targetKindFromEdge(extracted.kind),
        adapter,
        srcDir,
        alias,
        diagnostics,
      })
      if (!result) {
        continue
      }
      const to = result.external
        ? result.id
        : intern(result.id, extracted.kind === EdgeKinds.usingComponent ? 'component' : undefined)
      const edge: Edge = {
        from: id,
        to,
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
      enqueue(to)
    }
  }

  return {
    graph: { entries, nodes, edges, packages },
    diagnostics,
  }
}

/** 抽边前扫描 adapter.suite（除 script）；缺伴生不报错。 */
function expandSuite(input: {
  node: Module
  adapter: TargetAdapter
  intern: (absPath: string, pageType?: Module['pageType']) => string
  enqueue: (id: string) => boolean
  edges: Edge[]
}): void {
  const { node, adapter, intern, enqueue, edges } = input
  const kind = suiteEdgeKind(node, edges)
  const seen = new Set<AbstractKind>()
  for (const slot of Object.keys(adapter.suite) as Array<keyof TargetAdapter['suite']>) {
    if (slot === 'script') {
      continue
    }
    const companionKind = adapter.suite[slot]
    if (companionKind === 'script' || seen.has(companionKind)) {
      continue
    }
    seen.add(companionKind)
    const abs = companionPath(node.sourcePath, companionKind, adapter)
    if (!abs) {
      continue
    }
    const to = intern(abs)
    edges.push({
      from: node.id,
      to,
      kind,
      raw: `./${basename(abs)}`,
      affectsOwnership: true,
      meta: {},
    })
    enqueue(to)
  }
}

function suiteEdgeKind(node: Module, edges: Edge[]): string {
  if (node.pageType === 'component') {
    return EdgeKinds.componentSuite
  }
  if (edges.some((edge) => edge.to === node.id && edge.kind === EdgeKinds.usingComponent)) {
    return EdgeKinds.componentSuite
  }
  return EdgeKinds.pageSuite
}

/** 页面 script：`./spec` 相对 src/app.js；失败为 MISSING_PAGE_JS，不入队。 */
function enqueuePagesFromAppJson(input: {
  code: string
  adapter: TargetAdapter
  srcDir: string
  alias?: Record<string, string>
  intern: (absPath: string, pageType?: Module['pageType']) => string
  enqueue: (id: string) => boolean
  entries: string[]
  diagnostics: Diagnostic[]
}): PackageInfo[] | undefined {
  const { code, adapter, srcDir, alias, intern, enqueue, entries, diagnostics } = input
  let parsed: ReturnType<typeof pageScriptsFromAppJson>
  try {
    parsed = pageScriptsFromAppJson(code, adapter)
  } catch {
    return undefined
  }
  const importer = join(srcDir, 'app.js')
  for (const spec of parsed.scripts) {
    try {
      const result = resolveId({
        request: `./${spec}`,
        importer,
        kind: 'script',
        adapter,
        srcDir,
        alias,
      })
      if (!result || result.external) {
        continue
      }
      const id = intern(result.id, 'page')
      if (!entries.includes(id)) {
        entries.push(id)
      }
      enqueue(id)
    } catch {
      diagnostics.push(
        diagnostic({
          code: 'MISSING_PAGE_JS',
          severity: 'error',
          message: `MISSING_PAGE_JS: cannot resolve page script ${spec}`,
          file: join(srcDir, spec),
        }),
      )
    }
  }
  return parsed.packages
}

function isAppScriptId(id: string, adapter: TargetAdapter): boolean {
  return stemOf(id, adapter.sourceExts.script ?? []) === 'app'
}

function isAppJsonId(id: string, adapter: TargetAdapter): boolean {
  return stemOf(id, adapter.sourceExts.json ?? []) === 'app'
}

function stemOf(id: string, exts: string[]): string {
  let matched = ''
  for (const ext of exts) {
    if (ext.length > matched.length && id.endsWith(ext)) {
      matched = ext
    }
  }
  return matched ? id.slice(0, -matched.length) : id
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

/** 图 id：posix、相对 srcDir。 */
function posixRelative(from: string, to: string): string {
  return relative(from, to).split(/[\\/]/).join('/')
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
