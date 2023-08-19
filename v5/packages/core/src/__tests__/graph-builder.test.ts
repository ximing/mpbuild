import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildGraph, weappAdapter } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-graph-'))
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

describe('buildGraph', () => {
  it('walks a cycle and records external plugin edges', async () => {
    const { rootDir, srcDir } = await fixture({
      'app.js': `require('./pages/index')\n`,
      'pages/index.js': `require('./util')\nimport 'plugin://x/y'\n`,
      'pages/util.js': `require('./index')\n`,
    })
    const appId = 'app.js'
    const indexId = 'pages/index.js'
    const utilId = 'pages/util.js'

    const { graph } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join('src', 'app.js')],
    })

    expect(graph.nodes.size).toBe(3)
    expect(graph.nodes.has(appId)).toBe(true)
    expect(graph.nodes.has(indexId)).toBe(true)
    expect(graph.nodes.has(utilId)).toBe(true)
    expect(graph.nodes.get(appId)?.sourcePath).toBe(join(srcDir, 'app.js'))
    expect([...graph.nodes.keys()].some((id) => id.startsWith('plugin://'))).toBe(false)
    expect(graph.entries).toContain(appId)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: indexId, to: utilId }),
        expect.objectContaining({ from: utilId, to: indexId }),
        expect.objectContaining({ from: indexId, to: 'plugin://x/y', external: true }),
      ]),
    )
  })

  it('emits RESOLVE_MISS for a missing required file', async () => {
    const { rootDir, srcDir } = await fixture({
      'app.js': `require('./nope')\n`,
    })
    const appAbs = join(srcDir, 'app.js')
    const { graph, diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [appAbs],
    })

    expect(graph.nodes.has('app.js')).toBe(true)
    expect(diagnostics.some((d) => d.code === 'RESOLVE_MISS' && d.file === appAbs)).toBe(true)
    expect([...graph.nodes.keys()].some((id) => id.includes('nope'))).toBe(false)
  })
})
