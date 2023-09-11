import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, resolveId, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-platform-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return { rootDir, srcDir: join(rootDir, 'src') }
}

function configOf(rootDir: string): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    platform: 'wx',
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

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('platform infix resolve', () => {
  it('prefers name.${platform}.js over name.js and lists the sibling', async () => {
    const { srcDir } = await fixture({
      'src/app.js': `require('./utils/a')\n`,
      'src/utils/a.js': `module.exports = 'plain'\n`,
      'src/utils/a.wx.js': `module.exports = 'wx'\n`,
    })

    const result = resolveId({
      request: './utils/a',
      importer: join(srcDir, 'app.js'),
      kind: 'script',
      adapter: weappAdapter,
      srcDir,
      platform: 'wx',
    })

    expect(result.id).toBe(join(srcDir, 'utils', 'a.wx.js'))
    expect(result.extraWatchFiles).toEqual([join(srcDir, 'utils', 'a.js')])
  })

  it('prefers index.${platform}.js in a directory', async () => {
    const { srcDir } = await fixture({
      'src/app.js': `require('./n')\n`,
      'src/n/index.js': `module.exports = 'plain'\n`,
      'src/n/index.wx.js': `module.exports = 'wx'\n`,
    })

    expect(
      resolveId({
        request: './n',
        importer: join(srcDir, 'app.js'),
        kind: 'script',
        adapter: weappAdapter,
        srcDir,
        platform: 'wx',
      }),
    ).toEqual({
      id: join(srcDir, 'n', 'index.wx.js'),
      extraWatchFiles: [join(srcDir, 'n', 'index.js')],
    })
  })
})

describe('platform suite dest', () => {
  it('strips .wx from page suite dest and keeps it on non-suite', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/app.js': `require('./utils/a')\nApp({})\n`,
      'src/app.json': JSON.stringify({ pages: ['pages/user/index'] }),
      'src/pages/user/index.js': `Page({ plain: true })\n`,
      'src/pages/user/index.wx.js': `Page({ wx: true })\n`,
      'src/pages/user/index.json': '{}\n',
      'src/pages/user/index.wxml': '<view/>',
      'src/pages/user/index.wxss': '.a{}',
      'src/utils/a.js': `module.exports = 'plain'\n`,
      'src/utils/a.wx.js': `module.exports = 'wx'\n`,
    })

    const { graph, plan, diagnostics } = await createCompiler(configOf(rootDir)).run()
    const dist = join(rootDir, 'dist')

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.nodes.has('pages/user/index.wx.js')).toBe(true)
    expect(graph.nodes.get('pages/user/index.wx.js')?.pageType).toBe('page')
    expect(graph.nodes.get('pages/user/index.wx.js')?.extraWatchFiles).toEqual([
      join(srcDir, 'pages', 'user', 'index.js'),
    ])
    expect(graph.nodes.has('utils/a.wx.js')).toBe(true)
    expect(graph.nodes.get('utils/a.wx.js')?.pageType).toBeUndefined()
    expect(graph.nodes.get('utils/a.wx.js')?.extraWatchFiles).toEqual([
      join(srcDir, 'utils', 'a.js'),
    ])

    const byId = new Map(plan.placements.map((p) => [p.moduleId, p.destPath]))
    expect(byId.get('pages/user/index.wx.js')).toBe(join(dist, 'pages/user/index.js'))
    expect(byId.get('utils/a.wx.js')).toBe(join(dist, 'utils/a.wx.js'))

    expect(existsSync(join(dist, 'pages/user/index.js'))).toBe(true)
    expect(existsSync(join(dist, 'pages/user/index.wx.js'))).toBe(false)
    expect(existsSync(join(dist, 'utils/a.wx.js'))).toBe(true)
    expect(existsSync(join(dist, 'utils/a.js'))).toBe(false)
    expect(await readFile(join(dist, 'utils/a.wx.js'), 'utf8')).toContain("'wx'")
    expect(await readFile(join(dist, 'pages/user/index.js'), 'utf8')).toContain('wx: true')
  })
})
