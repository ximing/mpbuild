import { existsSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import type { AliasValue, SubProject } from '../config/schema.js'
import type { AbstractKind, TargetAdapter } from '../types.js'

export interface ResolveRequest {
  request: string
  importer: string
  kind: AbstractKind
  adapter: TargetAdapter
  srcDir: string
  alias?: Record<string, AliasValue>
  projects?: SubProject[]
  virtualIds?: Set<string>
}

export interface ResolveResult {
  id: string
  external?: boolean
  virtual?: boolean
}

export function resolveId(req: ResolveRequest): ResolveResult {
  const { request, importer, kind, adapter, srcDir, alias, projects, virtualIds } = req

  // 规格 §8.2：external 不落盘、不报 RESOLVE_MISS
  if (adapter.externalSpecifiers.test(request)) {
    return { id: request, external: true }
  }

  // P0 无插件 resolve 钩子；virtualIds 命中即虚模块
  if (virtualIds?.has(request)) {
    return { id: request, virtual: true }
  }

  const rewritten = rewriteWithAlias(request, importer, alias, projects)
  const specifier = rewritten ?? request
  const fromAlias = rewritten != null

  const candidate = toCandidate(specifier, importer, srcDir, fromAlias)
  if (candidate) {
    const exts = adapter.sourceExts[kind] ?? []
    const id = completeSource(candidate, exts)
    if (id) {
      return { id }
    }
  }

  throw Object.assign(new Error(`RESOLVE_MISS: cannot resolve ${request} from ${importer}`), {
    code: 'RESOLVE_MISS',
  })
}

/** 子仓库内 importer 先走 project.alias，再走全局。 */
function rewriteWithAlias(
  request: string,
  importer: string,
  alias?: Record<string, AliasValue>,
  projects?: SubProject[],
): string | undefined {
  const ctx = { importer, request }
  const project = projectForPath(importer, projects)
  if (project) {
    const local = applyLongestAlias(request, project.alias, ctx)
    if (local !== undefined) {
      return local
    }
  }
  return applyLongestAlias(request, alias, ctx)
}

/** 最长前缀；函数返回空则跳过该 key。仅精确命中或后接 `/`，避免 `@` 吃掉 `@foo`。 */
function applyLongestAlias(
  request: string,
  alias: Record<string, AliasValue> | undefined,
  ctx: { importer: string; request: string },
): string | undefined {
  if (!alias) {
    return undefined
  }
  const keys = Object.keys(alias)
    .filter((key) => aliasMatches(key, request))
    .sort((a, b) => b.length - a.length)
  for (const key of keys) {
    const target = alias[key]
    if (target === undefined) {
      continue
    }
    const replacement = typeof target === 'function' ? target(ctx) : target
    if (replacement == null || replacement === '') {
      continue
    }
    return concatAlias(replacement, request.slice(key.length))
  }
  return undefined
}

function concatAlias(target: string, rest: string): string {
  if (rest === '') {
    return target
  }
  if (/[/\\]$/.test(target) || /^[/\\]/.test(rest)) {
    return target + rest
  }
  return `${target}/${rest}`
}

/** 落在某个 project.src 下的路径；重叠时取最长 src。 */
export function projectForPath(filePath: string, projects?: SubProject[]): SubProject | undefined {
  if (!projects?.length) {
    return undefined
  }
  const abs = resolve(filePath)
  let best: SubProject | undefined
  let bestLen = -1
  for (const project of projects) {
    const src = resolve(project.src)
    const rel = relative(src, abs)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      continue
    }
    if (src.length > bestLen) {
      best = project
      bestLen = src.length
    }
  }
  return best
}

function aliasMatches(key: string, request: string): boolean {
  if (request === key) {
    return true
  }
  if (key.endsWith('/')) {
    return request.startsWith(key)
  }
  return request.startsWith(`${key}/`)
}

function toCandidate(
  specifier: string,
  importer: string,
  srcDir: string,
  fromAlias: boolean,
): string | undefined {
  if (specifier.startsWith('.')) {
    return resolve(dirname(importer), specifier)
  }
  // 原请求以 `/` 开头相对 srcDir；alias 展开后的绝对路径按磁盘路径处理
  if (!fromAlias && specifier.startsWith('/')) {
    return resolve(srcDir, specifier.slice(1))
  }
  if (isAbsolute(specifier)) {
    return specifier
  }
  if (fromAlias) {
    return resolve(srcDir, specifier)
  }
  return undefined
}

/** 先原名，再名+ext，再 name/index+ext。目录不当命中。 */
function completeSource(abs: string, exts: string[]): string | undefined {
  if (isFile(abs)) {
    return abs
  }
  for (const ext of exts) {
    const withExt = abs + ext
    if (isFile(withExt)) {
      return withExt
    }
  }
  for (const ext of exts) {
    const indexFile = join(abs, `index${ext}`)
    if (isFile(indexFile)) {
      return indexFile
    }
  }
  return undefined
}

function isFile(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isFile()
}
