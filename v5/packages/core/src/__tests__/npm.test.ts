import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, npmCompat, planGraph, resolveId, weappAdapter } from '../index'
import type { Module, ModuleGraph, ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-npm-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return { rootDir, srcDir: join(rootDir, 'src') }
}

function configOf(
  rootDir: string,
  extra: Partial<Pick<ResolvedConfig, 'output'>> = {},
): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    entry: { pages: [] },
    output: extra.output ?? { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
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
  }
}

function mod(id: string, extra: Partial<Omit<Module, 'id'>> = {}): Module {
  return {
    id,
    kind: 'script',
    sourcePath: id,
    owner: 'main',
    hash: '',
    meta: {},
    ...extra,
  }
}

function graphOf(nodes: Module[]): ModuleGraph {
  return {
    entries: nodes.map((node) => node.id),
    nodes: new Map(nodes.map((node) => [node.id, node])),
    edges: [],
    packages: [],
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('resolve npm packages', () => {
  it('walks up from importer to node_modules/leftpad and reads main', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/a.js': `require('leftpad')\n`,
      'node_modules/leftpad/package.json': JSON.stringify({ name: 'leftpad', main: 'index.js' }),
      'node_modules/leftpad/index.js': `module.exports = function leftpad(s) { return s }\n`,
    })

    expect(
      resolveId({
        request: 'leftpad',
        importer: join(srcDir, 'a.js'),
        kind: 'script',
        adapter: weappAdapter,
        srcDir,
      }),
    ).toEqual({
      id: join(rootDir, 'node_modules', 'leftpad', 'index.js'),
    })
  })

  it('prefers miniprogram over main', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/a.js': `require('pkg')\n`,
      'node_modules/pkg/package.json': JSON.stringify({
        name: 'pkg',
        miniprogram: 'miniprogram_dist',
        main: 'index.js',
      }),
      'node_modules/pkg/index.js': `module.exports = 'main'\n`,
      'node_modules/pkg/miniprogram_dist/index.js': `module.exports = 'mini'\n`,
    })

    expect(
      resolveId({
        request: 'pkg',
        importer: join(srcDir, 'a.js'),
        kind: 'script',
        adapter: weappAdapter,
        srcDir,
      }).id,
    ).toBe(join(rootDir, 'node_modules', 'pkg', 'miniprogram_dist', 'index.js'))
  })
})

describe('planGraph npm dest', () => {
  it('places node_modules files under output.npm + path inside the package', () => {
    const graph = graphOf([
      mod('npm/leftpad/index.js', {
        sourcePath: '/proj/node_modules/leftpad/index.js',
      }),
    ])

    const { plan } = planGraph(graph, {
      outputDir: 'dist',
      shared: 'duplicate',
      adapter: weappAdapter,
      npm: 'npm',
    })

    expect(plan.placements).toEqual([
      {
        moduleId: 'npm/leftpad/index.js',
        destPath: 'dist/npm/leftpad/index.js',
        package: 'main',
      },
    ])
  })

  it('uses config output.npm as the dest prefix', () => {
    const graph = graphOf([
      mod('npm/leftpad/index.js', {
        sourcePath: '/proj/node_modules/leftpad/index.js',
      }),
    ])

    const { plan } = planGraph(graph, {
      outputDir: 'dist',
      shared: 'duplicate',
      adapter: weappAdapter,
      npm: 'miniprogram_npm',
    })

    expect(plan.placements[0]?.destPath).toBe('dist/miniprogram_npm/leftpad/index.js')
  })
})

describe('npmCompat', () => {
  it('runs SWC on node_modules scripts and leaves require(fs) in place', () => {
    const { code } = npmCompat({
      kind: 'script',
      sourcePath: '/proj/node_modules/leftpad/index.ts',
      code: "require('fs');\nexport const n: number = 1\n",
      js: { target: 'es2018', module: 'commonjs' },
    })
    expect(code).toContain("require('fs')")
    expect(code).not.toContain('number')
  })
})

describe('createCompiler npm', () => {
  it('emits leftpad under dist/npm and rewrites src/a.js to a relative npm path', async () => {
    const { rootDir } = await fixture({
      'src/app.js': `require('./a')\nApp({})\n`,
      'src/a.js': `require('leftpad')\n`,
      'node_modules/leftpad/package.json': JSON.stringify({ name: 'leftpad', main: 'index.js' }),
      'node_modules/leftpad/index.js': `module.exports = function leftpad(s) { return s }\n`,
    })

    const { graph, diagnostics } = await createCompiler(configOf(rootDir)).run()
    const dist = join(rootDir, 'dist')

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('npm/leftpad/index.js')).toBe(true)
    expect(existsSync(join(dist, 'npm/leftpad/index.js'))).toBe(true)
    expect(existsSync(join(dist, 'a.js'))).toBe(true)
    expect(await readFile(join(dist, 'a.js'), 'utf8')).toMatch(
      /['"]\.\/npm\/leftpad\/index\.js['"]/,
    )
  })
})
