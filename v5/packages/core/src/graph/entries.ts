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
