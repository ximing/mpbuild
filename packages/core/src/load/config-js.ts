import { createRequire } from 'node:module'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 隔离 require `.config.js`，只接受纯对象；邻接 require 进 watchFiles。 */
export function loadConfigJs(absPath: string): { json: string; watchFiles: string[] } {
  const abs = resolve(absPath)
  const req = createRequire(pathToFileURL(abs))
  let resolved: string
  try {
    resolved = req.resolve(abs)
  } catch (err) {
    throw invalid(abs, err)
  }

  delete req.cache[resolved]
  const before = new Set(Object.keys(req.cache))

  let exported: unknown
  try {
    exported = req(resolved)
  } catch (err) {
    purgeNewModules(req, before)
    throw invalid(abs, err)
  }

  try {
    const value = unwrapExport(exported)
    if (!isPlainObject(value)) {
      throw invalid(abs, new Error('export must be a plain object'))
    }
    let json: string
    try {
      json = JSON.stringify(value)
    } catch (err) {
      throw invalid(abs, err)
    }
    return { json, watchFiles: collectWatchFiles(req, resolved) }
  } finally {
    purgeNewModules(req, before)
  }
}

/** basename `*.config.js`，或 json 槽命中 adapter 的 `.config.js` 后缀。 */
export function isConfigJsFile(sourcePath: string, jsonExts?: string[]): boolean {
  if (!sourcePath) {
    return false
  }
  if (basename(sourcePath).endsWith('.config.js')) {
    return true
  }
  return (jsonExts ?? []).some((ext) => ext.includes('.config.js') && sourcePath.endsWith(ext))
}

function unwrapExport(exported: unknown): unknown {
  if (!isPlainObject(exported) || !('default' in exported)) {
    return exported
  }
  const rec = exported as { default?: unknown; __esModule?: unknown }
  const keys = Object.keys(rec)
  const interop = rec.__esModule === true || keys.every((k) => k === 'default' || k === '__esModule')
  return interop && rec.default !== undefined ? rec.default : exported
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function collectWatchFiles(req: NodeRequire, root: string): string[] {
  const mod = req.cache[root]
  if (!mod) {
    return []
  }
  const out: string[] = []
  const seen = new Set<string>([root])
  for (const child of mod.children) {
    if (seen.has(child.filename)) {
      continue
    }
    seen.add(child.filename)
    out.push(child.filename)
  }
  return out
}

function purgeNewModules(req: NodeRequire, before: Set<string>): void {
  for (const filename of Object.keys(req.cache)) {
    if (!before.has(filename)) {
      delete req.cache[filename]
    }
  }
}

function invalid(file: string, cause: unknown): Error {
  const message = cause instanceof Error ? cause.message : String(cause)
  return Object.assign(new Error(`CONFIG_JS_INVALID: ${file}: ${message}`, { cause }), {
    code: 'CONFIG_JS_INVALID',
  })
}
