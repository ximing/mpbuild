import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createCompiler, loadConfig } from '../index'
import type { Diagnostic } from '../index'
import { cliDir, repoRoot } from './repo'

const coverageRoot = join(repoRoot, 'example/coverage')
const dist = join(coverageRoot, 'dist')
const distCheck = join(coverageRoot, 'dist-check')
const distMin = join(coverageRoot, 'dist-min')

type AnalyzeJson = {
  nodes: Array<{ id: string; owner?: string }>
  edges: Array<{ raw?: unknown; to?: string }>
  packages: Array<{ root: string; independent?: boolean; pages?: string[] }>
  placements: Array<{ moduleId: string; package: string }>
}

type AppJson = {
  pages: string[]
  subPackages: Array<{ root: string; independent?: boolean; pages: string[] }>
}

function readDist(rel: string, base = dist): string {
  return readFileSync(join(base, rel), 'utf8')
}

function mpb(args: string[]) {
  return spawnSync(process.execPath, [join(cliDir, 'bin/mpb.js'), ...args], {
    cwd: coverageRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  })
}

afterAll(async () => {
  await rm(distCheck, { recursive: true, force: true })
  await rm(distMin, { recursive: true, force: true })
})

describe('example/coverage', () => {
  it(
    'builds through the real CLI and checks supported outputs',
    { timeout: 180_000 },
    async () => {
      if (!existsSync(join(coverageRoot, 'node_modules/cov-id'))) {
        const installed = spawnSync(
          'npm',
          ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'],
          {
            cwd: coverageRoot,
            encoding: 'utf8',
            env: { ...process.env, NODE_OPTIONS: '' },
          },
        )
        expect(installed.status, `${installed.stdout}\n${installed.stderr}`).toBe(0)
      }

      const built = spawnSync('pnpm', ['build'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, NODE_OPTIONS: '' },
      })
      expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)

      const spawned = mpb(['build'])
      expect(spawned.status, `${spawned.stdout}\n${spawned.stderr}`).toBe(0)

      const analyzed = mpb(['analyze'])
      expect(analyzed.status, `${analyzed.stdout}\n${analyzed.stderr}`).toBe(0)
      expect(existsSync(join(dist, 'mpbuild-analyze.json'))).toBe(true)

      expect(existsSync(join(coverageRoot, 'src/app.js'))).toBe(true)
      expect(existsSync(join(coverageRoot, 'src/app.json'))).toBe(false)
      expect(existsSync(join(dist, 'app.js'))).toBe(true)
      expect(existsSync(join(dist, 'pages/home/index.wx.js'))).toBe(false)
      expect(existsSync(join(dist, 'pages/home/index.wx.json'))).toBe(false)
      expect(existsSync(join(dist, 'utils/a.js'))).toBe(false)
      expect(existsSync(join(dist, 'utils/shared.js'))).toBe(false)

      const homeJs = readDist('pages/home/index.js')
      expect(homeJs).toContain('wx-on')
      expect(homeJs).not.toContain('mt-on')
      expect(homeJs).not.toContain('plain-home')
      expect(homeJs).toContain('dyn')
      expect(readDist('pages/home/dyn.js')).toContain('dyn-marker')
      expect(readDist('pages/home/coverage-mark.js')).toContain('7')
      expect(readDist('pages/home/coverage-mark.js')).not.toContain(': number')
      expect(readDist('utils/alias-mod.js')).toContain('alias-mod-marker')
      expect(readDist('utils/a.wx.js')).toContain('platform-wx-a')
      expect(readDist('utils/a.wx.js')).not.toContain('platform-plain-a')
      expect(readDist('npm/cov-id/index.js')).toContain('cov-id-marker')
      expect(readDist('npm/cov-id/index.js')).toContain('covId')

      const homeJson = JSON.parse(readDist('pages/home/index.json')) as {
        usingComponents: { badge: string }
        componentGenerics: { item: { default: string }; slot: boolean }
      }
      expect(homeJson.usingComponents.badge).toContain('badge')
      expect(homeJson.componentGenerics.item.default).toContain('generic-item')
      expect(homeJson.componentGenerics.slot).toBe(true)

      const homeWxml = readDist('pages/home/index.wxml')
      expect(homeWxml).toContain('wx-tpl')
      expect(homeWxml).not.toContain('mt-tpl')
      expect(readDist('pages/home/tpl.wxml')).toContain('tpl-marker')
      expect(readDist('pages/home/part.wxml')).toContain('part-marker')
      expect(readDist('pages/home/home.wxs')).toContain('wxs-marker')

      const homeWxss = readDist('pages/home/index.wxss')
      expect(homeWxss).toMatch(/margin/)
      expect(homeWxss).not.toContain('@include')

      for (const name of ['badge', 'generic-item']) {
        expect(existsSync(join(dist, 'components', name, 'index.js'))).toBe(true)
        expect(existsSync(join(dist, 'components', name, 'index.wxml'))).toBe(true)
        expect(existsSync(join(dist, 'components', name, 'index.wxss'))).toBe(true)
        expect(JSON.parse(readDist(`components/${name}/index.json`)).component).toBe(true)
      }

      expect(readDist('pkg-a/utils/shared.js')).toContain('shared-dup-marker')
      expect(readDist('pkg-b/utils/shared.js')).toContain('shared-dup-marker')
      expect(existsSync(join(dist, 'pkg-ind/index.js'))).toBe(true)
      expect(readDist('pkg-ind/local.js')).toContain('ind-local-marker')
      expect(readDist('pages/extra/index.js')).toContain('@extra')
      expect(readDist('@extra/pages/x/helper.js')).toContain('extra-helper-marker')

      expect(Buffer.compare(
        readFileSync(join(coverageRoot, 'src/assets/icon.png')),
        readFileSync(join(dist, 'assets/icon.png')),
      )).toBe(0)

      const projectConfigText = readDist('project.config.json')
      expect(projectConfigText).toContain('coverage')
      expect(projectConfigText).toContain('touristappid')

      const appJson = JSON.parse(readDist('app.json')) as AppJson
      expect(appJson.pages).toContain('pages/home/index')
      expect(appJson.pages).toContain('pages/extra/index')
      const byRoot = new Map(appJson.subPackages.map((pkg) => [pkg.root, pkg]))
      expect(byRoot.get('pkg-a')?.pages).toContain('index')
      expect(byRoot.get('pkg-b')?.pages).toContain('index')
      expect(byRoot.get('pkg-ind')?.independent).toBe(true)
      expect(byRoot.get('pkg-ind')?.pages).toContain('index')

      const analyzeJson = JSON.parse(readDist('mpbuild-analyze.json')) as AnalyzeJson
      expect(analyzeJson.edges.some((edge) => edge.raw === true || edge.raw === 'true')).toBe(false)
      expect(analyzeJson.nodes.some((node) => node.id.startsWith('@extra/') && node.id.endsWith('.js'))).toBe(
        true,
      )
      const shared = analyzeJson.nodes.find((node) => node.id === 'utils/shared.js')
      expect(shared?.owner).toBe('shared')
      expect(
        analyzeJson.placements
          .filter((placement) => placement.moduleId === 'utils/shared.js')
          .map((placement) => placement.package)
          .sort(),
      ).toEqual(['pkg-a', 'pkg-b'])

      const cfg = await loadConfig(coverageRoot)
      cfg.output = { ...cfg.output, dir: 'dist-check' }
      const checked = await createCompiler(cfg).run()
      expect(
        checked.diagnostics.filter((d: Diagnostic) => d.severity === 'error'),
        JSON.stringify(checked.diagnostics, null, 2),
      ).toEqual([])

      const minCfg = await loadConfig(coverageRoot)
      minCfg.output = { ...minCfg.output, dir: 'dist-min' }
      minCfg.compile = { ...minCfg.compile, minify: true }
      const minified = await createCompiler(minCfg).run()
      expect(minified.diagnostics.filter((d: Diagnostic) => d.severity === 'error')).toEqual([])
      const minJs = readDist('pages/home/index.js', distMin)
      expect(minJs.length).toBeLessThan(homeJs.length)
      expect(minJs).toContain('wx-on')
      expect(minJs).not.toContain('mt-on')
    },
  )
})
