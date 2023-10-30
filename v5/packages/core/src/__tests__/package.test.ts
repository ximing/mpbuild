import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { version } from '../index'
import { cliDir, coreDir, listPackageJson, readJson, repoRoot } from './repo'

describe('package', () => {
  it('exports a semver version string', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('exposes mpb bin and not mpb5', () => {
    expect(existsSync(join(cliDir, 'bin/mpb.js'))).toBe(true)
    expect(existsSync(join(cliDir, 'bin/mpb5.js'))).toBe(false)
  })
})

describe('package identity', () => {
  it('locks @mpbuild/core and @mpbuild/cli at 5.0.0 with mpb bin', () => {
    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect(corePkg.name).toBe('@mpbuild/core')
    expect(cliPkg.name).toBe('@mpbuild/cli')
    expect(corePkg.version).toBe('5.0.0')
    expect(cliPkg.version).toBe('5.0.0')
    expect(version).toBe('5.0.0')
    expect(corePkg.engines).toEqual({ node: '>=20.0.0' })
    expect(cliPkg.engines).toEqual({ node: '>=20.0.0' })
    expect((cliPkg.bin as Record<string, string>).mpb).toBe('./bin/mpb.js')
    expect((cliPkg.bin as Record<string, string>).mpb5).toBeUndefined()
  })

  it('adds publish metadata without becoming unscoped mpbuild@5', () => {
    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect(corePkg.license).toBe('MIT')
    expect(cliPkg.license).toBe('MIT')
    expect((corePkg.repository as { directory: string }).directory).toBe('v5/packages/core')
    expect((cliPkg.repository as { directory: string }).directory).toBe('v5/packages/cli')
    expect((corePkg.repository as { url: string }).url).toContain('github.com/ximing/mpbuild')
    expect((cliPkg.repository as { url: string }).url).toContain('github.com/ximing/mpbuild')
    expect((corePkg.publishConfig as { access: string }).access).toBe('public')
    expect((cliPkg.publishConfig as { access: string }).access).toBe('public')
  })

  it('keeps the root package private mpbuild-project@4.2.1', () => {
    const rootPkg = readJson(join(repoRoot, 'package.json'))
    expect(rootPkg.name).toBe('mpbuild-project')
    expect(rootPkg.private).toBe(true)
    expect(rootPkg.version).toBe('4.2.1')
  })

  it('has no package.json named mpbuild with version 5.x', () => {
    for (const file of listPackageJson(repoRoot)) {
      const pkg = readJson(file)
      if (pkg.name === 'mpbuild') {
        expect(String(pkg.version)).not.toMatch(/^5\./)
      }
    }
  })
})
