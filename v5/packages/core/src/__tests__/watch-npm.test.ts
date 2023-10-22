import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCompiler, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-npm-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

function configOf(rootDir: string): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    entry: { pages: [] },
    output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
    resolve: { alias: {}, extensions: weappAdapter.sourceExts },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    configPath: '',
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('watch in-graph npm files', () => {
  it('updates dest after an in-graph npm module changes', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': "require('leftpad')\n",
      'node_modules/leftpad/package.json': JSON.stringify({ name: 'leftpad', main: 'index.js' }),
      'node_modules/leftpad/index.js': "module.exports = 'v1'\n",
    })
    const compiler = createCompiler(configOf(rootDir))
    const handle = await compiler.watch()
    try {
      const dest = join(rootDir, 'dist/npm/leftpad/index.js')
      expect(existsSync(dest)).toBe(true)
      expect(await readFile(dest, 'utf8')).toContain('v1')
      await writeFile(join(rootDir, 'node_modules/leftpad/index.js'), "module.exports = 'v2-npm-watch'\n")
      await vi.waitFor(
        async () => {
          expect(await readFile(dest, 'utf8')).toContain('v2-npm-watch')
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }
  })
})
