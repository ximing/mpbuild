import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_NAMES } from '../index'
import { cliDir, coreDir, repoRoot } from './repo'

describe('root README', () => {
  it('documents @mpbuild/cli, mpb, Node >= 20, packages layout, and migration link', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
    expect(readme).toContain('@mpbuild/cli')
    expect(readme).toContain('`mpb`')
    expect(readme).toMatch(/Node\.js/)
    expect(readme).toContain('>= 20')
    expect(readme).toContain('docs/migration-v5.md')
    expect(readme).toContain('ALL-CONTRIBUTORS-BADGE:START')
    expect(readme).toContain('ALL-CONTRIBUTORS-BADGE:END')
    expect(readme).toContain('ALL-CONTRIBUTORS-LIST:START')
    expect(readme).toContain('ALL-CONTRIBUTORS-LIST:END')
    expect(readme).not.toMatch(/maintained%20with-lerna/)
    expect(readme).toContain('https://ximing.github.io/mpbuild/')
    expect(readme).not.toContain('https://mpbuild.gitee.io/')
    expect(readme).toContain('mpbuild.config.mjs')
    expect(readme).toContain('projectConfig')
    expect(readme).toContain('[`packages/core`](packages/core)')
    expect(readme).toContain('[`packages/cli`](packages/cli)')
    expect(readme).toContain('5.x 代码位于 `packages/`')
    expect(readme).not.toContain('v5/packages')
    expect(readme).not.toMatch(/npm_[A-Za-z0-9]{10,}/)
    expect(readme).toContain('docs/assets/pipeline.gif')
    expect(readme).toContain('docs/assets/graph.png')
    expect(readme).toContain('docs/assets/build.gif')
    expect(readme).toContain('docs/assets/logo.svg')
    expect(readme).toContain('mpb analyze')
    expect(readme).toContain('mpb inspect graph')
    expect(readme).toContain('#/guide/architecture')
  })

  it('ships npm README files for core and cli', () => {
    const coreReadme = readFileSync(join(coreDir, 'README.md'), 'utf8')
    const cliReadme = readFileSync(join(cliDir, 'README.md'), 'utf8')
    expect(coreReadme).toContain('@mpbuild/core')
    expect(coreReadme).toContain('createCompiler')
    expect(cliReadme).toContain('@mpbuild/cli')
    expect(cliReadme).toContain('`mpb`')
    expect(cliReadme).toContain('Node.js')
    expect(cliReadme).toContain('mpbuild.config.mjs')
  })


  it('locks CONFIG_NAMES order with js before mjs', () => {
    expect(CONFIG_NAMES).toEqual([
      'mpbuild.config.ts',
      'mpbuild.config.mts',
      'mpbuild.config.js',
      'mpbuild.config.mjs',
    ])
    const watcher = readFileSync(join(coreDir, 'src/watch/watcher.ts'), 'utf8')
    const compiler = readFileSync(join(coreDir, 'src/compiler.ts'), 'utf8')
    expect(watcher).toContain('CONFIG_NAMES')
    expect(compiler).toContain('CONFIG_NAMES')
    expect(watcher).toContain('mpbuild.config.mjs')
  })
})
