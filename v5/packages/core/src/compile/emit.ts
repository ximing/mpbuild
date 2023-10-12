import { mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { Diagnostic } from '../diagnostic/index.js'
import { isNodeModulesPath, npmCompat } from '../plugin/npm-compat.js'
import type { AbstractKind, Module, ModuleGraph, OutputPlan } from '../types.js'
import {
  cacheExt,
  compilerDepVersions,
  readTransformCache,
  transformCacheKey,
  writeTransformCache,
} from './cache.js'
import { rewriteCode } from './rewrite.js'
import { transformModule } from './transform.js'

/** 按 placement 写出；clean 时保留 preserveNames，相同字节不写，取消 dest 删除。 */
export async function emitPlan(input: {
  graph: ModuleGraph
  plan: OutputPlan
  outputDir: string
  clean: boolean
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  css?: { lightningcss: boolean }
  previousDests?: Iterable<string>
  preserveNames?: string[]
  npmCompat?: 'weapp' | 'none'
  minify?: boolean | Record<string, boolean>
  cacheDir?: string
  platform?: string
  ifdefTokens?: Record<string, boolean | string>
}): Promise<{ diagnostics: Diagnostic[]; dests: string[] }> {
  const diagnostics: Diagnostic[] = []
  const dests = input.plan.placements.map((placement) => placement.destPath)

  if (input.clean) {
    await cleanOutputDir(input.outputDir, input.preserveNames ?? [])
  }
  await mkdir(input.outputDir, { recursive: true })

  for (const placement of input.plan.placements) {
    const node = input.graph.nodes.get(placement.moduleId)
    if (!node) {
      continue
    }
    const source = await sourceOf(node)
    if (source === undefined) {
      continue
    }
    const minifyFlag = minifyOf(node.kind, input.minify)
    const useNpmCompat =
      input.npmCompat === 'weapp' && node.kind === 'script' && isNodeModulesPath(node.sourcePath)
    const cacheable =
      node.kind === 'script' || node.kind === 'script-module' || node.kind === 'style'
    const key =
      input.cacheDir && cacheable
        ? transformCacheKey({
            hash: node.hash,
            js: input.js,
            css: input.css ?? { lightningcss: true },
            minify: input.minify ?? false,
            platform: input.platform,
            ifdefTokens: input.ifdefTokens ?? {},
            ...compilerDepVersions(),
            kind: node.kind,
            ext: cacheExt(node.sourcePath),
            npmCompat: useNpmCompat,
          })
        : undefined
    let code: string | undefined
    if (input.cacheDir && key) {
      code = await readTransformCache(input.cacheDir, key)
    }
    if (code === undefined) {
      try {
        const transformed = useNpmCompat
          ? npmCompat({ kind: node.kind, sourcePath: node.sourcePath, code: source, js: input.js })
          : transformModule({
              kind: node.kind,
              sourcePath: node.sourcePath,
              code: source,
              js: input.js,
              css: input.css,
              minify: minifyFlag,
            })
        code = transformed.code
        if (transformed.diagnostics) {
          diagnostics.push(...transformed.diagnostics)
        }
        if (input.cacheDir && key) {
          await writeTransformCache(input.cacheDir, key, code)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        diagnostics.push({
          code: 'TRANSFORM_FAIL',
          severity: 'error',
          message: `TRANSFORM_FAIL: ${message}`,
          file: node.sourcePath,
        })
        continue
      }
    }
    const rewritten = rewriteCode({
      moduleId: node.id,
      kind: node.kind,
      code,
      placement,
      plan: input.plan,
    })
    await mkdir(dirname(placement.destPath), { recursive: true })
    if (await sameUtf8(placement.destPath, rewritten)) {
      continue
    }
    await writeFile(placement.destPath, rewritten)
  }

  const keep = new Set(dests)
  const preserve = new Set((input.preserveNames ?? []).map((name) => basename(name)))
  for (const prev of input.previousDests ?? []) {
    if (keep.has(prev) || preserve.has(basename(prev))) {
      continue
    }
    try {
      await unlink(prev)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err
      }
    }
  }

  return { diagnostics, dests }
}

/** 只删 outputDir 顶层非 preserve（basename）项，避免 rm 整树丢掉保留文件。 */
async function cleanOutputDir(outputDir: string, preserveNames: string[]): Promise<void> {
  const preserve = new Set(preserveNames.map((name) => basename(name)))
  let names: string[]
  try {
    names = await readdir(outputDir)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }
    throw err
  }
  for (const name of names) {
    if (preserve.has(name)) {
      continue
    }
    await rm(join(outputDir, name), { recursive: true, force: true })
  }
}

async function sourceOf(node: Module): Promise<string | undefined> {
  if (typeof node.meta.code === 'string') {
    return node.meta.code
  }
  if (node.virtual || node.sourcePath === '') {
    return undefined
  }
  return readFile(node.sourcePath, 'utf8')
}

async function sameUtf8(destPath: string, next: string): Promise<boolean> {
  try {
    await stat(destPath)
    const existing = await readFile(destPath, 'utf8')
    return existing === next
  } catch {
    return false
  }
}

function minifyOf(
  kind: AbstractKind,
  minify: boolean | Record<string, boolean> | undefined,
): boolean {
  if (minify === true) {
    return true
  }
  if (minify && typeof minify === 'object') {
    return minify[kind] === true
  }
  return false
}
