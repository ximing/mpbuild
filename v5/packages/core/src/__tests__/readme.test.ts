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
    expect(readme).toContain('NPM_TOKEN')
    expect(readme).toContain('Secrets and variables')
    expect(readme).toContain('publish-mpbuild.yml')
    expect(readme).not.toMatch(/npm_[A-Za-z0-9]{10,}/)
    expect(readme).toContain('--minify')
    expect(readme).toContain('copy(')
    expect(readme).toContain('legacyScss')
    expect(readme).toContain('projectConfig')
    expect(readme).toContain('CONFIG_TS_SKIPPED')
    expect(readme).toContain('v5.0.0')
    expect(readme).toContain('force-with-lease')
    expect(readme).toContain('Snyk')
    expect(readme).toContain('load')
    expect(readme).toContain('generate')
    expect(readme).toContain('打印后保持进程')
    expect(readme).toContain('unlink')
    expect(readme).toContain('src/**/*.png')
    expect(readme).toContain('零层')
    expect(readme).toContain('已入图')
    expect(readme).toContain('node_modules')
    expect(readme).toContain("url('./x.png')")
    expect(readme).toContain('sourceMappingURL')
    expect(readme).toContain('componentRelative')
    expect(readme).toContain('ABS_PATH_IN_SUBPROJECT')
    expect(readme).toContain('resolve.extensions')
    expect(readme).toContain('22.18')
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
