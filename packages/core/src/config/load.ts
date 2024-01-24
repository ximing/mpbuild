import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import { getTargetAdapter } from '../target/index.js'
import type { Plugin, TargetAdapter } from '../types.js'
import { loadAppEntry } from './entry.js'
import { importFresh } from './import-fresh.js'
import { userConfigSchema, type AliasValue, type ResolvedConfig } from './schema.js'

export const CONFIG_NAMES = [
  'mpbuild.config.ts',
  'mpbuild.config.mts',
  'mpbuild.config.js',
  'mpbuild.config.mjs',
] as const

export function defineConfig<T>(config: T): T {
  return config
}

function resolveTarget(target: string | TargetAdapter): TargetAdapter {
  return typeof target === 'string' ? getTargetAdapter(target) : target
}

function isTsConfigPath(file: string): boolean {
  return file.endsWith('.ts') || file.endsWith('.mts')
}

/** leftover .ts 且生产 Node 不能 import 时跳过；SyntaxError 不跳。 */
function isUnknownConfigExtension(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'ERR_UNKNOWN_FILE_EXTENSION' || code === 'ERR_UNKNOWN_EXTENSION') {
    return true
  }
  const message = err instanceof Error ? err.message : String(err)
  return /unknown file extension/i.test(message)
}

export async function loadConfig(rootDir: string): Promise<ResolvedConfig> {
  const existing = CONFIG_NAMES.map((name) => join(rootDir, name)).filter((file) => existsSync(file))
  if (existing.length === 0) {
    if (existsSync(join(rootDir, 'mpb.config.js'))) {
      throw Object.assign(new Error('LEGACY_CONFIG: use mpbuild.config.js instead of mpb.config.js'), {
        code: 'LEGACY_CONFIG',
      })
    }
    throw Object.assign(new Error(`CONFIG_NOT_FOUND: no mpbuild.config in ${rootDir}`), {
      code: 'CONFIG_NOT_FOUND',
    })
  }

  const loadWarnings: Diagnostic[] = []
  let imported: { default?: unknown } | undefined
  let configPath: string | undefined
  for (const file of existing) {
    try {
      imported = (await importFresh(file)) as { default?: unknown }
      configPath = file
      break
    } catch (err) {
      if (isTsConfigPath(file) && isUnknownConfigExtension(err)) {
        loadWarnings.push(
          diagnostic({
            code: 'CONFIG_TS_SKIPPED',
            severity: 'warning',
            message: `CONFIG_TS_SKIPPED: cannot import ${file}; trying next mpbuild.config.*`,
            file,
          }),
        )
        continue
      }
      throw err
    }
  }
  if (!imported || !configPath) {
    throw Object.assign(
      new Error(`CONFIG_TS_SKIPPED: cannot load TypeScript config and no js/mjs fallback in ${rootDir}`),
      { code: 'CONFIG_TS_SKIPPED' },
    )
  }

  const parsed = userConfigSchema.parse(imported.default ?? imported)
  const target = resolveTarget(parsed.target)
  const appEntry = await loadAppEntry(rootDir, parsed.entry)

  return {
    rootDir,
    src: parsed.src,
    target,
    platform: parsed.platform,
    entry: parsed.entry,
    output: parsed.output,
    resolve: {
      alias: parsed.resolve.alias as Record<string, AliasValue>,
      extensions: { ...target.sourceExts, ...parsed.resolve.extensions },
    },
    compile: parsed.compile,
    subPackage: parsed.subPackage,
    projects: parsed.projects,
    ifdef: parsed.ifdef,
    appEntry,
    configPath,
    plugins: Array.isArray(parsed.plugins) ? (parsed.plugins as Plugin[]) : undefined,
    loadWarnings,
  }
}

/** 原地刷新 current（compiler 闭包的同一对象）。 */
export async function reloadConfig(current: ResolvedConfig): Promise<ResolvedConfig> {
  const next = await loadConfig(current.rootDir)
  Object.assign(current, next)
  return current
}
