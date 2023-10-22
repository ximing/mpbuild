import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCompiler, watchPaths, weappAdapter } from '../index'
import type { Module, ModuleGraph, ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-dev-'))
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

function mod(id: string, sourcePath: string): Module {
  return {
    id,
    kind: 'script',
    sourcePath,
    owner: 'main',
    hash: '',
    meta: {},
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('watchPaths', () => {
  it('includes in-graph npm sourcePath files but not extraWatchFiles under node_modules', () => {
    const srcDir = join('/proj', 'src')
    const appPath = join(srcDir, 'app.js')
    const npmPath = join(srcDir, 'node_modules', 'x.js')
    const npmExtra = join(srcDir, 'node_modules', 'pkg', 'mix.js')
    const projectSrc = join('/proj', 'projects', 'one')
    const graph: ModuleGraph = {
      entries: ['app.js'],
      nodes: new Map([
        ['app.js', mod('app.js', appPath)],
        ['node_modules/x.js', mod('node_modules/x.js', npmPath)],
        [
          'lib.js',
          {
            ...mod('lib.js', join(srcDir, 'lib.js')),
            extraWatchFiles: [npmExtra],
          },
        ],
      ]),
      edges: [],
      packages: [],
    }

    const paths = watchPaths(graph, srcDir, [{ name: '@one', src: projectSrc, alias: {} }])
    expect(paths).toContain(appPath)
    expect(paths).toContain(srcDir)
    expect(paths).toContain(projectSrc)
    expect(paths).toContain(npmPath)
    expect(paths).not.toContain(npmExtra)
    expect(paths).not.toContain(dirname(npmPath))
  })

  it('includes extraWatchFiles outside node_modules', () => {
    const srcDir = join('/proj', 'src')
    const appPath = join(srcDir, 'app.js')
    const mixinPath = join(srcDir, 'wxss', 'mixin.wxss')
    const npmExtra = join(srcDir, 'node_modules', 'pkg', 'mix.js')
    const graph: ModuleGraph = {
      entries: ['app.js'],
      nodes: new Map([
        [
          'app.js',
          {
            ...mod('app.js', appPath),
            extraWatchFiles: [mixinPath, npmExtra],
          },
        ],
      ]),
      edges: [],
      packages: [],
    }
    const paths = watchPaths(graph, srcDir)
    expect(paths).toContain(mixinPath)
    expect(paths.some((p) => p.includes(`${sep}node_modules${sep}`))).toBe(false)
  })
})

describe('createCompiler watch', () => {
  it('updates dist after lib.js changes, then close()', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': "require('./lib')\n",
      'src/pages/index/lib.js': 'module.exports = 1\n',
    })
    const compiler = createCompiler(configOf(rootDir))
    const handle = await compiler.watch()
    try {
      const libDest = join(rootDir, 'dist/pages/index/lib.js')
      expect(existsSync(libDest)).toBe(true)

      await writeRel(rootDir, 'src/pages/index/lib.js', "module.exports = 'dev-watch-v2'\n")
      await vi.waitFor(
        async () => {
          expect(await readFile(libDest, 'utf8')).toContain('dev-watch-v2')
        },
        { timeout: 2000 },
      )
    } finally {
      await handle.close()
    }
  })

  it('watch() returns first-run MISSING_APP_JS and onDiagnostics sees ticks', async () => {
    const rootDir = await fixture({
      'src/pages/p/p.js': 'Page({})\n',
    })
    const codes: string[] = []
    const compiler = createCompiler(configOf(rootDir))
    const handle = await compiler.watch({
      onDiagnostics: (ds) => {
        codes.push(...ds.map((d) => d.code))
      },
    })
    try {
      expect(handle.diagnostics.some((d) => d.code === 'MISSING_APP_JS')).toBe(true)
      expect(codes).toContain('MISSING_APP_JS')
    } finally {
      await handle.close()
    }
  })

  it('unlink then write of an in-graph file updates dest content', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': "require('./lib')\n",
      'src/pages/index/lib.js': 'module.exports = 1\n',
    })
    const compiler = createCompiler(configOf(rootDir))
    const handle = await compiler.watch()
    try {
      const src = join(rootDir, 'src/pages/index/lib.js')
      const dest = join(rootDir, 'dist/pages/index/lib.js')
      expect(await readFile(dest, 'utf8')).toContain('1')
      await rm(src)
      await writeFile(src, "module.exports = 'after-atomic-save'\n")
      await vi.waitFor(
        async () => {
          expect(await readFile(dest, 'utf8')).toContain('after-atomic-save')
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }
  })
})
