import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-build-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

function configOf(rootDir: string): ResolvedConfig {
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
    configPath: '',
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('createCompiler', () => {
  it('emits page suites and keeps plugin:// specifiers', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': "require('./lib'); require('plugin://x/y')\n",
      'src/pages/index/index.json': JSON.stringify({ usingComponents: { x: 'plugin://x/y' } }),
      'src/pages/index/index.wxml': '<view/>',
      'src/pages/index/index.wxss': '.a{color:red}',
      'src/pages/index/lib.js': 'module.exports = 1\n',
    })

    const { diagnostics } = await createCompiler(configOf(rootDir)).run()

    const dist = join(rootDir, 'dist')
    expect(existsSync(join(dist, 'app.js'))).toBe(true)
    expect(existsSync(join(dist, 'app.json'))).toBe(true)
    expect(existsSync(join(dist, 'pages/index/index.js'))).toBe(true)
    expect(existsSync(join(dist, 'pages/index/index.json'))).toBe(true)
    expect(existsSync(join(dist, 'pages/index/index.wxml'))).toBe(true)
    expect(existsSync(join(dist, 'pages/index/index.wxss'))).toBe(true)
    expect(existsSync(join(dist, 'pages/index/lib.js'))).toBe(true)

    const destPaths = existsSync(dist) ? await readdir(dist, { recursive: true }) : []
    expect(destPaths.some((p) => p.includes('plugin:'))).toBe(false)

    expect(await readFile(join(dist, 'pages/index/index.json'), 'utf8')).toContain('plugin://x/y')
    expect(await readFile(join(dist, 'pages/index/index.js'), 'utf8')).toContain('plugin://x/y')
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(false)
  })

  it('copies url() assets next to rewritten wxss', async () => {
    const png = Buffer.from([137, 80, 78, 71, 9, 8, 7, 6])
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({})\n',
      'src/pages/p/p.wxss': ".a{background:url('./x.png')}",
    })
    await writeFile(join(rootDir, 'src/pages/p/x.png'), png)
    const { diagnostics } = await createCompiler(configOf(rootDir)).run()
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const dest = join(rootDir, 'dist/pages/p/x.png')
    expect(existsSync(dest)).toBe(true)
    expect(Buffer.from(await readFile(dest)).equals(png)).toBe(true)
    const wxss = await readFile(join(rootDir, 'dist/pages/p/p.wxss'), 'utf8')
    expect(wxss).toMatch(/url\(\s*['"]?\.\/x\.png['"]?\s*\)/)
  })
})
