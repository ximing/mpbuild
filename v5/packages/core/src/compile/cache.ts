import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AbstractKind } from '../types.js'

export const TRANSFORM_CACHE_MAX_FILES = 4096

const require = createRequire(import.meta.url)
const corePkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'),
) as { version: string }

function depVersion(name: string): string {
  try {
    return (require(`${name}/package.json`) as { version: string }).version
  } catch {
    let dir = dirname(require.resolve(name))
    while (true) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
          name?: string
          version?: string
        }
        if (pkg.name === name && typeof pkg.version === 'string') {
          return pkg.version
        }
      } catch {
        // keep walking to the package root
      }
      const parent = dirname(dir)
      if (parent === dir) {
        throw new Error(`cannot read version for ${name}`)
      }
      dir = parent
    }
  }
}

export function compilerDepVersions(): {
  coreVersion: string
  swcVersion: string
  lightningcssVersion: string
} {
  return {
    coreVersion: corePkg.version,
    swcVersion: depVersion('@swc/core'),
    lightningcssVersion: depVersion('lightningcss'),
  }
}

export function transformCacheDir(rootDir: string): string {
  return join(rootDir, 'node_modules', '.cache', 'mpbuild')
}

export function transformCacheKey(input: {
  hash: string
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  css: { lightningcss: boolean }
  minify: boolean | Record<string, boolean>
  platform?: string
  ifdefTokens: Record<string, boolean | string>
  coreVersion: string
  swcVersion: string
  lightningcssVersion: string
  kind: AbstractKind
  ext: string
  npmCompat: boolean
}): string {
  const payload = JSON.stringify({
    hash: input.hash,
    js: input.js,
    css: input.css,
    minify: input.minify,
    platform: input.platform ?? '',
    ifdefTokens: input.ifdefTokens,
    coreVersion: input.coreVersion,
    swcVersion: input.swcVersion,
    lightningcssVersion: input.lightningcssVersion,
    kind: input.kind,
    ext: input.ext,
    npmCompat: input.npmCompat,
  })
  return createHash('sha256').update(payload).digest('hex')
}

export async function readTransformCache(cacheDir: string, key: string): Promise<string | undefined> {
  try {
    return await readFile(join(cacheDir, key), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw err
  }
}

export async function writeTransformCache(
  cacheDir: string,
  key: string,
  code: string,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(join(cacheDir, key), code)
  await gcTransformCache(cacheDir, TRANSFORM_CACHE_MAX_FILES)
}

export async function gcTransformCache(
  cacheDir: string,
  maxFiles: number = TRANSFORM_CACHE_MAX_FILES,
): Promise<void> {
  if (!existsSync(cacheDir)) {
    return
  }
  const names = readdirSync(cacheDir).filter((name) => {
    try {
      return statSync(join(cacheDir, name)).isFile()
    } catch {
      return false
    }
  })
  if (names.length <= maxFiles) {
    return
  }
  const ranked = names
    .map((name) => {
      const file = join(cacheDir, name)
      return { file, mtime: statSync(file).mtimeMs }
    })
    .sort((a, b) => a.mtime - b.mtime)
  const drop = ranked.length - maxFiles
  await Promise.all(ranked.slice(0, drop).map((item) => rm(item.file, { force: true })))
}

export function cacheExt(sourcePath: string): string {
  return extname(sourcePath).toLowerCase()
}
