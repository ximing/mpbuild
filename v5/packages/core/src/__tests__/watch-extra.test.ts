import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { graphIdFromAbs, weappAdapter } from '../index'
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
