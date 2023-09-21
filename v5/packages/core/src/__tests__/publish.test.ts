import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliDir, coreDir, readJson, v5Dir } from './repo'

function packPaths(cwd: string): string[] {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd,
    encoding: 'utf8',
  })
  expect(result.status, result.stderr || result.stdout).toBe(0)
  const src = result.stdout.trim()
  const start = Math.min(
    ...[src.indexOf('['), src.indexOf('{')].filter((i) => i >= 0),
  )
  const parsed = JSON.parse(src.slice(start)) as
    | { files: Array<{ path: string }> }
    | Array<{ files: Array<{ path: string }> }>
  const files = Array.isArray(parsed) ? parsed[0]!.files : parsed.files
  return files.map((f) => f.path.replace(/\\/g, '/'))
}

describe('publish build', () => {
  it('points package.json at dist and excludes tests from tsc', () => {
    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect(corePkg.main).toBe('./dist/index.js')
    expect(corePkg.types).toBe('./dist/index.d.ts')
    expect(corePkg.exports).toEqual({
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
    })
    expect(corePkg.files).toEqual(['dist'])
    expect((corePkg.scripts as Record<string, string>).build).toBe(
      'tsc -p tsconfig.build.json',
    )
    expect(cliPkg.main).toBe('./dist/index.js')
    expect(cliPkg.types).toBe('./dist/index.d.ts')
    expect(cliPkg.exports).toEqual({
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
    })
    expect(cliPkg.files).toEqual(['dist', 'bin'])
    const buildTsconfig = readJson(join(coreDir, 'tsconfig.build.json'))
    const exclude = buildTsconfig.exclude as string[]
    expect(exclude.some((x) => x.includes('__tests__'))).toBe(true)
    expect(exclude.some((x) => x.includes('__fixtures__'))).toBe(true)
    const v5Pkg = readJson(join(v5Dir, 'package.json'))
    expect((v5Pkg.scripts as Record<string, string>).build).toContain(
      '@mpbuild/core',
    )
    expect((v5Pkg.scripts as Record<string, string>)['pack:check']).toContain(
      'pack:check',
    )
  })

  it('tsc emits dist/index.js + d.ts without __tests__', { timeout: 60_000 }, () => {
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
    expect(existsSync(join(coreDir, 'dist/index.js'))).toBe(true)
    expect(existsSync(join(coreDir, 'dist/index.d.ts'))).toBe(true)
    expect(existsSync(join(coreDir, 'dist/__tests__'))).toBe(false)
    expect(existsSync(join(cliDir, 'dist/index.js'))).toBe(true)
    expect(existsSync(join(cliDir, 'dist/index.d.ts'))).toBe(true)
    const coreFiles = packPaths(coreDir)
    const coreJoined = coreFiles.join('\n')
    expect(coreJoined).toMatch(/dist\/index\.js/)
    expect(coreJoined).toMatch(/dist\/index\.d.ts/)
    expect(coreJoined).not.toMatch(/__tests__/)
    expect(coreJoined).not.toMatch(/src\/index\.ts/)
    const cliFiles = packPaths(cliDir)
    const cliJoined = cliFiles.join('\n')
    expect(cliJoined).toMatch(/dist\/index\.js/)
    expect(cliJoined).toMatch(/bin\/mpb\.js/)
    expect(cliJoined).not.toMatch(/src\/index\.ts/)
  })
})
