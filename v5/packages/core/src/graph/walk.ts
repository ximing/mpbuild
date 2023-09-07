import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import { resolveId } from '../resolve/resolver.js'
import {
  EdgeKinds,
  type AbstractKind,
  type Edge,
  type Module,
  type PackageInfo,
  type TargetAdapter,
} from '../types.js'
import { pageScriptsFromAppJson } from './entries.js'
import { extractEdges } from './extract.js'
import { companionPath } from './suite.js'

export interface GraphWalk {
  srcDir: string
  adapter: TargetAdapter
  alias?: Record<string, string>
  nodes: Map<string, Module>
  edges: Edge[]
  entries: string[]
  packages: PackageInfo[]
  diagnostics: Diagnostic[]
  visited: Set<string>
  queue: string[]
  /** 有 router 时不从磁盘 app.json 扫 pages */
  skipAppJsonPages?: boolean
}

/** 图 id：posix、相对 srcDir。 */
export function posixRelative(from: string, to: string): string {
  return relative(from, to).split(/[\\/]/).join('/')
}

/** 当前模块 kind：按 adapter.sourceExts 最长后缀反查，未命中则 script。 */
export function kindFromExt(id: string, adapter: TargetAdapter): AbstractKind {
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

export function intern(
  walk: GraphWalk,
  absPath: string,
  pageType?: Module['pageType'],
): string {
  const id = posixRelative(walk.srcDir, absPath)
  const existing = walk.nodes.get(id)
  if (!existing) {
    walk.nodes.set(id, {
      id,
      kind: kindFromExt(absPath, walk.adapter),
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

/** 虚模块：id 保留 `virtual:` 前缀，sourcePath 为空，code 放 meta.code。 */
export function internVirtual(
  walk: GraphWalk,
  id: string,
  init: { kind: AbstractKind; code: string },
): string {
  const existing = walk.nodes.get(id)
  if (!existing) {
    walk.nodes.set(id, {
      id,
      kind: init.kind,
      sourcePath: '',
      virtual: true,
      owner: 'main',
      hash: '',
      meta: { code: init.code },
    })
  } else {
    existing.virtual = true
    existing.kind = init.kind
    existing.meta = { ...existing.meta, code: init.code }
  }
  return id
}

export function enqueue(walk: GraphWalk, id: string): boolean {
  if (walk.visited.has(id)) {
    return false
  }
  walk.visited.add(id)
  walk.queue.push(id)
  return true
}

export async function drainQueue(walk: GraphWalk): Promise<void> {
  while (walk.queue.length > 0) {
    const id = walk.queue.shift()
    if (id === undefined) {
      break
    }
    const node = walk.nodes.get(id)
    if (node === undefined) {
      break
    }
    await processModule(walk, id)
  }
}

export async function processModule(walk: GraphWalk, id: string): Promise<void> {
  const node = walk.nodes.get(id)
  if (node === undefined) {
    return
  }
  let code: string
  if (isVirtualNode(node)) {
    code = typeof node.meta.code === 'string' ? node.meta.code : ''
  } else {
    code = await readFile(node.sourcePath, 'utf8')
    node.kind = kindFromExt(node.sourcePath, walk.adapter)
  }
  node.hash = createHash('sha256').update(code).digest('hex')

  if (node.kind === 'script') {
    expandSuite(walk, node)
  }

  if (node.kind === 'json' && !walk.skipAppJsonPages && isAppJsonId(id, walk.adapter)) {
    const nextPackages = enqueuePagesFromAppJson(walk, code)
    if (nextPackages) {
      walk.packages.length = 0
      walk.packages.push(...nextPackages)
    }
  }

  const importer = node.sourcePath || join(walk.srcDir, stripVirtualPrefix(id))
  for (const extracted of extractEdges({
    id,
    kind: node.kind,
    code,
    adapter: walk.adapter,
  })) {
    const result = tryResolve(walk, {
      request: extracted.raw,
      importer,
      kind: targetKindFromEdge(extracted.kind),
    })
    if (!result) {
      continue
    }
    const to = result.external
      ? result.id
      : intern(
          walk,
          result.id,
          extracted.kind === EdgeKinds.usingComponent ? 'component' : undefined,
        )
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
      walk.edges.push(edge)
      continue
    }
    walk.edges.push(edge)
    enqueue(walk, to)
  }
}

/** 抽边前扫描 adapter.suite（除 script）；缺伴生不报错。 */
export function expandSuite(walk: GraphWalk, node: Module): void {
  const { adapter } = walk
  const kind = suiteEdgeKind(node, walk.edges)
  const seen = new Set<AbstractKind>()
  for (const slot of Object.keys(adapter.suite) as Array<keyof TargetAdapter['suite']>) {
    if (slot === 'script') {
      continue
    }
    const companionKind = adapter.suite[slot]
    if (companionKind === 'script' || seen.has(companionKind)) {
      continue
    }
    if (walk.skipAppJsonPages && node.pageType === 'app' && companionKind === 'json') {
      continue
    }
    seen.add(companionKind)
    const abs = companionPath(node.sourcePath, companionKind, adapter)
    if (!abs) {
      continue
    }
    addSuiteEdge(walk, node, abs, kind)
  }
}

export function suiteEdgeKind(node: Module, edges: Edge[]): string {
  if (node.pageType === 'component') {
    return EdgeKinds.componentSuite
  }
  if (edges.some((edge) => edge.to === node.id && edge.kind === EdgeKinds.usingComponent)) {
    return EdgeKinds.componentSuite
  }
  return EdgeKinds.pageSuite
}

export function addSuiteEdge(
  walk: GraphWalk,
  from: Module,
  abs: string,
  kind = suiteEdgeKind(from, walk.edges),
): string {
  const to = intern(walk, abs)
  walk.edges.push({
    from: from.id,
    to,
    kind,
    raw: `./${basename(abs)}`,
    affectsOwnership: true,
    meta: {},
  })
  enqueue(walk, to)
  return to
}

/** 页面 script：`./spec` 相对 src/app.js；失败为 MISSING_PAGE_JS，不入队。 */
function enqueuePagesFromAppJson(walk: GraphWalk, code: string): PackageInfo[] | undefined {
  const { adapter, srcDir, alias, diagnostics } = walk
  let parsed: ReturnType<typeof pageScriptsFromAppJson>
  try {
    parsed = pageScriptsFromAppJson(code, adapter)
  } catch {
    return undefined
  }
  const importer = join(srcDir, 'app.js')
  const pageIds: string[] = []
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
      const id = intern(walk, result.id, 'page')
      pageIds.push(id)
      enqueue(walk, id)
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
  const kept = walk.entries.filter((id) => walk.nodes.get(id)?.pageType !== 'page')
  walk.entries.length = 0
  walk.entries.push(...kept)
  for (const id of pageIds) {
    if (!walk.entries.includes(id)) {
      walk.entries.push(id)
    }
  }
  return parsed.packages
}

export function isAppScriptId(id: string, adapter: TargetAdapter): boolean {
  return stemOf(id, adapter.sourceExts.script ?? []) === 'app'
}

export function isVirtualNode(node: Module): boolean {
  return node.virtual === true || node.sourcePath === '' || isVirtualId(node.id)
}

export function isVirtualId(id: string): boolean {
  return id.startsWith('virtual:') || id.startsWith('\0')
}

export function stripVirtualPrefix(id: string): string {
  if (id.startsWith('virtual:')) {
    return id.slice('virtual:'.length)
  }
  if (id.startsWith('\0')) {
    return id.slice(1)
  }
  return id
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

export function tryResolve(
  walk: GraphWalk,
  req: { request: string; importer: string; kind: AbstractKind },
) {
  try {
    return resolveId({
      request: req.request,
      importer: req.importer,
      kind: req.kind,
      adapter: walk.adapter,
      srcDir: walk.srcDir,
      alias: walk.alias,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    walk.diagnostics.push(
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
