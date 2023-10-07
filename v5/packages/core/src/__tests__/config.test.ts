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

  it('loads mpbuild.config.mjs when no ts/mts/js exists', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.mjs'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'out-mjs' } }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('out-mjs')
    expect(config.configPath.replace(/\\/g, '/')).toMatch(/mpbuild\.config\.mjs$/)
  })

  it('prefers mpbuild.config.js over mpbuild.config.mjs', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-js' } }\n",
    )
    await writeFile(
      join(root, 'mpbuild.config.mjs'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-mjs' } }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('from-js')
  })

  it('skips unloadable leftover .ts and loads js with CONFIG_TS_SKIPPED warning', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.ts'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-ts' } }\n",
    )
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-js' } }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('from-js')
    expect(config.configPath.replace(/\\/g, '/')).toMatch(/mpbuild\.config\.js$/)
    expect(config.loadWarnings?.some((d) => d.code === 'CONFIG_TS_SKIPPED')).toBe(true)
    expect(config.loadWarnings?.some((d) => /mpbuild\.config\.ts/.test(d.message))).toBe(true)
    expect(config.loadWarnings?.every((d) => d.severity === 'warning')).toBe(true)
  })

  it('fails when only an unloadable .ts config exists', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.ts'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-ts' } }\n",
    )
    await expect(loadConfig(root)).rejects.toMatchObject({ code: 'CONFIG_TS_SKIPPED' })
  })
})

describe('defineConfig', () => {
  it('returns the same object', () => {
    const input = { src: 'src' }
    expect(defineConfig(input)).toBe(input)
  })
})
