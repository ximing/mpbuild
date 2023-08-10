import { existsSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import type { AbstractKind, TargetAdapter } from '../types.js'

export interface ResolveRequest {
  request: string
  importer: string
  kind: AbstractKind
  adapter: TargetAdapter
  srcDir: string
  alias?: Record<string, string>
  virtualIds?: Set<string>
}

export interface ResolveResult {
  id: string
  external?: boolean
  virtual?: boolean
}

export function resolveId(req: ResolveRequest): ResolveResult {
  const { request, importer, kind, adapter, srcDir, alias, virtualIds } = req

  // 规格 §8.2：external 不落盘、不报 RESOLVE_MISS
  if (adapter.externalSpecifiers.test(request)) {
    return { id: request, external: true }
  }

  // P0 无插件 resolve 钩子；virtualIds 命中即虚模块
  if (virtualIds?.has(request)) {
    return { id: request, virtual: true }
  }

  const rewritten = applyLongestAlias(request, alias)
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

/** 最长前缀；仅精确命中或后接 `/`，避免 `@` 吃掉 `@foo`。 */
function applyLongestAlias(request: string, alias?: Record<string, string>): string | undefined {
  if (!alias) {
    return undefined
  }
  let bestKey: string | undefined
  for (const key of Object.keys(alias)) {
    if (!aliasMatches(key, request)) {
      continue
    }
    if (bestKey === undefined || key.length > bestKey.length) {
      bestKey = key
    }
  }
  if (bestKey === undefined) {
    return undefined
  }
  const target = alias[bestKey]
  if (target === undefined) {
    return undefined
  }
  return target + request.slice(bestKey.length)
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
