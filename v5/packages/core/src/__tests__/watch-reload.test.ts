import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCompiler,
  loadConfig,
  reloadConfig,
  startWatch,
} from '../index'
import type { ModuleGraph } from '../index'
import { coreDir } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-reload-'))
  dirs.push(rootDir)
  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ type: 'module' }))
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

const emptyGraph: ModuleGraph = { entries: [], nodes: new Map(), edges: [], packages: [] }

describe('watch config/entry reload', () => {
  it('startWatch treats entry.js as onConfigChange via reloadFiles', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'entry.js': 'export default { pages: ["pages/a/a"] }\n',
    })
    const entryAbs = join(rootDir, 'entry.js')
    let reloads = 0
    const handle = await startWatch({
      paths: [entryAbs],
      srcDir: join(rootDir, 'src'),
      graph: emptyGraph,
      reloadFiles: [entryAbs],
      onTick: async () => {},
      onConfigChange: async () => {
        reloads += 1
      },
    })
    try {
      await writeFile(entryAbs, 'export default { pages: ["pages/b/b"] }\n')
      await vi.waitFor(
        () => {
          expect(reloads).toBeGreaterThan(0)
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }
  })

  it('reloadConfig then run picks up a new router page', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/pages/a/a.js': 'Page({})\n',
      'src/pages/b/b.js': 'Page({})\n',
      'entry.js':
        "export default { router: [{ root: '', pages: { 'pages/a/a': '/pages/a/a' } }] }\n",
      'mpbuild.config.js':
        "export default { src: 'src', entry: './entry.js', output: { dir: 'dist' } }\n",
    })
    const config = await loadConfig(rootDir)
    const compiler = createCompiler(config)
    await compiler.run()
    expect(existsSync(join(rootDir, 'dist/pages/a/a.js'))).toBe(true)
    expect(existsSync(join(rootDir, 'dist/pages/b/b.js'))).toBe(false)

    await writeFile(
      join(rootDir, 'entry.js'),
      "export default { router: [{ root: '', pages: { 'pages/a/a': '/pages/a/a', 'pages/b/b': '/pages/b/b' } }] }\n",
    )
    await reloadConfig(config)
    await compiler.run()
    expect(existsSync(join(rootDir, 'dist/pages/b/b.js'))).toBe(true)
  })

  it('compiler.watch onConfigChange calls reloadConfig', () => {
    const src = readFileSync(join(coreDir, 'src/compiler.ts'), 'utf8')
    expect(src).toContain('reloadConfig')
    expect(src).toContain('onConfigChange')
    const watchFn = src.slice(src.indexOf('async function watch'))
    const onCfg = watchFn.slice(watchFn.indexOf('onConfigChange'))
    expect(onCfg).toContain('reloadConfig')
    expect(onCfg).toContain('run()')
  })
})
