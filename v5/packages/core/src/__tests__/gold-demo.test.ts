import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createCompiler,
  legacyScss,
  projectConfig,
  weappAdapter,
} from '../index'
import type { Diagnostic, ResolvedConfig } from '../index'

type CompareGoldResult = {
  missingPrefixes: string[]
  npmQuerystring: boolean
  npmUtil: boolean
  destPages: unknown
  goldPages: unknown
  destSubPackages: unknown
  goldSubPackages: unknown
}

const demoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../../../../../example/demo')
const oneSrc = join(demoRoot, '../projects/one')
const twoSrc = join(demoRoot, '../projects/two')
const destDir = join(demoRoot, 'dist-v5')
const goldDir = join(demoRoot, 'dist')

function demoConfig(): ResolvedConfig {
  return {
    rootDir: demoRoot,
    src: join(demoRoot, 'src'),
    target: weappAdapter,
    platform: 'wx',
    entry: './entry.js',
    output: { dir: 'dist-v5', npm: 'npm', clean: true, componentRelative: true },
    resolve: {
      alias: {
        '@one': oneSrc,
        '@two': twoSrc,
        '@utils': join(demoRoot, 'src/utils'),
        '@root': join(demoRoot, 'src'),
        '@components': join(demoRoot, 'src/components'),
        '@/': ({ importer }: { importer: string }) => {
          if (importer.startsWith(oneSrc)) {
            return oneSrc
          }
          if (importer.startsWith(twoSrc)) {
            return twoSrc
          }
          return undefined
        },
      },
      extensions: weappAdapter.sourceExts,
    },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    projects: [
      {
        name: '@one',
        src: oneSrc,
        alias: {
          '@one': oneSrc,
          '@two-b': join(twoSrc, 'utils/b.js'),
        },
      },
      {
        name: '@two',
        src: twoSrc,
        alias: { '@two': twoSrc },
      },
    ],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: {},
    configPath: '',
    plugins: [
      legacyScss(),
      projectConfig({ projectname: 'test', appId: 'test', setting: { minified: true } }),
    ],
  }
}

afterEach(async () => {
  await rm(destDir, { recursive: true, force: true })
})

describe('example/demo gold', () => {
  it('emits gold prefixes, npm/querystring, npm/util, and matching pages/subPackages', async () => {
    expect(existsSync(goldDir)).toBe(true)
    expect(existsSync(join(demoRoot, 'entry.js'))).toBe(true)

    const { diagnostics } = await createCompiler(demoConfig()).run()
    expect(diagnostics.filter((d: Diagnostic) => d.code === 'RESOLVE_MISS')).toEqual([])
    expect(diagnostics.filter((d: Diagnostic) => d.severity === 'error')).toEqual([])

    const { compareGold } = (await import('../../../../../example/demo/scripts/compare-gold.mjs')) as {
      compareGold: (gold: string, dest: string) => Promise<CompareGoldResult>
    }
    const result = await compareGold(goldDir, destDir)
    expect(result.missingPrefixes).toEqual([])
    expect(result.npmQuerystring).toBe(true)
    expect(result.npmUtil).toBe(true)
    expect(result.destPages).toEqual(result.goldPages)
    expect(result.destSubPackages).toEqual(result.goldSubPackages)
    expect(existsSync(join(destDir, 'project.config.json'))).toBe(true)
  }, 30_000)
})

describe('legacyScss load', () => {
  it('inlines mixin @import and flattens nested wxss', async () => {
    const plugin = legacyScss()
    const wxss = join(demoRoot, 'src/pages/index/index.wxss')
    const { readFileSync } = await import('node:fs')
    const watches: string[] = []
    const loaded = await plugin.load?.(wxss, {
      adapter: weappAdapter,
      kind: 'style',
      sourcePath: wxss,
      code: readFileSync(wxss, 'utf8'),
      addWatchFile: (file: string) => watches.push(file),
      error: () => {},
      warn: () => {},
    })
    expect(typeof loaded).toBe('string')
    expect(loaded).not.toContain('@include')
    expect(loaded).not.toContain('@mixin')
    expect(loaded).toMatch(/margin/)
    expect(watches.some((file) => file.includes('mixin'))).toBe(true)
  })
})

describe('projectConfig generate', () => {
  it('writes a template JSON when dest is missing and skips overwrite', async () => {
    const { mkdtemp, readFile, writeFile } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const dir = await mkdtemp(join(tmpdir(), 'mpbuild-project-config-'))
    const destPath = join(dir, weappAdapter.projectConfigFile)
    const plugin = projectConfig({
      projectname: 'test',
      appId: 'wx-test',
      setting: { minified: true },
    })
    const generated = await plugin.generate?.(
      { destPath, content: '' },
      { adapter: weappAdapter, outputDir: dir },
    )
    expect(generated?.content).toBeTruthy()
    await writeFile(destPath, String(generated?.content))
    const first = await readFile(destPath, 'utf8')
    expect(JSON.parse(first).appid).toBe('wx-test')
    expect(JSON.parse(first).projectname).toBe('test')
    expect(JSON.parse(first).setting.minified).toBe(true)

    const again = await plugin.generate?.(
      { destPath, content: '' },
      { adapter: weappAdapter, outputDir: dir },
    )
    expect(again).toBeUndefined()
    await rm(dir, { recursive: true, force: true })
  })
})
