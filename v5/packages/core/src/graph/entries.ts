import type { AppEntry } from '../config/schema.js'
import type { PackageInfo, TargetAdapter } from '../types.js'

/** 字段名读 adapter.appJson；分包页路径 posixJoin(root, page)。 */
export function pageScriptsFromAppJson(
  code: string,
  adapter: TargetAdapter,
): {
  scripts: string[]
  packages: PackageInfo[]
} {
  const data = JSON.parse(code) as unknown
  const rec = asRecord(data)
  const scripts: string[] = []
  const packages: PackageInfo[] = [{ root: '' }]

  for (const page of stringList(rec?.[adapter.appJson.pages])) {
    scripts.push(normalizePageSpec(page))
  }

  for (const sub of arrayOf(rec?.[adapter.appJson.subPackages])) {
    const item = asRecord(sub)
    if (!item) {
      continue
    }
    const root = typeof item.root === 'string' ? normalizePageSpec(item.root).replace(/\/+$/, '') : ''
    const pkg: PackageInfo = { root }
    if (typeof item.independent === 'boolean') {
      pkg.independent = item.independent
    }
    packages.push(pkg)
    for (const page of stringList(item.pages)) {
      scripts.push(posixJoin(root, normalizePageSpec(page)))
    }
  }

  return { scripts, packages }
}

/** scripts 为逻辑页路径；sources 为 router 的 value（`/` 相对 src 或 alias）。 */
export function pageScriptsFromRouter(entry: AppEntry): {
  scripts: string[]
  sources: string[]
  packages: PackageInfo[]
} {
  const scripts: string[] = []
  const sources: string[] = []
  const packages: PackageInfo[] = [{ root: '' }]

  for (const group of entry.router ?? []) {
    const root =
      typeof group.root === 'string' ? normalizePageSpec(group.root).replace(/\/+$/, '') : ''
    if (root !== '') {
      const pkg: PackageInfo = { root }
      if (typeof group.independent === 'boolean') {
        pkg.independent = group.independent
      }
      packages.push(pkg)
    }
    for (const [page, source] of Object.entries(group.pages ?? {})) {
      scripts.push(posixJoin(root, normalizePageSpec(page)))
      if (typeof source === 'string' && source !== '') {
        sources.push(source)
      }
    }
  }

  return { scripts, sources, packages }
}

/** 有 router 时 pages/subPackages 由各组生成，保留 networkTimeout 等顶层键。 */
export function appJsonFromEntry(entry: AppEntry, adapter: TargetAdapter): Record<string, unknown> {
  const pagesKey = adapter.appJson.pages
  const subsKey = adapter.appJson.subPackages
  const skip = new Set(['router', 'pages', 'subPackages', pagesKey, subsKey])
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entry)) {
    if (skip.has(key)) {
      continue
    }
    out[key] = value
  }

  const router = entry.router
  if (Array.isArray(router) && router.length > 0) {
    const mainPages: string[] = []
    const subs: Record<string, unknown>[] = []
    for (const group of router) {
      const root =
        typeof group.root === 'string' ? normalizePageSpec(group.root).replace(/\/+$/, '') : ''
      const pageKeys = Object.keys(group.pages ?? {})
      if (root === '') {
        mainPages.push(...pageKeys)
      } else {
        subs.push({ ...group, pages: pageKeys })
      }
    }
    out[pagesKey] = mainPages
    if (subs.length > 0) {
      out[subsKey] = subs
    }
    return out
  }

  if (Array.isArray(entry.pages)) {
    out[pagesKey] = entry.pages
  }
  if (Array.isArray(entry.subPackages)) {
    out[subsKey] = entry.subPackages
  }
  return out
}

function posixJoin(root: string, page: string): string {
  if (root === '') {
    return page
  }
  if (page === '') {
    return root
  }
  return `${root.replace(/\/+$/, '')}/${page.replace(/^\/+/, '')}`
}

function normalizePageSpec(spec: string): string {
  return spec.replace(/\\/g, '/').replace(/^\/+/, '')
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item !== '')
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}
