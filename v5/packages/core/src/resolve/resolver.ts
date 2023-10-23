import { existsSync, readFileSync, statSync } from 'node:fs'
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
  platform?: string
}

export interface ResolveResult {
  id: string
  external?: boolean
  virtual?: boolean
  extraWatchFiles?: string[]
}

export function resolveId(req: ResolveRequest): ResolveResult {
  const { request, importer, kind, adapter, srcDir, alias, projects, virtualIds, platform } = req

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
  const exts = adapter.sourceExts[kind] ?? []
  if (candidate) {
    const completed = completeSource(candidate, exts, platform)
    if (completed) {
      return toResolveResult(completed)
    }
    throw Object.assign(new Error(`RESOLVE_MISS: cannot resolve ${request} from ${importer}`), {
      code: 'RESOLVE_MISS',
    })
  }

  // 模板/样式/资源无 ./ 前缀时按相对 importer 补全（`<import src="tpl"/>`、`url(x.png)`）
  if (kind === 'template' || kind === 'style' || kind === 'asset') {
    const rel = completeSource(resolve(dirname(importer), specifier), exts, platform)
    if (rel) {
      return toResolveResult(rel)
    }
  }

  const npm = resolveNpm(specifier, importer, kind, adapter, platform)
  if (npm) {
    return toResolveResult(npm)
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

/** 先原名，再名+ext，再 name/index+ext。目录不当命中。platform 时每个候选先试 infix。 */
function completeSource(
  abs: string,
  exts: string[],
  platform?: string,
): { id: string; extraWatchFiles: string[] } | undefined {
  if (isFile(abs)) {
    return { id: abs, extraWatchFiles: [] }
  }
  return pickNamedSource(abs, exts, platform) ?? pickNamedSource(join(abs, 'index'), exts, platform)
}

/** 每个 ext 先 `name.${platform}${ext}` 再 `name${ext}`。未选中的存在文件列入 extraWatchFiles。 */
export function pickNamedSource(
  abs: string,
  exts: string[],
  platform?: string,
): { id: string; extraWatchFiles: string[] } | undefined {
  const infix = platform ? `.${platform}` : ''
  let id: string | undefined
  const extraWatchFiles: string[] = []
  for (const ext of exts) {
    const candidates = infix ? [`${abs}${infix}${ext}`, `${abs}${ext}`] : [`${abs}${ext}`]
    for (const candidate of candidates) {
      if (!isFile(candidate)) {
        continue
      }
      if (id === undefined) {
        id = candidate
      } else {
        extraWatchFiles.push(candidate)
      }
    }
  }
  return id === undefined ? undefined : { id, extraWatchFiles }
}

function isFile(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isFile()
}

function toResolveResult(completed: { id: string; extraWatchFiles: string[] }): ResolveResult {
  return completed.extraWatchFiles.length
    ? { id: completed.id, extraWatchFiles: completed.extraWatchFiles }
    : { id: completed.id }
}

/** node_modules 之后的 posix 路径（`leftpad/index.js`）。 */
export function pathInsideNodeModules(filePath: string): string | undefined {
  const norm = filePath.replace(/\\/g, '/')
  const token = '/node_modules/'
  const idx = norm.lastIndexOf(token)
  if (idx !== -1) {
    return norm.slice(idx + token.length)
  }
  if (norm.startsWith('node_modules/')) {
    return norm.slice('node_modules/'.length)
  }
  return undefined
}

function parseBareSpecifier(request: string): { name: string; subpath: string } | undefined {
  if (!request || request.startsWith('.') || request.startsWith('/') || isAbsolute(request)) {
    return undefined
  }
  if (request.startsWith('@')) {
    const parts = request.split('/')
    const scope = parts[0]
    const pkg = parts[1]
    if (!scope || !pkg) {
      return undefined
    }
    return { name: `${scope}/${pkg}`, subpath: parts.slice(2).join('/') }
  }
  const slash = request.indexOf('/')
  if (slash === -1) {
    return { name: request, subpath: '' }
  }
  return { name: request.slice(0, slash), subpath: request.slice(slash + 1) }
}

/** 从 importer 向上找 `node_modules/<name>`，按 npmPackageFields 读入口。 */
function resolveNpm(
  request: string,
  importer: string,
  kind: AbstractKind,
  adapter: TargetAdapter,
  platform?: string,
): { id: string; extraWatchFiles: string[] } | undefined {
  const parsed = parseBareSpecifier(request)
  if (!parsed) {
    return undefined
  }
  let dir = dirname(resolve(importer))
  for (;;) {
    const pkgDir = join(dir, 'node_modules', parsed.name)
    if (isFile(join(pkgDir, 'package.json'))) {
      return resolveFromPackage(pkgDir, parsed.subpath, kind, adapter, platform)
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return undefined
    }
    dir = parent
  }
}

function resolveFromPackage(
  pkgDir: string,
  subpath: string,
  kind: AbstractKind,
  adapter: TargetAdapter,
  platform?: string,
): { id: string; extraWatchFiles: string[] } | undefined {
  const pkg = readPkgJson(pkgDir)
  const exts = adapter.sourceExts[kind] ?? []
  if (subpath) {
    const mini = fieldAsPath(pkg.miniprogram)
    if (mini) {
      const miniRoot = join(pkgDir, mini)
      if (existsSync(miniRoot) && statSync(miniRoot).isDirectory()) {
        const hit = completeSource(join(miniRoot, subpath), exts, platform)
        if (hit) {
          return hit
        }
      }
    }
    return completeSource(join(pkgDir, subpath), exts, platform)
  }
  for (const field of adapter.npmPackageFields) {
    const value = fieldAsPath(pkg[field])
    if (!value) {
      continue
    }
    const hit = completeSource(join(pkgDir, value), exts, platform)
    if (hit) {
      return hit
    }
  }
  return completeSource(pkgDir, exts, platform)
}

function readPkgJson(pkgDir: string): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, unknown>
    }
  } catch {
    // 坏 JSON 当空字段，再试 index
  }
  return {}
}

function fieldAsPath(value: unknown): string | undefined {
  if (typeof value === 'string' && value !== '') {
    return value
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const main = (value as Record<string, unknown>)['.']
    if (typeof main === 'string' && main !== '') {
      return main
    }
  }
  return undefined
}
