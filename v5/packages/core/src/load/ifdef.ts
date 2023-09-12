import type { AbstractKind } from '../types.js'

type DirKind = 'ifdef' | 'ifndef' | 'if' | 'endif'

interface Directive {
  kind: DirKind
  expr: string
}

const JS_DIR = /^\s*(?:\/\/|\/\*)\s*@(ifdef|ifndef|if|endif)\b(.*)$/
const HTML_DIR = /^\s*<!--\s*@(ifdef|ifndef|if|endif)\b(.*)$/

/** 按 kind 的注释语法剥离条件编译块；未匹配块与标记行都删除。 */
export function applyIfdef(
  code: string,
  kind: AbstractKind,
  ctx: Record<string, string | boolean>,
): string {
  if (kind === 'asset') {
    return code
  }
  return stripBlocks(code, kind === 'template' ? HTML_DIR : JS_DIR, ctx)
}

function stripBlocks(code: string, dirRe: RegExp, ctx: Record<string, string | boolean>): string {
  const lines = code.split('\n')
  const out: string[] = []
  const stack: boolean[] = []
  for (const line of lines) {
    const dir = parseDirective(line, dirRe)
    if (dir) {
      applyDirective(dir, stack, ctx)
      continue
    }
    if (stack.every((on) => on)) {
      out.push(line)
    }
  }
  return out.join('\n')
}

function parseDirective(line: string, dirRe: RegExp): Directive | undefined {
  const match = dirRe.exec(line)
  if (!match) {
    return undefined
  }
  const expr = (match[2] ?? '').replace(/\*\/\s*$/, '').replace(/-->\s*$/, '').trim()
  return { kind: match[1] as DirKind, expr }
}

function applyDirective(
  dir: Directive,
  stack: boolean[],
  ctx: Record<string, string | boolean>,
): void {
  const parent = stack.every((on) => on)
  switch (dir.kind) {
    case 'ifdef':
      stack.push(parent && tokenOn(ctx, dir.expr))
      return
    case 'ifndef':
      stack.push(parent && !tokenOn(ctx, dir.expr))
      return
    case 'if':
      stack.push(parent && orTokens(ctx, dir.expr))
      return
    case 'endif':
      stack.pop()
  }
}

function tokenOn(ctx: Record<string, string | boolean>, expr: string): boolean {
  const token = expr.split(/\s+/)[0] ?? ''
  if (!token) {
    return false
  }
  const value = ctx[token]
  return value === true || (typeof value === 'string' && value !== '')
}

function orTokens(ctx: Record<string, string | boolean>, expr: string): boolean {
  return expr
    .split('||')
    .map((part) => part.trim())
    .some((part) => tokenOn(ctx, part))
}
