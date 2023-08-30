import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyGraphChange, buildGraph, EdgeKinds, weappAdapter } from '../index'
import type { ModuleGraph } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-patch-'))
  dirs.push(rootDir)
  const srcDir = join(rootDir, 'src')
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(srcDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return { rootDir, srcDir }
}

function cloneGraph(graph: ModuleGraph): ModuleGraph {
  return {
    entries: [...graph.entries],
    nodes: structuredClone(graph.nodes),
    edges: structuredClone(graph.edges),
    packages: structuredClone(graph.packages),
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('applyGraphChange', () => {
  async function miniApp() {
    const { rootDir, srcDir } = await fixture({
      'app.js': '',
      'app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'pages/index/index.js': `require('./lib')\n`,
      'pages/index/lib.js': `module.exports = 1\n`,
    })
    const { graph } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join('src', 'app.js')],
    })
    return { rootDir, srcDir, graph }
  }

  it('keeps topology when only a dep hash changes', async () => {
    const { rootDir, srcDir, graph } = await miniApp()
    const before = cloneGraph(graph)
    const oldHash = before.nodes.get('pages/index/lib.js')?.hash
    await writeFile(join(srcDir, 'pages/index/lib.js'), `module.exports = 2\n`)

    const result = await applyGraphChange({
      graph,
      srcDir,
      rootDir,
      adapter: weappAdapter,
      changedIds: ['pages/index/lib.js'],
      deletedIds: [],
      addedRelPaths: [],
    })

    expect(result.topologyChanged).toBe(false)
    expect(result.graph.nodes.get('pages/index/lib.js')?.hash).not.toBe(oldHash)
    expect(result.graph.nodes.has('pages/index/lib.js')).toBe(true)
    expect(result.graph.nodes.size).toBe(before.nodes.size)
  })

  it('drops unreachable lib when index no longer requires it', async () => {
    const { rootDir, srcDir, graph } = await miniApp()
    await writeFile(join(srcDir, 'pages/index/index.js'), '')

    const result = await applyGraphChange({
      graph,
      srcDir,
      rootDir,
      adapter: weappAdapter,
      changedIds: ['pages/index/index.js'],
      deletedIds: [],
      addedRelPaths: [],
    })

    expect(result.topologyChanged).toBe(true)
    expect(result.graph.nodes.has('pages/index/lib.js')).toBe(false)
    expect(
      result.graph.edges.some(
        (edge) => edge.from === 'pages/index/index.js' && edge.to === 'pages/index/lib.js',
      ),
    ).toBe(false)
  })

  it('attaches a new page suite template from addedRelPaths', async () => {
    const { rootDir, srcDir, graph } = await miniApp()
    await writeFile(join(srcDir, 'pages/index/index.wxml'), '<view/>\n')

    const result = await applyGraphChange({
      graph,
      srcDir,
      rootDir,
      adapter: weappAdapter,
      changedIds: [],
      deletedIds: [],
      addedRelPaths: ['pages/index/index.wxml'],
    })

    expect(result.topologyChanged).toBe(true)
    expect(result.graph.nodes.has('pages/index/index.wxml')).toBe(true)
    expect(result.graph.nodes.get('pages/index/index.wxml')?.kind).toBe('template')
    expect(result.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'pages/index/index.js',
          to: 'pages/index/index.wxml',
          kind: EdgeKinds.pageSuite,
        }),
      ]),
    )
  })
})
