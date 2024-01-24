import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliDir, readJson, repoRoot } from './repo'

describe('cli production bin', () => {
  it('does not depend on tsx in bin or production dependencies', () => {
    const binText = readFileSync(join(cliDir, 'bin/mpb.js'), 'utf8')
    expect(binText).not.toMatch(/\btsx\b/)
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect((cliPkg.dependencies as Record<string, string> | undefined)?.tsx).toBeUndefined()
    expect((cliPkg.bin as Record<string, string>).mpb).toBe('./bin/mpb.js')
    expect((cliPkg.scripts as Record<string, string>).dev).toBe('tsx src/index.ts')
  })

  it('prints usage with plain node after build', { timeout: 60_000 }, () => {
    const built = spawnSync('pnpm', ['build'], { cwd: repoRoot, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
    const bin = join(cliDir, 'bin/mpb.js')
    const result = spawnSync(process.execPath, [bin], {
      cwd: cliDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('usage: mpb <inspect graph|build|dev|analyze>')
    expect(result.stderr).not.toMatch(/\btsx\b/)
  })
})
