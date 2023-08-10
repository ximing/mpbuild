import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveId, weappAdapter } from '../index'

const dirs: string[] = []

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'mpbuild-resolve-'))
  dirs.push(root)
  const srcDir = join(root, 'src')
  await mkdir(join(srcDir, 'n'), { recursive: true })
  await writeFile(join(srcDir, 'a.js'), 'export default 1\n')
  await writeFile(join(srcDir, 'b.js'), 'export default 2\n')
  await writeFile(join(srcDir, 'n/index.js'), 'export default 3\n')
  return {
    srcDir,
    base: {
      importer: join(srcDir, 'a.js'),
      kind: 'script' as const,
      adapter: weappAdapter,
      srcDir,
    },
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('resolveId', () => {
  it('resolves a relative specifier via sourceExts', async () => {
    const { srcDir, base } = await fixture()
    expect(resolveId({ ...base, request: './b' })).toEqual({
      id: join(srcDir, 'b.js'),
    })
  })

  it('marks plugin:// as external', async () => {
    const { base } = await fixture()
    expect(resolveId({ ...base, request: 'plugin://foo/x' })).toEqual({
      id: 'plugin://foo/x',
      external: true,
    })
  })

  it('returns virtual when the id is in virtualIds', async () => {
    const { base } = await fixture()
    expect(
      resolveId({
        ...base,
        request: 'virtual:helper',
        virtualIds: new Set(['virtual:helper']),
      }),
    ).toEqual({
      id: 'virtual:helper',
      virtual: true,
    })
  })

  it('throws RESOLVE_MISS for a missing file', async () => {
    const { base } = await fixture()
    expect(() => resolveId({ ...base, request: './missing' })).toThrow(/RESOLVE_MISS/)
  })

  it('resolves / relative to srcDir', async () => {
    const { srcDir, base } = await fixture()
    expect(resolveId({ ...base, request: '/b' })).toEqual({
      id: join(srcDir, 'b.js'),
    })
  })

  it('resolves a directory to its index file', async () => {
    const { srcDir, base } = await fixture()
    expect(resolveId({ ...base, request: './n' })).toEqual({
      id: join(srcDir, 'n', 'index.js'),
    })
  })

  it('applies the longest string alias prefix', async () => {
    const { srcDir, base } = await fixture()
    expect(
      resolveId({
        ...base,
        request: '@/n',
        alias: {
          '@': srcDir,
          '@/n': join(srcDir, 'n'),
        },
      }),
    ).toEqual({
      id: join(srcDir, 'n', 'index.js'),
    })
  })
})
