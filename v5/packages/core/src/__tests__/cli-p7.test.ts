import { spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cliDir, v5Dir } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-cli-p7-'))
  dirs.push(rootDir)
  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ type: 'module' }))
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('cli p7 dev diagnostics', () => {
  it('mpb dev prints MISSING_APP_JS to stderr and keeps the process', {
    timeout: 60_000,
  }, async () => {
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)

    const root = await fixture({
      'src/pages/p/p.js': 'Page({})\n',
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: [] }, output: { dir: 'dist' } }\n",
    })
    const child = spawn(process.execPath, [join(cliDir, 'bin/mpb.js'), 'dev'], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (buf) => {
      stderr += String(buf)
    })
    try {
      await vi.waitFor(
        () => {
          expect(stderr).toContain('MISSING_APP_JS')
        },
        { timeout: 15_000 },
      )
      expect(child.exitCode).toBeNull()
    } finally {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        child.once('exit', () => resolve())
      })
    }
  })
})
