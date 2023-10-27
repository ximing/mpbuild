import { posix } from 'node:path'
import type { AbstractKind, OutputPlan, Placement, Rewrite } from '../types.js'

/** 按 placement 重写 specifier；destSpecifier 视为 to 模块 id 并现算相对路径。 */
export function rewriteCode(input: {
  moduleId: string
  kind: AbstractKind
  code: string
  placement: Placement
  plan: OutputPlan
  componentRelative?: boolean
  outputDir?: string
}): string {
  const items = input.plan.rewrites.filter(
    (item) => item.from === input.moduleId && item.placementPackage === input.placement.package,
  )
  if (items.length === 0) {
    return input.code
  }
  switch (input.kind) {
    case 'script':
    case 'script-module':
      return rewriteQuoted(input.code, items, input.placement, input.plan)
    case 'json':
      return rewriteJson(
        input.code,
        items,
        input.placement,
        input.plan,
        input.componentRelative,
        input.outputDir,
      )
    case 'template':
      return rewriteTemplate(input.code, items, input.placement, input.plan)
    case 'style':
      return rewriteStyle(input.code, items, input.placement, input.plan)
    default:
      return input.code
  }
}

function rewriteQuoted(
  code: string,
  items: Rewrite[],
  placement: Placement,
  plan: OutputPlan,
): string {
  let out = code
  for (const item of items) {
    out = replaceQuotedSpecifier(out, item.raw, destSpecifierOf(item, placement, plan))
  }
  return out
}

function rewriteJson(
  code: string,
  items: Rewrite[],
  placement: Placement,
  plan: OutputPlan,
  componentRelative?: boolean,
  outputDir?: string,
): string {
  const withPath = items.filter((item) => item.rewritePath)
  const withoutPath = items.filter((item) => !item.rewritePath)
  let out = code
  if (withPath.length > 0) {
    let data: unknown
    try {
      data = JSON.parse(code)
    } catch {
      return code
    }
    for (const item of withPath) {
      const pointer = item.rewritePath
      if (pointer === undefined) {
        continue
      }
      setJsonPointer(data, pointer, destSpecifierOf(item, placement, plan, componentRelative, outputDir))
    }
    out = code.includes('\n') ? JSON.stringify(data, null, 2) : JSON.stringify(data)
  }
  if (withoutPath.length > 0) {
    out = rewriteQuoted(out, withoutPath, placement, plan)
  }
  return out
}

function rewriteTemplate(
  code: string,
  items: Rewrite[],
  placement: Placement,
  plan: OutputPlan,
): string {
  let out = code
  for (const item of items) {
    const dest = destSpecifierOf(item, placement, plan)
    const escaped = escapeRegExp(item.raw)
    out = out.replace(
      new RegExp(`(=\\s*)(["'])${escaped}\\2`, 'g'),
      (_m, eq: string, quote: string) => `${eq}${quote}${dest}${quote}`,
    )
  }
  return out
}

function rewriteStyle(
  code: string,
  items: Rewrite[],
  placement: Placement,
  plan: OutputPlan,
): string {
  let out = code
  for (const item of items) {
    const dest = destSpecifierOf(item, placement, plan)
    const escaped = escapeRegExp(item.raw)
    out = out.replace(
      new RegExp(`(@import\\s+(?:url\\s*\\(\\s*)?)(["'])${escaped}\\2`, 'g'),
      (_m, prefix: string, quote: string) => `${prefix}${quote}${dest}${quote}`,
    )
    out = out.replace(
      new RegExp(`(url\\(\\s*)(["']?)${escaped}\\2(\\s*\\))`, 'g'),
      (_m, prefix: string, quote: string, suffix: string) => `${prefix}${quote}${dest}${quote}${suffix}`,
    )
  }
  return out
}

/** plan.destSpecifier 是 to 的占位（edge.to）；external 保持 raw。 */
function destSpecifierOf(
  item: Rewrite,
  placement: Placement,
  plan: OutputPlan,
  componentRelative?: boolean,
  outputDir?: string,
): string {
  if (isExternalSpecifier(item.raw) || isExternalSpecifier(item.destSpecifier)) {
    return item.raw
  }
  const toDest = destPathFor(item.destSpecifier, placement.package, plan)
  if (toDest === undefined) {
    return item.raw
  }
  const rel = posixRelative(posix.dirname(asPosix(placement.destPath)), asPosix(toDest))
  if (componentRelative !== false) {
    return ensureDotRelative(rel)
  }
  const fromRoot = posixRelative(asPosix(outputDir ?? ''), asPosix(toDest))
  return `/${fromRoot.replace(/^\//, '')}`
}

function asPosix(value: string): string {
  return value.replace(/\\/g, '/')
}

function destPathFor(moduleId: string, pkg: string, plan: OutputPlan): string | undefined {
  const matches = plan.placements.filter((p) => p.moduleId === moduleId)
  if (matches.length === 0) {
    return undefined
  }
  return (matches.find((p) => p.package === pkg) ?? matches[0])?.destPath
}

function posixRelative(from: string, to: string): string {
  return posix.relative(from, to).split(/[\\/]/).join('/')
}

function ensureDotRelative(rel: string): string {
  if (rel === '' || rel === '.') {
    return './'
  }
  if (rel.startsWith('./') || rel.startsWith('../')) {
    return rel
  }
  return `./${rel}`
}

function isExternalSpecifier(value: string): boolean {
  return /^(plugin:|https?:|data:|wxfile:|\/\/)/.test(value)
}

function replaceQuotedSpecifier(code: string, raw: string, dest: string): string {
  let out = code
  for (const quote of [`'`, `"`] as const) {
    const token = `${quote}${raw}${quote}`
    const next = `${quote}${dest}${quote}`
    out = out.split(token).join(next)
  }
  return out
}

function setJsonPointer(root: unknown, pointer: string, value: string): void {
  if (!pointer.startsWith('/')) {
    return
  }
  const parts = pointer
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (parts.length === 0 || parts[0] === '') {
    return
  }
  let cur: unknown = root
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur === null || typeof cur !== 'object') {
      return
    }
    cur = (cur as Record<string, unknown>)[parts[i] as string]
  }
  const last = parts[parts.length - 1]
  if (last === undefined || cur === null || typeof cur !== 'object') {
    return
  }
  ;(cur as Record<string, unknown>)[last] = value
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
