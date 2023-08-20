import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  analyzeGraph,
  buildGraph,
  companionPath,
  EdgeKinds,
  pageScriptsFromAppJson,
  weappAdapter,
} from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-suite-'))
  dirs.push(rootDir)
  const srcDir = join(rootDir, 'src')
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(srcDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return { rootDir, srcDir }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('page suites from app.json', () => {
  it('expands app and page four-piece suites via page-suite edges', async () => {
    const { rootDir, srcDir } = await fixture({
      'app.js': '',
      'app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'pages/index/index.js': '',
      'pages/index/index.json': JSON.stringify({ usingComponents: {} }),
      'pages/index/index.wxml': '<view/>',
      'pages/index/index.wxss': '.a{}',
    })

    const { graph } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: ['src/app.js'],
    })

    expect(graph.nodes.has('app.js')).toBe(true)
    expect(graph.nodes.has('app.json')).toBe(true)
    expect(graph.nodes.has('pages/index/index.js')).toBe(true)
    expect(graph.nodes.has('pages/index/index.json')).toBe(true)
    expect(graph.nodes.has('pages/index/index.wxml')).toBe(true)
    expect(graph.nodes.has('pages/index/index.wxss')).toBe(true)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'app.js',
          to: 'app.json',
          kind: EdgeKinds.pageSuite,
          affectsOwnership: true,
        }),
        expect.objectContaining({
          from: 'pages/index/index.js',
          to: 'pages/index/index.wxml',
          kind: EdgeKinds.pageSuite,
          affectsOwnership: true,
        }),
      ]),
    )
  })

  it('emits MISSING_PAGE_JS and does not enqueue a missing page script', async () => {
    const { rootDir, srcDir } = await fixture({
      'app.js': '',
      'app.json': JSON.stringify({ pages: ['pages/missing/index'] }),
    })

    const { graph, diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: ['src/app.js'],
    })

    expect(diagnostics.some((d) => d.code === 'MISSING_PAGE_JS' && d.severity === 'error')).toBe(
      true,
    )
    expect([...graph.nodes.keys()].some((id) => id.includes('missing'))).toBe(false)
    expect(graph.entries).toEqual(['app.js'])
  })

  it('uses component-suite for usingComponent targets and fills graph.packages', async () => {
    const { rootDir, srcDir } = await fixture({
      'app.js': '',
      'app.json': JSON.stringify({
        pages: ['pages/index/index'],
        subPackages: [{ root: 'pkgA', pages: ['pages/x'], independent: true }],
      }),
      'pages/index/index.js': '',
      'pages/index/index.json': JSON.stringify({
        usingComponents: { comp: '/components/comp/index' },
      }),
      'pages/index/index.wxml': '<view/>',
      'components/comp/index.js': '',
      'components/comp/index.json': JSON.stringify({ component: true }),
      'components/comp/index.wxml': '<view/>',
      'pkgA/pages/x.js': 'module.exports = 1\n',
    })

    const { graph, diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: ['src/app.js'],
    })

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(graph.packages).toEqual([{ root: '' }, { root: 'pkgA', independent: true }])
    expect(graph.entries).toEqual(
      expect.arrayContaining(['app.js', 'pages/index/index.js', 'pkgA/pages/x.js']),
    )
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'components/comp/index.js',
          to: 'components/comp/index.wxml',
          kind: EdgeKinds.componentSuite,
          affectsOwnership: true,
        }),
      ]),
    )

    analyzeGraph(graph, graph.packages, weappAdapter)
    expect(graph.nodes.get('pages/index/index.js')?.owner).toBe('main')
    expect(graph.nodes.get('pkgA/pages/x.js')?.owner).toBe('pkgA')
  })

  it('stays silent when companions are missing', async () => {
    const { rootDir, srcDir } = await fixture({
      'app.js': '',
      'app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'pages/index/index.js': '',
    })

    const { graph, diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: ['src/app.js'],
    })

    expect(diagnostics.some((d) => d.code === 'MISSING_PAGE_JS')).toBe(false)
    expect(graph.nodes.has('pages/index/index.js')).toBe(true)
    expect(graph.nodes.has('pages/index/index.json')).toBe(false)
    expect(graph.nodes.has('pages/index/index.wxml')).toBe(false)
  })
})

describe('pageScriptsFromAppJson', () => {
  it('reads pages and subPackages from adapter.appJson field names', () => {
    const adapter = {
      ...weappAdapter,
      appJson: { pages: 'pageList', subPackages: 'subs' },
    }
    const { scripts, packages } = pageScriptsFromAppJson(
      JSON.stringify({
        pageList: ['pages/index/index'],
        pages: ['ignored/main'],
        subs: [{ root: 'pkgA', pages: ['pages/x'], independent: true }],
        subPackages: [{ root: 'nope', pages: ['y'] }],
      }),
      adapter,
    )
    expect(scripts).toEqual(['pages/index/index', 'pkgA/pages/x'])
    expect(packages).toEqual([{ root: '' }, { root: 'pkgA', independent: true }])
  })
})

describe('companionPath', () => {
  it('returns the first existing same-basename file for the kind', async () => {
    const { srcDir } = await fixture({
      'pages/index/index.js': '',
      'pages/index/index.json': '{}',
      'pages/index/index.wxml': '<view/>',
    })
    const scriptAbs = join(srcDir, 'pages/index/index.js')
    expect(companionPath(scriptAbs, 'json', weappAdapter)).toBe(
      join(srcDir, 'pages/index/index.json'),
    )
    expect(companionPath(scriptAbs, 'template', weappAdapter)).toBe(
      join(srcDir, 'pages/index/index.wxml'),
    )
    expect(companionPath(scriptAbs, 'style', weappAdapter)).toBeUndefined()
  })
})
