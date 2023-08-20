import { existsSync, statSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import type { AbstractKind, TargetAdapter } from '../types.js'

/** 同目录、同 basename，按 adapter.sourceExts[kind] 找第一个存在的文件。 */
export function companionPath(
  scriptAbs: string,
  kind: AbstractKind,
  adapter: TargetAdapter,
): string | undefined {
  const dir = dirname(scriptAbs)
  const stem = stripLongestExt(basename(scriptAbs), adapter.sourceExts.script ?? [])
  for (const ext of adapter.sourceExts[kind] ?? []) {
    const candidate = join(dir, `${stem}${ext}`)
    if (isFile(candidate)) {
      return candidate
    }
  }
  return undefined
}

function stripLongestExt(fileName: string, exts: string[]): string {
  let matched = ''
  for (const ext of exts) {
    if (ext.length > matched.length && fileName.endsWith(ext)) {
      matched = ext
    }
  }
  if (matched) {
    return fileName.slice(0, -matched.length)
  }
  const extra = extname(fileName)
  return extra ? fileName.slice(0, -extra.length) : fileName
}

function isFile(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isFile()
}
