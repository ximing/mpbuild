import { parseSync } from '@swc/core'
import { EdgeKinds, type AbstractKind, type EdgeKind, type TargetAdapter } from '../types.js'

export interface ExtractInput {
  id: string
  kind: AbstractKind
  code: string
  adapter: TargetAdapter
}

export interface ExtractedEdge {
  raw: string
  kind: string
  rewritePath?: string
  loc?: { line: number; column: number }
}

/** 按 kind 分派；模板标签和 JSON 字段只读 adapter 表。 */
export function extractEdges(input: ExtractInput): ExtractedEdge[] {
  switch (input.kind) {
    case 'script':
    case 'script-module':
      return extractScript(input.code)
    case 'json':
      return extractJson(input.code, input.adapter)
    case 'template':
      return extractTemplate(input.code, input.adapter)
    case 'style':
      return extractStyle(input.code)
    default:
      return []
  }
}

function extractScript(code: string): ExtractedEdge[] {
  const ast = parseSync(code, {
    syntax: 'typescript',
    tsx: true,
    decorators: true,
  })
  const edges: ExtractedEdge[] = []
  walk(ast, (node) => {
    if (node.type === 'ImportDeclaration') {
      if (isTypeOnlyModule(node)) {
        return
      }
      pushString(edges, node.source, EdgeKinds.import)
      return
    }
    if (node.type === 'ExportAllDeclaration') {
      if (node.typeOnly === true) {
        return
      }
      pushString(edges, node.source, EdgeKinds.import)
      return
    }
    if (node.type === 'ExportNamedDeclaration') {
      if (node.typeOnly === true || node.source == null) {
        return
      }
      pushString(edges, node.source, EdgeKinds.import)
      return
    }
    if (node.type !== 'CallExpression') {
      return
    }
    const callee = asRecord(node.callee)
    const raw = firstStringArg(node)
    if (raw === undefined) {
      return
    }
    if (callee?.type === 'Import') {
      edges.push({ raw, kind: EdgeKinds.dynamicImport })
      return
    }
    if (callee?.type === 'Identifier' && callee.value === 'require') {
      edges.push({ raw, kind: EdgeKinds.require })
    }
  })
  return edges
}

function extractJson(code: string, adapter: TargetAdapter): ExtractedEdge[] {
  const data: unknown = JSON.parse(code)
  const edges: ExtractedEdge[] = []
  for (const field of adapter.jsonPathFields) {
    walkJsonPath(data, field.path.split('.'), [], field.edge, field.value, edges)
  }
  return edges
}

/** `.` 分段，`*` 展开对象键；只收表里登记的路径。path-or-true：字符串当路径，布尔 true 不当路径。 */
function walkJsonPath(
  node: unknown,
  segments: string[],
  pointer: string[],
  edge: EdgeKind,
  value: 'path' | 'path-or-true' | 'name-or-path',
  edges: ExtractedEdge[],
): void {
  const [head, ...tail] = segments
  if (head === undefined) {
    if (isJsonPathLeaf(node, value)) {
      edges.push({ raw: node, kind: edge, rewritePath: toJsonPointer(pointer) })
    }
    return
  }
  if (node === null || typeof node !== 'object') {
    return
  }
  if (head === '*') {
    if (Array.isArray(node)) {
      node.forEach((child, index) => {
        walkJsonPath(child, tail, [...pointer, String(index)], edge, value, edges)
      })
      return
    }
    for (const [key, child] of Object.entries(node)) {
      walkJsonPath(child, tail, [...pointer, key], edge, value, edges)
    }
    return
  }
  if (Array.isArray(node)) {
    return
  }
  walkJsonPath((node as Record<string, unknown>)[head], tail, [...pointer, head], edge, value, edges)
}

function isJsonPathLeaf(
  node: unknown,
  value: 'path' | 'path-or-true' | 'name-or-path',
): node is string {
  if (node === true && value === 'path-or-true') {
    return false
  }
  if (typeof node !== 'string' || node === '') {
    return false
  }
  return value === 'path' || value === 'path-or-true' || value === 'name-or-path'
}

function extractTemplate(code: string, adapter: TargetAdapter): ExtractedEdge[] {
  const edges: ExtractedEdge[] = []
  for (const { tag, attr, edge } of adapter.templateTags) {
    const tagRe = new RegExp(`<${escapeRegExp(tag)}\\b([^>]*?)/?>`, 'g')
    let match: RegExpExecArray | null
    while ((match = tagRe.exec(code)) !== null) {
      const attrs = match[1] ?? ''
      const attrRe = new RegExp(
        `(?:^|\\s)${escapeRegExp(attr)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
      )
      const attrMatch = attrRe.exec(attrs)
      const raw = attrMatch?.[1] ?? attrMatch?.[2]
      if (raw) {
        edges.push({ raw, kind: edge })
      }
    }
  }
  return edges
}

function extractStyle(code: string): ExtractedEdge[] {
  const edges: ExtractedEdge[] = []
  const importRe = /@import\s+(?:url\s*\(\s*)?(?:"([^"]+)"|'([^']+)')\s*\)?/g
  let match: RegExpExecArray | null
  while ((match = importRe.exec(code)) !== null) {
    const raw = match[1] ?? match[2]
    if (raw) {
      edges.push({ raw, kind: EdgeKinds.styleImport })
    }
  }
  return edges
}

function walk(node: unknown, visit: (node: Record<string, unknown> & { type: string }) => void): void {
  if (node === null || typeof node !== 'object') {
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visit)
    }
    return
  }
  const rec = node as Record<string, unknown>
  if (typeof rec.type === 'string') {
    visit(rec as Record<string, unknown> & { type: string })
  }
  for (const value of Object.values(rec)) {
    walk(value, visit)
  }
}

function isTypeOnlyModule(node: Record<string, unknown>): boolean {
  if (node.typeOnly === true) {
    return true
  }
  const specifiers = node.specifiers
  if (!Array.isArray(specifiers) || specifiers.length === 0) {
    return false
  }
  return specifiers.every((spec) => asRecord(spec)?.isTypeOnly === true)
}

function pushString(edges: ExtractedEdge[], source: unknown, kind: EdgeKind): void {
  const raw = stringLiteralValue(source)
  if (raw !== undefined) {
    edges.push({ raw, kind })
  }
}

function firstStringArg(node: Record<string, unknown>): string | undefined {
  const args = node.arguments
  if (!Array.isArray(args) || args.length === 0) {
    return undefined
  }
  return stringLiteralValue(asRecord(args[0])?.expression)
}

function stringLiteralValue(node: unknown): string | undefined {
  const rec = asRecord(node)
  if (rec?.type === 'StringLiteral' && typeof rec.value === 'string') {
    return rec.value
  }
  return undefined
}

function asRecord(node: unknown): Record<string, unknown> | undefined {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return undefined
  }
  return node as Record<string, unknown>
}

function toJsonPointer(segments: string[]): string {
  return `/${segments.map((part) => part.replace(/~/g, '~0').replace(/\//g, '~1')).join('/')}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
