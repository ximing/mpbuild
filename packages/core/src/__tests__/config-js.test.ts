import { createHash } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, loadConfigJs, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-config-js-'))
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
  extra: Partial<Pick<ResolvedConfig, 'platform'>> = {},
): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    ...(extra.platform !== undefined ? { platform: extra.platform } : {}),
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
  }
}

function miniPage(files: Record<string, string> = {}): Record<string, string> {
  return {
    'src/app.js': 'App({})\n',
    'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
    'src/pages/p/p.js': 'Page({})\n',
    'src/pages/p/p.wxml': '<view/>',
    'src/components/c/c.js': 'Component({})\n',
    ...files,
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('loadConfigJs', () => {
  it('stringifies a CJS plain object and lists required files', async () => {
    const { srcDir } = await fixture({
      'src/pages/p/extra.js': `module.exports = { x: '/components/c/c' }\n`,
      'src/pages/p/index.config.js': `module.exports = { usingComponents: require('./extra') }\n`,
    })
    const abs = join(srcDir, 'pages/p/index.config.js')
    const loaded = loadConfigJs(abs)
    expect(JSON.parse(loaded.json)).toEqual({ usingComponents: { x: '/components/c/c' } })
    expect(loaded.watchFiles).toEqual([realpathSync(join(srcDir, 'pages/p/extra.js'))])
  })

  it('rejects a non-object export', async () => {
    const { srcDir } = await fixture({
      'src/pages/p/index.config.js': `module.exports = function bad() {}\n`,
    })
    expect(() => loadConfigJs(join(srcDir, 'pages/p/index.config.js'))).toThrow(/CONFIG_JS_INVALID/)
  })
})

describe('createCompiler config.js', () => {
  it('emits dest json with usingComponents and intern the component', async () => {
    const { rootDir } = await fixture(
      miniPage({
        'src/pages/p/p.config.js': `module.exports = { usingComponents: { x: '/components/c/c' } }\n`,
      }),
    )

    const { graph, plan, diagnostics } = await createCompiler(configOf(rootDir)).run()
    const dist = join(rootDir, 'dist')
    const destJson = join(dist, 'pages/p/p.json')

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('pages/p/p.config.js')).toBe(true)
    expect(graph.nodes.get('pages/p/p.config.js')?.kind).toBe('json')
    const jsonBytes = JSON.stringify({ usingComponents: { x: '/components/c/c' } })
    expect(graph.nodes.get('pages/p/p.config.js')?.meta.code).toBe(jsonBytes)
    expect(graph.nodes.get('pages/p/p.config.js')?.hash).toBe(
      createHash('sha256').update(jsonBytes).digest('hex'),
    )
    expect(graph.nodes.has('components/c/c.js')).toBe(true)
    expect(graph.nodes.get('components/c/c.js')?.pageType).toBe('component')

    const byId = new Map(plan.placements.map((p) => [p.moduleId, p.destPath]))
    expect(byId.get('pages/p/p.config.js')).toBe(destJson)
    expect(existsSync(destJson)).toBe(true)
    expect(existsSync(join(dist, 'pages/p/p.config.js'))).toBe(false)
    expect(existsSync(join(dist, 'pages/p/p.config.json'))).toBe(false)
    expect(JSON.parse(await readFile(destJson, 'utf8')).usingComponents.x).toBeTruthy()
  })

  it('emits p.json not p.wx.json from page index.wx.config.js', async () => {
    const { rootDir } = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({})\n',
      'src/pages/p/p.wx.config.js': `module.exports = { navigationBarTitleText: 'wx' }\n`,
      'src/pages/p/p.wxml': '<view/>',
    })

    const { graph, plan, diagnostics } = await createCompiler(
      configOf(rootDir, { platform: 'wx' }),
    ).run()
    const dist = join(rootDir, 'dist')
    const destJson = join(dist, 'pages/p/p.json')
    const byId = new Map(plan.placements.map((p) => [p.moduleId, p.destPath]))

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('pages/p/p.wx.config.js')).toBe(true)
    expect(graph.nodes.get('pages/p/p.wx.config.js')?.kind).toBe('json')
    expect(byId.get('pages/p/p.wx.config.js')).toBe(destJson)
    expect(existsSync(destJson)).toBe(true)
    expect(existsSync(join(dist, 'pages/p/p.wx.json'))).toBe(false)
    expect(existsSync(join(dist, 'pages/p/p.wx.config.json'))).toBe(false)
    expect(existsSync(join(dist, 'pages/p/p.config.json'))).toBe(false)
    expect(JSON.parse(await readFile(destJson, 'utf8'))).toEqual({
      navigationBarTitleText: 'wx',
    })
  })

  it('prefers index.${platform}.config.js over index.config.js', async () => {
    const { rootDir } = await fixture(
      miniPage({
        'src/pages/p/p.config.js': `module.exports = { usingComponents: { x: '/components/plain/plain' } }\n`,
        'src/pages/p/p.wx.config.js': `module.exports = { usingComponents: { x: '/components/c/c' } }\n`,
        'src/components/plain/plain.js': 'Component({})\n',
      }),
    )

    const { graph, diagnostics } = await createCompiler(configOf(rootDir, { platform: 'wx' })).run()

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('pages/p/p.wx.config.js')).toBe(true)
    expect(graph.nodes.has('pages/p/p.config.js')).toBe(false)
    expect(graph.nodes.has('components/c/c.js')).toBe(true)
    expect(graph.nodes.has('components/plain/plain.js')).toBe(false)
  })

  it('records CONFIG_JS_INVALID when the export is not a plain object', async () => {
    const { rootDir } = await fixture(
      miniPage({
        'src/pages/p/p.config.js': `module.exports = 1\n`,
      }),
    )

    const { diagnostics } = await createCompiler(configOf(rootDir)).run()
    expect(diagnostics.some((d) => d.code === 'CONFIG_JS_INVALID' && d.severity === 'error')).toBe(
      true,
    )
  })
})
