import { isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AppEntry } from './schema.js'

/** 字符串路径相对 rootDir 动态 import；失败抛 ENTRY_LOAD。 */
export async function loadAppEntry(rootDir: string, entry: string | Record<string, unknown>): Promise<AppEntry> {
  if (typeof entry !== 'string') {
    return asAppEntry(entry)
  }

  const abs = isAbsolute(entry) ? entry : join(rootDir, entry)
  try {
    const imported = (await import(pathToFileURL(abs).href)) as {
      default?: unknown
      module?: { exports?: unknown }
    }
    const value = imported.default ?? imported.module?.exports ?? imported
    return asAppEntry(value)
  } catch (err) {
    if (isCoded(err, 'ENTRY_LOAD')) {
      throw err
    }
    const message = err instanceof Error ? err.message : String(err)
    throw Object.assign(new Error(`ENTRY_LOAD: cannot load ${abs}: ${message}`, { cause: err }), {
      code: 'ENTRY_LOAD',
    })
  }
}

function asAppEntry(value: unknown): AppEntry {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('ENTRY_LOAD: entry must be an object'), { code: 'ENTRY_LOAD' })
  }
  return value as AppEntry
}

function isCoded(err: unknown, code: string): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === code)
}
