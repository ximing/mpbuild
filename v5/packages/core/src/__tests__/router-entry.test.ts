import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  appJsonFromEntry,
  createCompiler,
  pageScriptsFromRouter,
  weappAdapter,
} from '../index'
import type { AppEntry, ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-router-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

function routerEntry(): AppEntry {
  return {
    router: [
      {
        root: '',
        pages: {
          'pages/index/index': '/pages/index/index',
        },
      },
      {
        root: 'subpkg1',
        pages: {
          'one/index': '/pages/sub/one/index',
        },
        independent: true,
      },
    ],
    networkTimeout: { request: 30000 },
    debug: false,
  }
}

function configOf(rootDir: string, entry: AppEntry): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    entry,
    output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
    resolve: { alias: {}, extensions: weappAdapter.sourceExts },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    projects: [],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: entry,
    configPath: '',
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('pageScriptsFromRouter', () => {
  it('uses logical keys as scripts and router values as sources', () => {
    const { scripts, sources, packages } = pageScriptsFromRouter(routerEntry())
    expect(scripts).toEqual(['pages/index/index', 'subpkg1/one/index'])
    expect(sources).toEqual(['/pages/index/index', '/pages/sub/one/index'])
    expect(packages).toEqual([{ root: '' }, { root: 'subpkg1', independent: true }])
  })
})

describe('appJsonFromEntry', () => {
  it('emits pages/subPackages from router groups and keeps extra keys', () => {
    const json = appJsonFromEntry(routerEntry(), weappAdapter)
    expect(json.pages).toEqual(['pages/index/index'])
    expect(json.subPackages).toEqual([
      { root: 'subpkg1', independent: true, pages: ['one/index'] },
    ])
    expect(json.networkTimeout).toEqual({ request: 30000 })
    expect(json.debug).toBe(false)
    expect(json).not.toHaveProperty('router')
  })
})

describe('createCompiler router entry', () => {
  it('emits generated dist/app.json and page scripts without src/app.json', async () => {
    const entry: AppEntry = {
      router: [
        {
          root: '',
          pages: { 'pages/index/index': '/pages/index/index' },
        },
      ],
      networkTimeout: { request: 30000 },
    }
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/pages/index/index.js': 'Page({})\n',
      'src/pages/index/index.json': '{}\n',
      'src/pages/index/index.wxml': '<view/>',
      'src/pages/index/index.wxss': '.a{color:red}',
    })

    const { diagnostics } = await createCompiler(configOf(rootDir, entry)).run()

    const dist = join(rootDir, 'dist')
    expect(existsSync(join(dist, 'app.json'))).toBe(true)
    const appJson = JSON.parse(await readFile(join(dist, 'app.json'), 'utf8')) as {
      pages?: string[]
      networkTimeout?: { request?: number }
    }
    expect(appJson.pages).toContain('pages/index/index')
    expect(appJson.networkTimeout).toEqual({ request: 30000 })
    expect(existsSync(join(dist, 'pages/index/index.js'))).toBe(true)
    expect(diagnostics.some((d) => d.severity === 'error')).toBe(false)
  })
})
