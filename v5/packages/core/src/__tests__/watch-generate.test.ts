import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, projectConfig, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-gen-'))
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
    projects: [],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: { pages: [] },
    configPath: '',
    plugins: [projectConfig({ projectname: 'keep-extras', appId: 'touristappid' })],
  }
}

describe('watch generate extras', () => {
  it('keeps project.config.json after applyWatchTick changes a js file', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({ x: 1 })\n',
    })
    const compiler = createCompiler(configOf(rootDir))
    await compiler.run()
    const extra = join(rootDir, 'dist/project.config.json')
    expect(existsSync(extra)).toBe(true)

    await writeFile(join(rootDir, 'src/pages/p/p.js'), 'Page({ x: 2 })\n')
    await compiler.applyWatchTick({
      changedIds: ['pages/p/p.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(existsSync(extra)).toBe(true)
  })
})
