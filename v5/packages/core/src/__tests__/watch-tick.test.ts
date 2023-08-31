import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

async function writeRel(rootDir: string, rel: string, content: string) {
  const abs = join(rootDir, rel)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, content)
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

describe('createCompiler applyWatchTick', () => {
  it('emits hash-only lib.js, then adds and removes a usingComponent dest', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': "require('./lib')\n",
      'src/pages/index/index.json': JSON.stringify({}),
      'src/pages/index/lib.js': 'module.exports = 1\n',
    })
    const compiler = createCompiler(configOf(rootDir))
    await compiler.run()

    const libDest = join(rootDir, 'dist/pages/index/lib.js')
    const componentDest = join(rootDir, 'dist/components/c/c.js')
    expect(existsSync(libDest)).toBe(true)

    await writeRel(rootDir, 'src/pages/index/lib.js', "module.exports = 'watch-tick-v2'\n")
    const hashTick = await compiler.applyWatchTick({
      changedIds: ['pages/index/lib.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(hashTick.topologyChanged).toBe(false)
    expect(hashTick.planChanged).toBe(false)
    expect(await readFile(libDest, 'utf8')).toContain('watch-tick-v2')

    await writeRel(
      rootDir,
      'src/pages/index/index.json',
      JSON.stringify({ usingComponents: { c: '/components/c/c' } }),
    )
    await writeRel(rootDir, 'src/components/c/c.js', 'Component({})\n')
    await writeRel(rootDir, 'src/components/c/c.json', JSON.stringify({ component: true }))
    await writeRel(rootDir, 'src/components/c/c.wxml', '<view/>')
    await writeRel(rootDir, 'src/components/c/c.wxss', '.c{color:red}')
    const addTick = await compiler.applyWatchTick({
      changedIds: ['pages/index/index.json'],
      deletedIds: [],
      addedRelPaths: [
        'components/c/c.js',
        'components/c/c.json',
        'components/c/c.wxml',
        'components/c/c.wxss',
      ],
    })
    expect(addTick.topologyChanged).toBe(true)
    expect(addTick.planChanged).toBe(true)
    expect(existsSync(componentDest)).toBe(true)

    await writeRel(rootDir, 'src/pages/index/index.json', JSON.stringify({}))
    const clearTick = await compiler.applyWatchTick({
      changedIds: ['pages/index/index.json'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(clearTick.topologyChanged).toBe(true)
    expect(existsSync(componentDest)).toBe(false)
  })

  it('duplicates shared lib.js into a third subpackage', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({
        pages: ['pages/index/index'],
        subPackages: [
          { root: 'pkgA', pages: ['a'] },
          { root: 'pkgB', pages: ['b'] },
        ],
      }),
      'src/pages/index/index.js': '',
      'src/pkgA/a.js': "require('../lib')\n",
      'src/pkgB/b.js': "require('../lib')\n",
      'src/lib.js': 'module.exports = 1\n',
    })
    const compiler = createCompiler(configOf(rootDir))
    await compiler.run()

    expect(existsSync(join(rootDir, 'dist/pkgA/lib.js'))).toBe(true)
    expect(existsSync(join(rootDir, 'dist/pkgB/lib.js'))).toBe(true)
    expect(existsSync(join(rootDir, 'dist/pkgC/lib.js'))).toBe(false)

    await writeRel(
      rootDir,
      'src/app.json',
      JSON.stringify({
        pages: ['pages/index/index'],
        subPackages: [
          { root: 'pkgA', pages: ['a'] },
          { root: 'pkgB', pages: ['b'] },
          { root: 'pkgC', pages: ['c'] },
        ],
      }),
    )
    await writeRel(rootDir, 'src/pkgC/c.js', "require('../lib')\n")
    const tick = await compiler.applyWatchTick({
      changedIds: ['app.json'],
      deletedIds: [],
      addedRelPaths: ['pkgC/c.js'],
    })
    expect(tick.topologyChanged).toBe(true)
    expect(tick.planChanged).toBe(true)
    expect(existsSync(join(rootDir, 'dist/pkgC/lib.js'))).toBe(true)
    expect(existsSync(join(rootDir, 'dist/pkgA/lib.js'))).toBe(true)
    expect(existsSync(join(rootDir, 'dist/pkgB/lib.js'))).toBe(true)
  })
})
