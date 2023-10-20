import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { diagnostic } from '../diagnostic/index.js'
import type { Plugin } from '../types.js'

/** extras 拷贝。graph:true 本阶段不入图，只 warning。 */
export function copy(patterns: string | string[], opts?: { graph?: boolean }): Plugin {
  const list = Array.isArray(patterns) ? patterns : [patterns]
  return {
    name: 'copy',
    async generate(_file, ctx) {
      if (opts?.graph === true) {
        ctx.warn?.(
          diagnostic({
            code: 'COPY_GRAPH_UNSUPPORTED',
            severity: 'warning',
            message: 'COPY_GRAPH_UNSUPPORTED: copy({ graph: true }) is not implemented; using extras',
          }),
        )
      }
      const outputDir = ctx.outputDir
      const rootDir = ctx.rootDir
      const srcDir = ctx.srcDir
      if (!outputDir || !rootDir || !srcDir) {
        return
      }
      const files: Array<{ destPath: string; content: Buffer }> = []
      for (const pattern of list) {
        for (const abs of await expandPattern(rootDir, pattern, outputDir)) {
          const destPath = destFor(abs, rootDir, srcDir, outputDir)
          const content = await readFile(abs)
          ctx.addWatchFile?.(abs)
          files.push({ destPath, content })
        }
      }
      return files
    },
  }
}

function destFor(abs: string, rootDir: string, srcDir: string, outputDir: string): string {
  const fromSrc = relative(srcDir, abs)
  if (!fromSrc.startsWith('..') && !isAbsolute(fromSrc)) {
    return join(outputDir, fromSrc)
  }
  return join(outputDir, relative(rootDir, abs))
}

async function expandPattern(rootDir: string, pattern: string, outputDir: string): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, '/')
  if (!normalized.includes('*')) {
    const abs = resolve(rootDir, normalized)
    return existsSync(abs) ? [abs] : []
  }
  const out: string[] = []
  await walkFiles(rootDir, outputDir, async (abs) => {
    const rel = relative(rootDir, abs).split(sep).join('/')
    if (matchGlob(rel, normalized)) {
      out.push(abs)
    }
  })
  return out
}

async function walkFiles(
  dir: string,
  outputDir: string,
  visit: (abs: string) => Promise<void>,
): Promise<void> {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const abs = join(dir, name)
    let st
    try {
      st = await stat(abs)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') {
        continue
      }
      if (resolve(abs) === resolve(outputDir) || abs.startsWith(outputDir + sep)) {
        continue
      }
      await walkFiles(abs, outputDir, visit)
    } else if (st.isFile()) {
      await visit(abs)
    }
  }
}

function matchGlob(rel: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*')
  return new RegExp(`^${escaped}$`).test(rel)
}
