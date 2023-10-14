import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copy, createCompiler, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string | Buffer>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-copy-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function configOf(rootDir: string, plugins: ResolvedConfig['plugins']): ResolvedConfig {
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
    plugins,
  }
}

describe('copy()', () => {
  it('copies src/tabbar.png into dist and keeps it after a watch tick', async () => {
    const png = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4])
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({})\n',
      'src/tabbar.png': png,
    })
    const compiler = createCompiler(configOf(rootDir, [copy('src/tabbar.png')]))
    const result = await compiler.run()
    const dest = join(rootDir, 'dist/tabbar.png')
    expect(existsSync(dest)).toBe(true)
    expect(Buffer.from(await readFile(dest)).equals(png)).toBe(true)
    expect(result.dests.some((file) => file.replace(/\\/g, '/').endsWith('tabbar.png'))).toBe(true)

    await writeFile(join(rootDir, 'src/pages/p/p.js'), 'Page({ x: 1 })\n')
    await compiler.applyWatchTick({
      changedIds: ['pages/p/p.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(existsSync(dest)).toBe(true)
  })
})
