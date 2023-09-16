import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative } from 'node:path'
import type { AliasValue, ResolvedConfig, SubProject } from '../config/schema.js'
import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import { isConfigJsFile, loadConfigJs } from '../load/config-js.js'
import { applyIfdef } from '../load/ifdef.js'
import { pathInsideNodeModules, projectForPath, resolveId } from '../resolve/resolver.js'
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
  alias?: Record<string, AliasValue>
  projects?: SubProject[]
  platform?: string
  ifdef?: ResolvedConfig['ifdef']
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

export function posixJoin(left: string, right: string): string {
  const a = left.replace(/\\/g, '/').replace(/\/+$/, '')
  const b = right.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!a) {
    return b
  }
  if (!b) {
    return a
  }
  return `${a}/${b}`
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
  extraWatchFiles?: string[],
): string {
  // 落在子仓库 src 下时 id 为 name/相对路径；src 外的 npm 为 npm/<pkg>/...
  const project = projectForPath(absPath, walk.projects)
  const id = project
    ? posixJoin(project.name, posixRelative(project.src, absPath))
    : npmGraphId(walk.srcDir, absPath)
  const existing = walk.nodes.get(id)
  if (!existing) {
    const extras = uniqueWatchFiles(absPath, extraWatchFiles)
    walk.nodes.set(id, {
      id,
      kind: kindFromExt(absPath, walk.adapter),
      sourcePath: absPath,
      owner: 'main',
      hash: '',
      meta: {},
      ...(pageType ? { pageType } : {}),
      ...(extras.length ? { extraWatchFiles: extras } : {}),
    })
  } else {
    if (pageType && existing.pageType === undefined) {
      existing.pageType = pageType
    }
    // intern 已存在则 concat 未选中兄弟
    const extras = uniqueWatchFiles(existing.sourcePath, [
      ...(existing.extraWatchFiles ?? []),
      ...(extraWatchFiles ?? []),
    ])
    if (extras.length) {
      existing.extraWatchFiles = extras
    }
  }
  return id
}

function npmGraphId(srcDir: string, absPath: string): string {
  const rel = posixRelative(srcDir, absPath)
  const outside = rel.startsWith('../') || rel === '..' || isAbsolute(rel)
  if (!outside) {
    return rel
  }
  const inner = pathInsideNodeModules(absPath)
  return inner ? posixJoin('npm', inner) : rel
}

function uniqueWatchFiles(sourcePath: string, files: string[] | undefined): string[] {
  if (!files?.length) {
    return []
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const file of files) {
    if (!file || file === sourcePath || seen.has(file)) {
      continue
    }
    seen.add(file)
    out.push(file)
  }
  return out
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
    code = stripIfdef(code, node.kind, walk)
  } else {
    node.kind = kindFromExt(node.sourcePath, walk.adapter)
    if (isConfigJsModule(node, walk.adapter)) {
      // Node 执行磁盘原文；不吃 ifdef 后的 meta.code
      code = isolateLoadConfigJs(walk, node)
    } else {
      code = await readFile(node.sourcePath, 'utf8')
      code = stripIfdef(code, node.kind, walk)
    }
  }
  node.meta = { ...node.meta, code }
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
          result.extraWatchFiles,
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
    const abs = companionPath(node.sourcePath, companionKind, adapter, walk.platform)
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
  const { adapter, srcDir, alias, projects, diagnostics } = walk
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
        projects,
        platform: walk.platform,
      })
      if (!result || result.external) {
        continue
      }
      const id = intern(walk, result.id, 'page', result.extraWatchFiles)
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

/** 把 `virtual:app.json` 挂回 app 入口的 pageSuite，避免 watch 重扫时被 GC。 */
export function attachVirtualAppJson(walk: GraphWalk, virtId = 'virtual:app.json'): void {
  if (virtId !== 'virtual:app.json' || !walk.nodes.has(virtId)) {
    return
  }
  let appId: string | undefined
  for (const node of walk.nodes.values()) {
    if (node.pageType === 'app') {
      appId = node.id
      break
    }
  }
  if (!appId) {
    return
  }
  if (walk.edges.some((edge) => edge.from === appId && edge.to === virtId)) {
    return
  }
  walk.edges.push({
    from: appId,
    to: virtId,
    kind: EdgeKinds.pageSuite,
    raw: virtId,
    affectsOwnership: true,
    meta: {},
  })
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
      projects: walk.projects,
      platform: walk.platform,
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

function isConfigJsModule(node: Module, adapter: TargetAdapter): boolean {
  return isConfigJsFile(node.sourcePath, adapter.sourceExts.json)
}

/** 隔离执行 .config.js，得到 JSON 文本；失败记 CONFIG_JS_INVALID。 */
function isolateLoadConfigJs(walk: GraphWalk, node: Module): string {
  try {
    const loaded = loadConfigJs(node.sourcePath)
    const extras = uniqueWatchFiles(node.sourcePath, [
      ...(node.extraWatchFiles ?? []),
      ...loaded.watchFiles,
    ])
    if (extras.length) {
      node.extraWatchFiles = extras
    }
    return loaded.json
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    walk.diagnostics.push(
      diagnostic({
        code: 'CONFIG_JS_INVALID',
        severity: 'error',
        message,
        file: node.sourcePath,
      }),
    )
    return '{}'
  }
}

/** blockcode 关闭或无 platform 时原样返回。 */
function stripIfdef(code: string, kind: AbstractKind, walk: GraphWalk): string {
  const platform = walk.platform
  if (!platform || walk.ifdef?.blockcode === false) {
    return code
  }
  return applyIfdef(code, kind, {
    [platform]: true,
    p: platform,
    ...walk.ifdef?.tokens,
  })
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
