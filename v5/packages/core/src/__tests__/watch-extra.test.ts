import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyGraphChange,
  graphIdFromAbs,
  startWatch,
  watchPaths,
  weappAdapter,
} from '../index'
import type { Module, ModuleGraph } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-extra-watch-'))
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

describe('graphIdFromAbs extraWatchFiles', () => {
  it('maps a mixin extraWatchFile back to the owning style node', async () => {
    const rootDir = await fixture({
      'src/pages/index/index.wxss': '.a{}\n',
      'src/wxss/mixin.wxss': '.m{}\n',
    })
    const srcDir = join(rootDir, 'src')
    const styleAbs = join(srcDir, 'pages/index/index.wxss')
    const mixinAbs = join(srcDir, 'wxss/mixin.wxss')
    const graph: ModuleGraph = {
      entries: [],
      nodes: new Map([
        [
          'pages/index/index.wxss',
          {
            id: 'pages/index/index.wxss',
            kind: 'style',
            sourcePath: styleAbs,
            owner: 'main',
            hash: '',
            extraWatchFiles: [mixinAbs],
            meta: {},
          } satisfies Module,
        ],
      ]),
      edges: [],
      packages: [],
    }
    expect(graphIdFromAbs(graph, mixinAbs, srcDir, [])).toBe('pages/index/index.wxss')
    expect(weappAdapter.id).toBe('weapp')
  })
})

describe('startWatch extraWatchFiles events', () => {
  it('unlinking a mixin extra does not delete the owner node', async () => {
    const rootDir = await fixture({
      'src/pages/index/index.wxss': '.a{}\n',
      'src/wxss/mixin.wxss': '.m{}\n',
    })
    const srcDir = join(rootDir, 'src')
    const styleAbs = join(srcDir, 'pages/index/index.wxss')
    const mixinAbs = join(srcDir, 'wxss/mixin.wxss')
    const ownerId = 'pages/index/index.wxss'
    const graph: ModuleGraph = {
      entries: [ownerId],
      nodes: new Map([
        [
          ownerId,
          {
            id: ownerId,
            kind: 'style',
            sourcePath: styleAbs,
            owner: 'main',
            hash: '',
            extraWatchFiles: [mixinAbs],
            meta: {},
          } satisfies Module,
        ],
      ]),
      edges: [],
      packages: [],
    }
    const batches: Array<{
      changedIds: string[]
      deletedIds: string[]
      addedRelPaths: string[]
    }> = []
    const handle = await startWatch({
      paths: watchPaths(graph, srcDir),
      srcDir,
      graph,
      onTick: async (batch) => {
        batches.push({
          changedIds: [...batch.changedIds],
          deletedIds: [...batch.deletedIds],
          addedRelPaths: [...batch.addedRelPaths],
        })
      },
      onConfigChange: async () => {},
    })
    try {
      await rm(mixinAbs)
      await vi.waitFor(
        () => {
          expect(batches.length).toBeGreaterThan(0)
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }
    const batch = batches[0]!
    expect(batch.changedIds).toContain(ownerId)
    expect(batch.deletedIds).not.toContain(ownerId)
    expect(batch.addedRelPaths).not.toContain(ownerId)

    const result = await applyGraphChange({
      graph,
      srcDir,
      rootDir,
      adapter: weappAdapter,
      changedIds: batch.changedIds,
      deletedIds: batch.deletedIds,
      addedRelPaths: batch.addedRelPaths,
    })
    expect(result.graph.nodes.has(ownerId)).toBe(true)
  })
})

