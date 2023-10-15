import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliDir, coreDir, readJson, repoRoot, v5Dir } from './repo'

describe('publish workflow', () => {
  it('publishes from v* tags with NPM_TOKEN and never local npm publish in v5', () => {
    const workflowPath = join(repoRoot, '.github/workflows/publish-mpbuild.yml')
    expect(existsSync(workflowPath)).toBe(true)
    const yml = readFileSync(workflowPath, 'utf8')
    expect(yml).toContain('secrets.NPM_TOKEN')
    expect(yml).toContain('pnpm publish')
    expect(yml).toContain('v*')
    expect(yml).toContain('v5')
    expect(yml).toContain('@mpbuild/core')
    expect(yml).toContain('@mpbuild/cli')
    expect(yml).toContain('actions/checkout@v4')
    expect(yml).toContain('pnpm/action-setup@v4')
    expect(yml).toContain('actions/setup-node@v4')
    expect(yml).toContain("node-version: '22'")
    expect(yml).toContain('registry.npmjs.org')
    expect(yml).toContain('pnpm install --frozen-lockfile')
    expect(yml).toContain('pnpm build')
    expect(yml).toContain('--no-git-checks')
    expect(yml).toContain('--access public')
    expect(yml).toContain('contents: read')
    expect(yml).toContain('ubuntu-latest')
    expect(yml).toContain('workflow_dispatch')
    expect(yml).not.toMatch(/id-token/)
    expect(yml).not.toMatch(/provenance/)
    expect(yml).not.toMatch(/\bnpm publish\b/)
    expect(yml).toContain('pnpm --filter @mpbuild/core test -- --run')
    expect(yml).toContain('timeout-minutes')

    const pages = readFileSync(join(repoRoot, '.github/workflows/github-pages.yml'), 'utf8')
    expect(pages).toMatch(/if:\s*false/)
    expect(pages).toContain('disabled: website package removed')

    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    const v5Pkg = readJson(join(v5Dir, 'package.json'))
    const rootPkg = readJson(join(repoRoot, 'package.json'))
    expect((corePkg.publishConfig as Record<string, string>).registry).toBe(
      'https://registry.npmjs.org',
    )
    expect((cliPkg.publishConfig as Record<string, string>).registry).toBe(
      'https://registry.npmjs.org',
    )
    expect((corePkg.scripts as Record<string, string>).prepublishOnly).toBe('pnpm build')
    expect((cliPkg.scripts as Record<string, string>).prepublishOnly).toBe('pnpm build')
    expect((corePkg.scripts as Record<string, string>)['pack:check']).toContain('pack --dry-run')
    expect((cliPkg.scripts as Record<string, string>)['pack:check']).toContain('pack --dry-run')
    for (const [name, script] of Object.entries((v5Pkg.scripts ?? {}) as Record<string, string>)) {
      expect(name, script).not.toMatch(/^publish$/)
      expect(script).not.toMatch(/\bnpm publish\b/)
      expect(script).not.toMatch(/\bchangeset publish\b/)
      expect(script).not.toMatch(/\bpnpm publish\b/)
    }
    for (const pkg of [corePkg, cliPkg]) {
      for (const [name, script] of Object.entries((pkg.scripts ?? {}) as Record<string, string>)) {
        if (name === 'prepublishOnly') {
          expect(script).toBe('pnpm build')
          continue
        }
        expect(script).not.toMatch(/\bnpm publish\b/)
        expect(script).not.toMatch(/\bpnpm publish\b/)
      }
    }
    expect((rootPkg.scripts as Record<string, string>).release).toBe('changeset publish')
  })
})
