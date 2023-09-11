import { basename, dirname, extname, join } from 'node:path'
import { pickNamedSource } from '../resolve/resolver.js'
import type { AbstractKind, TargetAdapter } from '../types.js'

/** 同目录、同逻辑 basename；platform 时先试 name.${platform}${ext}。 */
export function companionPath(
  scriptAbs: string,
  kind: AbstractKind,
  adapter: TargetAdapter,
  platform?: string,
): string | undefined {
  const dir = dirname(scriptAbs)
  const stem = stripLongestExt(basename(scriptAbs), adapter.sourceExts.script ?? [])
  const logical = stripPlatformStem(stem, platform)
  return pickNamedSource(join(dir, logical), adapter.sourceExts[kind] ?? [], platform)?.id
}

function stripPlatformStem(stem: string, platform?: string): string {
  if (!platform) {
    return stem
  }
  const infix = `.${platform}`
  return stem.endsWith(infix) ? stem.slice(0, -infix.length) : stem
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
