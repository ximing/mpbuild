import { existsSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TRANSFORM_CACHE_MAX_FILES,
  createCompiler,
  gcTransformCache,
  transformCacheDir,
  transformCacheKey,
  weappAdapter,
} from '../index'
import type { ResolvedConfig } from '../index'
import { cliDir, coreDir, readJson, v5Dir } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-cache-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

function configOf(rootDir: string, extra: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    entry: { pages: [] },
    output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
    resolve: { alias: {}, extensions: weappAdapter.sourceExts },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    projects: [],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: { pages: [] },
    configPath: '',
    ...extra,
  }
}

function mini(files: Record<string, string> = {}): Record<string, string> {
  return {
    'src/app.js': 'App({})\n',
    'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
    'src/pages/p/p.js': 'Page({ x: 1 })\n',
    ...files,
  }
}

function cacheFiles(rootDir: string): string[] {
  const dir = transformCacheDir(rootDir)
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir).filter((name) => !name.startsWith('.'))
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('transform cache', () => {
  it('locks sha256, cache dir, max files, and omits dest/owner from the key', () => {
    expect(TRANSFORM_CACHE_MAX_FILES).toBe(4096)
    expect(transformCacheDir('/app')).toBe(join('/app', 'node_modules', '.cache', 'mpbuild'))
    const corePkg = readJson(join(coreDir, 'package.json'))
    const deps = corePkg.dependencies as Record<string, string>
    expect(deps.xxhash).toBeUndefined()
    expect(deps.blake3).toBeUndefined()
    expect(deps['hash-wasm']).toBeUndefined()
    const a = transformCacheKey({
      hash: 'aaa',
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
      platform: 'wx',
      ifdefTokens: {},
      coreVersion: '5.0.0',
      swcVersion: '1',
      lightningcssVersion: '1',
      kind: 'script',
      ext: '.js',
      npmCompat: false,
    })
    const b = transformCacheKey({
      hash: 'bbb',
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
      platform: 'wx',
      ifdefTokens: {},
      coreVersion: '5.0.0',
      swcVersion: '1',
      lightningcssVersion: '1',
      kind: 'script',
      ext: '.js',
      npmCompat: false,
    })
    expect(a).toMatch(/^[a-f0-9]{64}$/)
    expect(a).not.toBe(b)
    expect(a).not.toContain('dist')
    expect(a).not.toContain('owner')
  })

  it('second build reads cache files; hash change misses; no-cache skips io', async () => {
    const rootDir = await fixture(mini())
    const dest = join(rootDir, 'dist/pages/p/p.js')
    await createCompiler(configOf(rootDir)).run()
    const first = cacheFiles(rootDir)
    expect(first.length).toBeGreaterThan(0)
    const cacheDir = transformCacheDir(rootDir)
    for (const name of first) {
      const file = join(cacheDir, name)
      writeFileSync(file, `/*CACHE_HIT*/\n${readFileSync(file, 'utf8')}`)
    }

    await createCompiler(configOf(rootDir)).run()
    expect(await readFile(dest, 'utf8')).toContain('CACHE_HIT')

    await writeFile(join(rootDir, 'src/pages/p/p.js'), 'Page({ x: 2 })\n')
    await createCompiler(configOf(rootDir)).run()
    expect(await readFile(dest, 'utf8')).toContain('x: 2')
    expect(await readFile(dest, 'utf8')).not.toContain('CACHE_HIT')
    expect(cacheFiles(rootDir).length).toBeGreaterThan(first.length)

    const isolated = await fixture(mini())
    await createCompiler(configOf(isolated), { cache: false }).run()
    expect(cacheFiles(isolated)).toEqual([])
    expect(existsSync(join(isolated, 'dist/pages/p/p.js'))).toBe(true)

    for (const name of cacheFiles(rootDir)) {
      const file = join(cacheDir, name)
      writeFileSync(file, `/*CACHE_HIT*/\n${readFileSync(file, 'utf8')}`)
    }
    await createCompiler(configOf(rootDir), { cache: false }).run()
    expect(await readFile(dest, 'utf8')).not.toContain('CACHE_HIT')
  })

  it('output.clean does not delete the transform cache', async () => {
    const rootDir = await fixture(mini())
    await createCompiler(configOf(rootDir)).run()
    const names = cacheFiles(rootDir)
    expect(names.length).toBeGreaterThan(0)
    await createCompiler(configOf(rootDir)).run()
    expect(cacheFiles(rootDir).length).toBeGreaterThan(0)
    for (const name of names) {
      expect(existsSync(join(transformCacheDir(rootDir), name))).toBe(true)
    }
  })

  it('gc drops oldest files down to maxFiles', async () => {
    const rootDir = await fixture({})
    const dir = transformCacheDir(rootDir)
    await mkdir(dir, { recursive: true })
    const now = Date.now() / 1000
    for (const [i, name] of ['a', 'b', 'c', 'd'].entries()) {
      const file = join(dir, name)
      writeFileSync(file, name)
      utimesSync(file, now + i, now + i)
    }
    await gcTransformCache(dir, 2)
    const left = readdirSync(dir).sort()
    expect(left).toEqual(['c', 'd'])
  })
})

describe('mpb build --no-cache', () => {
  it('does not write cache files', { timeout: 60_000 }, async () => {
    const rootDir = await fixture({
      ...mini(),
      'package.json': JSON.stringify({ type: 'module' }),
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: ['pages/p/p'] } }\n",
    })
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
    const result = spawnSync(process.execPath, [join(cliDir, 'bin/mpb.js'), 'build', '--no-cache'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
    })
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(cacheFiles(rootDir)).toEqual([])
    expect(existsSync(join(rootDir, 'dist/pages/p/p.js'))).toBe(true)
  })
})
