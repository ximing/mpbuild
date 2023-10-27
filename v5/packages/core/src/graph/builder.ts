import { existsSync, statSync } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'
import type { AliasValue, ResolvedConfig, SubProject } from '../config/schema.js'
import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import { resolveId } from '../resolve/resolver.js'
import type {
  AbstractKind,
  ModuleGraph,
  PackageInfo,
  Plugin,
  TargetAdapter,
} from '../types.js'
import {
  attachVirtualAppJson,
  drainQueue,
  enqueue,
  intern,
  internVirtual,
  isAppScriptId,
  posixDirname,
  posixJoin,
  tryResolve,
  type GraphWalk,
} from './walk.js'

export interface BuildGraphOptions {
  rootDir: string
  srcDir: string
  adapter: TargetAdapter
  entryScripts: string[] // 绝对路径、相对 rootDir，或 `/` 相对 src 的页面源
  alias?: Record<string, AliasValue>
  projects?: SubProject[]
  platform?: string
  ifdef?: ResolvedConfig['ifdef']
  packages?: PackageInfo[]
  skipAppJsonPages?: boolean
  virtualModules?: Array<{ id: string; kind: AbstractKind; code: string }>
  /** router 页面：source 为入口值，logical 为无扩展名逻辑路径 */
  pageEntries?: Array<{ source: string; logical: string }>
  plugins?: Plugin[]
  extensions?: TargetAdapter['sourceExts']
}

/** 从 entry 入队，按最终 id BFS；环边照常写入，不递归 process。 */
export async function buildGraph(opts: BuildGraphOptions): Promise<{
  graph: ModuleGraph
  diagnostics: Diagnostic[]
}> {
  const {
    rootDir,
    srcDir,
    adapter,
    entryScripts,
    alias,
    projects,
    platform,
    ifdef,
    packages,
    skipAppJsonPages,
    virtualModules,
    pageEntries,
    plugins,
    extensions,
  } = opts
  const walk: GraphWalk = {
    srcDir,
    adapter,
    alias,
    projects,
    platform,
    ifdef,
    nodes: new Map(),
    edges: [],
    entries: [],
    packages: packages ? packages.map((pkg) => ({ ...pkg })) : [],
    diagnostics: [],
    visited: new Set(),
    queue: [],
    skipAppJsonPages: skipAppJsonPages === true,
    plugins,
    extensions,
  }

  for (const entry of entryScripts) {
    enqueueEntryScript(walk, entry, rootDir)
  }
  for (const page of pageEntries ?? []) {
    enqueuePageEntry(walk, page, rootDir)
  }

  for (const virt of virtualModules ?? []) {
    internVirtual(walk, virt.id, { kind: virt.kind, code: virt.code })
    enqueue(walk, virt.id)
    attachVirtualAppJson(walk, virt.id)
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

function enqueueEntryScript(walk: GraphWalk, entry: string, rootDir: string): void {
  const disk = existingFile(entry, rootDir)
  if (disk) {
    // `/` 在 resolveId 里相对 srcDir；磁盘入口先归一到绝对路径，再发 `./basename`
    const result = tryResolve(walk, {
      request: `./${basename(disk)}`,
      importer: disk,
      kind: 'script',
    })
    if (!result || result.external) {
      return
    }
    const id = intern(walk, result.id, undefined, result.extraWatchFiles)
    const entryNode = walk.nodes.get(id)
    if (entryNode && isAppScriptId(id, walk.adapter)) {
      entryNode.pageType = 'app'
    }
    if (enqueue(walk, id)) {
      walk.entries.push(id)
    }
    return
  }

  // 非落盘入口：`/` 相对 src，或 alias（Task 3 再解析）
  try {
    const result = resolveId({
      request: entry,
      importer: join(walk.srcDir, 'app.js'),
      kind: 'script',
      adapter: walk.adapter,
      srcDir: walk.srcDir,
      alias: walk.alias,
      projects: walk.projects,
      platform: walk.platform,
      extensions: walk.extensions,
    })
    if (!result || result.external || result.virtual) {
      return
    }
    const id = intern(walk, result.id, 'page', result.extraWatchFiles)
    if (enqueue(walk, id)) {
      walk.entries.push(id)
    }
  } catch {
    walk.diagnostics.push(
      diagnostic({
        code: 'MISSING_PAGE_JS',
        severity: 'error',
        message: `MISSING_PAGE_JS: cannot resolve page script ${entry}`,
        file: join(walk.srcDir, entry),
      }),
    )
  }
}

function enqueuePageEntry(
  walk: GraphWalk,
  page: { source: string; logical: string },
  rootDir: string,
): void {
  try {
    const result = resolveId({
      request: page.source,
      importer: join(walk.srcDir, 'app.js'),
      kind: 'script',
      adapter: walk.adapter,
      srcDir: walk.srcDir,
      alias: walk.alias,
      projects: walk.projects,
      platform: walk.platform,
      extensions: walk.extensions,
    })
    if (!result || result.external || result.virtual) {
      return
    }
    const logicalId = posixJoin(posixDirname(page.logical), basename(result.id))
    const id = intern(walk, result.id, 'page', result.extraWatchFiles, logicalId)
    if (enqueue(walk, id)) {
      walk.entries.push(id)
    }
  } catch {
    walk.diagnostics.push(
      diagnostic({
        code: 'MISSING_PAGE_JS',
        severity: 'error',
        message: `MISSING_PAGE_JS: cannot resolve page script ${page.source}`,
        file: join(rootDir, page.source),
      }),
    )
  }
}

function existingFile(entry: string, rootDir: string): string | undefined {
  const abs = isAbsolute(entry) ? entry : resolve(rootDir, entry)
  if (existsSync(abs) && statSync(abs).isFile()) {
    return abs
  }
  return undefined
}
