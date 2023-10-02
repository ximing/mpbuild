import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_NAMES } from '../index'
import { cliDir, coreDir, repoRoot } from './repo'

describe('root README', () => {
  it('documents @mpbuild/cli, mpb, Node >=20, and migration link', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
    expect(readme).toContain('@mpbuild/cli')
    expect(readme).toContain('`mpb`')
    expect(readme).toMatch(/Node\.js/)
    expect(readme).toContain('>=20')
    expect(readme).toContain('docs/migration-v5.md')
    expect(readme).toContain('ALL-CONTRIBUTORS-BADGE:START')
    expect(readme).toContain('ALL-CONTRIBUTORS-BADGE:END')
    expect(readme).toContain('ALL-CONTRIBUTORS-LIST:START')
    expect(readme).toContain('ALL-CONTRIBUTORS-LIST:END')
    expect(readme).not.toMatch(/maintained%20with-lerna/)
    expect(readme).not.toContain('https://ximing.github.io/mpbuild/')
    expect(readme).not.toContain('https://mpbuild.gitee.io/')
    expect(readme).toContain('mpbuild.config.ts')
    expect(readme).toContain('type": "module"')
    expect(readme).toContain('mpbuild.config.mjs')
    expect(readme).toContain('不要同时留下')
    expect(readme).toContain(
      'mpbuild.config.ts` → `mpbuild.config.mts` → `mpbuild.config.js` → `mpbuild.config.mjs',
    )
    expect(readme).toContain('--no-cache')
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
