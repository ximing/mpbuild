import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyIfdef, createCompiler, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

const scriptSrc = `Page({
    onShow() {
        // @ifdef wx
        console.log('wx platform');
        // @endif
        // @ifdef mt
        console.log('mt platform');
        // @endif
        // @ifndef mt
        console.log('not mt platform');
        // @endif
    },
});
`

const templateSrc = `<!-- @ifdef wx -->
<view>wx platform</view>
<!-- @endif -->
<!-- @ifdef mt -->
<view>mt platform</view>
<!-- @endif -->
`

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-ifdef-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

function configOf(
  rootDir: string,
  extra: Partial<Pick<ResolvedConfig, 'platform' | 'ifdef'>> = {},
): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    platform: extra.platform ?? 'wx',
    entry: { pages: [] },
    output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
    resolve: { alias: {}, extensions: weappAdapter.sourceExts },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    projects: [],
    ifdef: extra.ifdef ?? { tokens: {}, blockcode: true },
    appEntry: { pages: [] },
    configPath: '',
  }
}

function miniApp(pageJs = scriptSrc, pageWxml = templateSrc): Record<string, string> {
  return {
    'src/app.js': 'App({})\n',
    'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
    'src/pages/index/index.js': pageJs,
    'src/pages/index/index.json': '{}\n',
    'src/pages/index/index.wxml': pageWxml,
    'src/pages/index/index.wxss': '.a{}\n',
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('applyIfdef', () => {
  const ctx = { wx: true, p: 'wx' }

  it('keeps wx platform and drops mt platform in script', () => {
    const out = applyIfdef(scriptSrc, 'script', ctx)
    expect(out).toContain("'wx platform'")
    expect(out).not.toContain("'mt platform'")
    expect(out).toContain("'not mt platform'")
    expect(out).not.toContain('@ifdef')
    expect(out).not.toContain('@endif')
  })

  it('keeps wx platform and drops mt platform in template', () => {
    const out = applyIfdef(templateSrc, 'template', ctx)
    expect(out).toContain('wx platform')
    expect(out).not.toContain('mt platform')
    expect(out).not.toContain('@ifdef')
  })

  it('evaluates @if TOKEN || TOKEN and /* */ directives', () => {
    const js = `// @if wx || mt
keep or
// @endif
/* @ifdef mt */
drop mt
/* @endif */
/* @ifdef wx */
keep wx
/* @endif */
`
    const out = applyIfdef(js, 'style', ctx)
    expect(out).toContain('keep or')
    expect(out).toContain('keep wx')
    expect(out).not.toContain('drop mt')
  })
})

describe('createCompiler ifdef', () => {
  it('emits index.js dest without the mt branch', async () => {
    const rootDir = await fixture(miniApp())
    const { diagnostics, graph } = await createCompiler(configOf(rootDir)).run()
    const dest = await readFile(join(rootDir, 'dist/pages/index/index.js'), 'utf8')
    const wxml = await readFile(join(rootDir, 'dist/pages/index/index.wxml'), 'utf8')

    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(dest).toContain("'wx platform'")
    expect(dest).not.toContain("'mt platform'")
    expect(dest).toContain("'not mt platform'")
    expect(wxml).toContain('wx platform')
    expect(wxml).not.toContain('mt platform')

    const stripped = applyIfdef(scriptSrc, 'script', { wx: true, p: 'wx' })
    expect(graph.nodes.get('pages/index/index.js')?.hash).toBe(
      createHash('sha256').update(stripped).digest('hex'),
    )
  })

  it('does not extract requires inside dropped blocks', async () => {
    const rootDir = await fixture({
      ...miniApp(`// @ifdef mt
require('./mt')
// @endif
// @ifdef wx
require('./wx')
// @endif
`),
      'src/pages/index/mt.js': 'module.exports = "mt"\n',
      'src/pages/index/wx.js': 'module.exports = "wx"\n',
    })
    const { graph } = await createCompiler(configOf(rootDir)).run()
    expect(graph.nodes.has('pages/index/wx.js')).toBe(true)
    expect(graph.nodes.has('pages/index/mt.js')).toBe(false)
  })

  it('is identity when blockcode is false or platform is unset', async () => {
    const rootDir = await fixture(miniApp())
    const off = await createCompiler(
      configOf(rootDir, { ifdef: { tokens: {}, blockcode: false } }),
    ).run()
    expect(await readFile(join(rootDir, 'dist/pages/index/index.js'), 'utf8')).toContain(
      "'mt platform'",
    )
    expect(off.graph.nodes.get('pages/index/index.js')?.hash).toBe(
      createHash('sha256').update(scriptSrc).digest('hex'),
    )

    const noPlatRoot = await fixture(miniApp())
    const { platform: _, ...rest } = configOf(noPlatRoot)
    const noPlat = await createCompiler(rest).run()
    expect(await readFile(join(noPlatRoot, 'dist/pages/index/index.js'), 'utf8')).toContain(
      "'mt platform'",
    )
    expect(noPlat.graph.nodes.get('pages/index/index.js')?.hash).toBe(
      createHash('sha256').update(scriptSrc).digest('hex'),
    )
  })
})
