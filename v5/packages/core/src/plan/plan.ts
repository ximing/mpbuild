import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import type {
  AbstractKind,
  Edge,
  Module,
  ModuleGraph,
  OutputPlan,
  Placement,
  Rewrite,
  TargetAdapter,
} from '../types.js'

/** 按 owner 生成 placement 与 rewrite；冲突 dest 加 hash 后缀。不改图。 */
export function planGraph(
  graph: ModuleGraph,
  opts: {
    outputDir: string
    shared: 'duplicate' | 'main'
    adapter: TargetAdapter
    platform?: string
  },
): { plan: OutputPlan; diagnostics: Diagnostic[] } {
  const { outputDir, shared, adapter, platform } = opts
  const diagnostics: Diagnostic[] = []
  const placements: Placement[] = []
  const occupied = new Map<string, string>()

  for (const node of graph.nodes.values()) {
    if (adapter.externalSpecifiers.test(node.id)) {
      continue
    }
    for (const pkg of packagesFor(node, graph, shared)) {
      const destPath = uniqueDest(
        destPathFor(outputDir, pkg, node, adapter, platform),
        node,
        occupied,
        diagnostics,
      )
      placements.push({
        moduleId: node.id,
        destPath,
        package: pkg,
      })
    }
  }

  const rewrites: Rewrite[] = []
  for (const placement of placements) {
    for (const edge of graph.edges) {
      if (edge.from !== placement.moduleId) {
        continue
      }
      const rewrite: Rewrite = {
        from: placement.moduleId,
        raw: edge.raw,
        destSpecifier: edge.to,
        placementPackage: placement.package,
      }
      if (edge.rewritePath !== undefined) {
        rewrite.rewritePath = edge.rewritePath
      }
      rewrites.push(rewrite)
    }
  }

  return { plan: { placements, rewrites }, diagnostics }
}

function packagesFor(node: Module, graph: ModuleGraph, shared: 'duplicate' | 'main'): string[] {
  if (node.owner === 'main') {
    return ['main']
  }
  if (node.owner === 'shared') {
    if (shared === 'main') {
      return ['main']
    }
    return touchingSubpackages(node.id, graph)
  }
  return [node.owner]
}

/** 触及分包：入边非 external 且 affectsOwnership !== false 的 from.owner；跳过 main。 */
function touchingSubpackages(moduleId: string, graph: ModuleGraph): string[] {
  const owners: string[] = []
  const seen = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.to !== moduleId || !walksOwnership(edge)) {
      continue
    }
    const from = graph.nodes.get(edge.from)
    if (!from || from.owner === 'main') {
      continue
    }
    if (seen.has(from.owner)) {
      continue
    }
    seen.add(from.owner)
    owners.push(from.owner)
  }
  return owners
}

function walksOwnership(edge: Edge): boolean {
  return edge.external !== true && edge.affectsOwnership !== false
}

function destPathFor(
  outputDir: string,
  pkg: string,
  node: Module,
  adapter: TargetAdapter,
  platform?: string,
): string {
  let rel = idRelativeToPackage(stripVirtualPrefix(node.id), pkg)
  // suite 脚本去掉 basename 的 .${platform} 再换 emitExt
  if (isSuitePageType(node.pageType) && platform) {
    rel = stripPlatformInfix(rel, platform)
  }
  rel = replaceExt(rel, emitExt(node.kind, adapter))
  if (pkg === 'main') {
    return posixJoin(outputDir, rel)
  }
  return posixJoin(outputDir, pkg, rel)
}

function isSuitePageType(pageType: Module['pageType']): boolean {
  return pageType === 'app' || pageType === 'page' || pageType === 'component'
}

/** 只剥 basename 语言扩展名之前的 `.${platform}`，避免 index.wxml 被 wx 误伤。 */
function stripPlatformInfix(id: string, platform: string): string {
  const slash = id.lastIndexOf('/')
  const dir = slash === -1 ? '' : id.slice(0, slash + 1)
  const base = slash === -1 ? id : id.slice(slash + 1)
  const infix = `.${platform}`
  const dot = base.lastIndexOf('.')
  const stem = dot === -1 ? base : base.slice(0, dot)
  const ext = dot === -1 ? '' : base.slice(dot)
  if (!stem.endsWith(infix)) {
    return id
  }
  return `${dir}${stem.slice(0, -infix.length)}${ext}`
}

function stripVirtualPrefix(id: string): string {
  if (id.startsWith('virtual:')) {
    return id.slice('virtual:'.length)
  }
  if (id.startsWith('\0')) {
    return id.slice(1)
  }
  return id
}

function idRelativeToPackage(id: string, pkg: string): string {
  if (pkg === 'main') {
    return id
  }
  if (id === pkg) {
    return ''
  }
  if (id.startsWith(`${pkg}/`)) {
    return id.slice(pkg.length + 1)
  }
  return id
}

function emitExt(kind: AbstractKind, adapter: TargetAdapter): string {
  if (kind === 'asset') {
    return ''
  }
  return adapter.emitExt[kind] ?? ''
}

/** 只换 basename 最后一段扩展名；ext 为空则保留原后缀。 */
function replaceExt(id: string, ext: string): string {
  if (!ext) {
    return id
  }
  const slash = id.lastIndexOf('/')
  const dir = slash === -1 ? '' : id.slice(0, slash + 1)
  const base = slash === -1 ? id : id.slice(slash + 1)
  const dot = base.lastIndexOf('.')
  const stem = dot === -1 ? base : base.slice(0, dot)
  return `${dir}${stem}${ext}`
}

function posixJoin(...parts: string[]): string {
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i] ?? ''
    part = part.replace(/\\/g, '/')
    if (i === 0) {
      part = part.replace(/\/+$/, '')
    } else {
      part = part.replace(/^\/+|\/+$/g, '')
    }
    if (part !== '') {
      out.push(part)
    }
  }
  return out.join('/')
}

function uniqueDest(
  destPath: string,
  node: Module,
  occupied: Map<string, string>,
  diagnostics: Diagnostic[],
): string {
  const existing = occupied.get(destPath)
  if (existing === undefined || existing === node.id) {
    occupied.set(destPath, node.id)
    return destPath
  }
  const hashed = withHashSuffix(destPath, node.hash)
  diagnostics.push(
    diagnostic({
      code: 'PATH_COLLISION',
      severity: 'warning',
      message: `PATH_COLLISION: dest ${destPath} already used by ${existing}`,
      file: node.id,
    }),
  )
  occupied.set(hashed, node.id)
  return hashed
}

function withHashSuffix(destPath: string, hash: string): string {
  const slash = destPath.lastIndexOf('/')
  const dir = slash === -1 ? '' : destPath.slice(0, slash + 1)
  const base = slash === -1 ? destPath : destPath.slice(slash + 1)
  const dot = base.lastIndexOf('.')
  const stem = dot === -1 ? base : base.slice(0, dot)
  const ext = dot === -1 ? '' : base.slice(dot)
  return `${dir}${stem}-${hash.slice(0, 8)}${ext}`
}
