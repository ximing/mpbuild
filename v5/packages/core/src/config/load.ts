import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getTargetAdapter } from '../target/index.js'
import type { Plugin, TargetAdapter } from '../types.js'
import { loadAppEntry } from './entry.js'
import { userConfigSchema, type AliasValue, type ResolvedConfig } from './schema.js'

const CONFIG_NAMES = ['mpbuild.config.ts', 'mpbuild.config.mts', 'mpbuild.config.js'] as const

export function defineConfig<T>(config: T): T {
  return config
}

function resolveTarget(target: string | TargetAdapter): TargetAdapter {
  return typeof target === 'string' ? getTargetAdapter(target) : target
}

export async function loadConfig(rootDir: string): Promise<ResolvedConfig> {
  const configPath = CONFIG_NAMES.map((name) => join(rootDir, name)).find((file) => existsSync(file))
  if (!configPath) {
    if (existsSync(join(rootDir, 'mpb.config.js'))) {
      throw Object.assign(new Error('LEGACY_CONFIG: use mpbuild.config.js instead of mpb.config.js'), {
        code: 'LEGACY_CONFIG',
      })
    }
    throw Object.assign(new Error(`CONFIG_NOT_FOUND: no mpbuild.config in ${rootDir}`), {
      code: 'CONFIG_NOT_FOUND',
    })
  }

  const imported = (await import(pathToFileURL(configPath).href)) as { default?: unknown }
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
  }
}
