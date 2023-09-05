import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { defineConfig, loadConfig } from '../index'

const dirs: string[] = []

async function tempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'mpbuild-config-'))
  dirs.push(dir)
  await writeFile(join(dir, 'package.json'), JSON.stringify({ type: 'module' }))
  return dir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('loadConfig', () => {
  it('fills output/target/subPackage defaults from mpbuild.config.js', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './entry.js' }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('dist')
    expect(config.target.id).toBe('weapp')
    expect(config.subPackage.shared).toBe('duplicate')
  })

  it('requires entry in mpbuild.config.js', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'mpbuild.config.js'), "export default { src: 'src' }\n")
    await expect(loadConfig(root)).rejects.toThrow()
  })

  it('loads appEntry from entry.js and keeps function aliases', async () => {
    const root = await tempDir()
    await writeFile(
      join(root, 'entry.js'),
      "export default { router: [{ root: '', pages: { 'pages/index/index': '/pages/index/index' } }] }\n",
    )
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { entry: './entry.js', src: 'src', resolve: { alias: { '@/': ({ importer }) => importer } } }\n",
    )
    const config = await loadConfig(root)
    expect(config.appEntry.router?.[0]?.pages['pages/index/index']).toBe('/pages/index/index')
    const aliasFn = config.resolve.alias['@/']
    expect(typeof aliasFn).toBe('function')
    if (typeof aliasFn === 'function') {
      expect(aliasFn({ importer: '/src/a.js', request: '@/x' })).toBe('/src/a.js')
    }
    expect(config.projects).toEqual([])
    expect(config.ifdef).toEqual({ tokens: {}, blockcode: true })
  })

  it('throws ENTRY_LOAD when the entry file cannot be loaded', async () => {
    const root = await tempDir()
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './missing-entry.js' }\n",
    )
    await expect(loadConfig(root)).rejects.toMatchObject({ code: 'ENTRY_LOAD' })
  })

  it('throws LEGACY_CONFIG when only mpb.config.js exists', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'mpb.config.js'), "export default { src: 'src' }\n")
    await expect(loadConfig(root)).rejects.toThrow(/LEGACY_CONFIG/)
  })
})

describe('defineConfig', () => {
  it('returns the same object', () => {
    const input = { src: 'src' }
    expect(defineConfig(input)).toBe(input)
  })
})
