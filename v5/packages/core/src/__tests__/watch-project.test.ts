import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCompiler,
  graphIdFromAbs,
  startWatch,
  watchPaths,
  weappAdapter,
} from '../index'
import type { Module, ModuleGraph, ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-one-'))
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

function configOf(rootDir: string, oneSrc: string): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    entry: { pages: [] },
    output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
    resolve: {
      alias: { '@one': oneSrc },
      extensions: weappAdapter.sourceExts,
    },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    projects: [{ name: '@one', src: oneSrc, alias: {} }],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: { pages: [] },
    configPath: '',
  }
}

describe('graphIdFromAbs', () => {
  it('returns @one id from sourcePath, not ../projects/one', async () => {
    const rootDir = await fixture({
      'src/app.js': "require('@one/utils/b')\n",
      'projects/one/utils/b.js': 'module.exports = 1\n',
    })
    const srcDir = join(rootDir, 'src')
    const oneSrc = join(rootDir, 'projects', 'one')
    const abs = join(oneSrc, 'utils', 'b.js')
    const graph: ModuleGraph = {
      entries: ['app.js'],
      nodes: new Map([
        [
          '@one/utils/b.js',
          {
            id: '@one/utils/b.js',
            kind: 'script',
            sourcePath: abs,
            owner: 'main',
            hash: '',
            meta: {},
          } satisfies Module,
        ],
      ]),
      edges: [],
      packages: [],
    }
    const projects = [{ name: '@one', src: oneSrc, alias: {} }]
    expect(graphIdFromAbs(graph, abs, srcDir, projects)).toBe('@one/utils/b.js')
    expect(graphIdFromAbs(graph, abs, srcDir, projects)).not.toContain('../')
  })

  it('falls back to intern formula when sourcePath is missing', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'projects/one/utils/b.js': 'module.exports = 1\n',
    })
    const srcDir = join(rootDir, 'src')
    const oneSrc = join(rootDir, 'projects', 'one')
    const abs = join(oneSrc, 'utils', 'b.js')
    const empty: ModuleGraph = { entries: [], nodes: new Map(), edges: [], packages: [] }
    expect(
      graphIdFromAbs(empty, abs, srcDir, [{ name: '@one', src: oneSrc, alias: {} }]),
    ).toBe('@one/utils/b.js')
    expect(graphIdFromAbs(empty, join(srcDir, 'app.js'), srcDir, [])).toBe('app.js')
  })
})

describe('createCompiler @one watch', () => {
  it('applyWatchTick and chokidar change update dist/@one', async () => {
    const rootDir = await fixture({
      'src/app.js': "require('@one/utils/b')\n",
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': 'Page({})\n',
      'projects/one/utils/b.js': 'module.exports = 1\n',
    })
    const oneSrc = join(rootDir, 'projects', 'one')
    const compiler = createCompiler(configOf(rootDir, oneSrc))
    await compiler.run()
    const dest = join(rootDir, 'dist/@one/utils/b.js')
    expect(existsSync(dest)).toBe(true)

    await writeFile(join(oneSrc, 'utils', 'b.js'), "module.exports = 'from-one-v2'\n")
    const tick = await compiler.applyWatchTick({
      changedIds: ['@one/utils/b.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(await readFile(dest, 'utf8')).toContain('from-one-v2')

    const srcDir = join(rootDir, 'src')
    const seen: string[] = []
    const handle = await startWatch({
      paths: watchPaths(tick.graph, srcDir, [{ name: '@one', src: oneSrc, alias: {} }]),
      srcDir,
      graph: tick.graph,
      projects: [{ name: '@one', src: oneSrc, alias: {} }],
      onTick: async (batch) => {
        seen.push(...batch.changedIds)
      },
      onConfigChange: async () => {},
    })
    try {
      await writeFile(join(oneSrc, 'utils', 'b.js'), "module.exports = 'from-one-v3'\n")
      await vi.waitFor(
        () => {
          expect(seen).toContain('@one/utils/b.js')
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }

    const live = await compiler.watch()
    try {
      await writeFile(join(oneSrc, 'utils', 'b.js'), "module.exports = 'from-one-v4'\n")
      await vi.waitFor(
        async () => {
          expect(await readFile(dest, 'utf8')).toContain('from-one-v4')
        },
        { timeout: 4000 },
      )
    } finally {
      await live.close()
    }
  })
})

describe('createCompiler @one add companion', () => {
  it('attaches a new wxml under @one after applyWatchTick add', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': 'Page({})\n',
      'src/pages/index/index.json': JSON.stringify({
        usingComponents: { test: '@one/pages/test/index' },
      }),
      'projects/one/pages/test/index.js': 'Component({})\n',
      'projects/one/pages/test/index.json': JSON.stringify({ component: true }),
    })
    const oneSrc = join(rootDir, 'projects', 'one')
    const compiler = createCompiler(configOf(rootDir, oneSrc))
    const first = await compiler.run()
    expect(first.graph.nodes.has('@one/pages/test/index.js')).toBe(true)
    expect(first.graph.nodes.has('@one/pages/test/index.wxml')).toBe(false)

    await writeFile(join(oneSrc, 'pages/test/index.wxml'), '<view/>\n')
    const tick = await compiler.applyWatchTick({
      changedIds: [],
      deletedIds: [],
      addedRelPaths: ['@one/pages/test/index.wxml'],
    })
    expect(tick.graph.nodes.has('@one/pages/test/index.wxml')).toBe(true)
    expect(tick.graph.nodes.get('@one/pages/test/index.wxml')?.kind).toBe('template')
    expect(tick.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: '@one/pages/test/index.js',
          to: '@one/pages/test/index.wxml',
        }),
      ]),
    )
  })
})

