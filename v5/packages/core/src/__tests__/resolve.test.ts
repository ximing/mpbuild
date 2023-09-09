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
  await mkdir(join(srcDir, 'utils'), { recursive: true })
  await writeFile(join(srcDir, 'a.js'), 'export default 1\n')
  await writeFile(join(srcDir, 'b.js'), 'export default 2\n')
  await writeFile(join(srcDir, 'n/index.js'), 'export default 3\n')
  await writeFile(join(srcDir, 'utils/util.js'), 'export default 4\n')
  return {
    root,
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

  it('rewrites @utils to src/utils', async () => {
    const { srcDir, base } = await fixture()
    expect(
      resolveId({
        ...base,
        request: '@utils/util',
        alias: { '@utils': join(srcDir, 'utils') },
      }),
    ).toEqual({
      id: join(srcDir, 'utils', 'util.js'),
    })
  })

  it('applies function alias @/ from a subproject importer', async () => {
    const { root, base } = await fixture()
    const projectSrc = join(root, 'projects', 'one')
    await mkdir(join(projectSrc, 'pages'), { recursive: true })
    await mkdir(join(projectSrc, 'utils'), { recursive: true })
    const importer = join(projectSrc, 'pages', 'x.js')
    await writeFile(importer, 'require(\'@/utils/b\')\n')
    await writeFile(join(projectSrc, 'utils', 'b.js'), 'export default 1\n')

    expect(
      resolveId({
        ...base,
        importer,
        request: '@/utils/b',
        alias: {
          '@/': ({ importer: from }) => (from.startsWith(projectSrc) ? projectSrc : undefined),
        },
      }),
    ).toEqual({
      id: join(projectSrc, 'utils', 'b.js'),
    })
  })

  it('skips a function alias that returns empty and tries the next key', async () => {
    const { srcDir, base } = await fixture()
    expect(
      resolveId({
        ...base,
        request: '@/n',
        alias: {
          '@/': () => undefined,
          '@': srcDir,
        },
      }),
    ).toEqual({
      id: join(srcDir, 'n', 'index.js'),
    })
  })

  it('uses project.alias before global alias when the importer is under project.src', async () => {
    const { root, srcDir, base } = await fixture()
    const projectSrc = join(root, 'projects', 'one')
    await mkdir(join(projectSrc, 'utils'), { recursive: true })
    await writeFile(join(projectSrc, 'utils', 'b.js'), 'export default 1\n')
    const importer = join(projectSrc, 'pages', 'x.js')
    await mkdir(join(projectSrc, 'pages'), { recursive: true })
    await writeFile(importer, '')

    expect(
      resolveId({
        ...base,
        importer,
        request: '@utils/b',
        alias: { '@utils': join(srcDir, 'utils') },
        projects: [{ name: '@one', src: projectSrc, alias: { '@utils': join(projectSrc, 'utils') } }],
      }),
    ).toEqual({
      id: join(projectSrc, 'utils', 'b.js'),
    })
  })
})
