import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cliDir, repoRoot } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-cli-p6-'))
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

function mpb(cwd: string, args: string[]) {
  const bin = join(cliDir, 'bin/mpb.js')
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  })
}

describe('cli p6', () => {
  it('inspect graph uses loadConfig router and --minify shrinks js; bad js exits 1 with TRANSFORM_FAIL', {
    timeout: 60_000,
  }, async () => {
    const built = spawnSync('pnpm', ['build'], { cwd: repoRoot, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)

    const inspectRoot = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/disk/index'] }),
      'src/pages/disk/index.js': 'Page({})\n',
      'src/pages/from-router/index.js': 'Page({})\n',
      'entry.js':
        "export default { router: [{ root: '', pages: { 'pages/from-router/index': '/pages/from-router/index' } }] }\n",
      'mpbuild.config.js':
        "export default { src: 'src', entry: './entry.js', output: { dir: 'dist' } }\n",
    })
    const inspected = mpb(inspectRoot, ['inspect', 'graph'])
    expect(inspected.status, `${inspected.stdout}\n${inspected.stderr}`).toBe(0)
    expect(inspected.stdout).toContain('pages/from-router/index.js')
    expect(inspected.stdout).toContain('owner=')
    expect(inspected.stdout).not.toContain('no src/app.js')

    const minifyRoot = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({ hello: "world", keep: 1 })\n',
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: [] }, output: { dir: 'dist' }, compile: { minify: false } }\n",
    })
    const plain = mpb(minifyRoot, ['build'])
    expect(plain.status, `${plain.stdout}\n${plain.stderr}`).toBe(0)
    const before = await readFile(join(minifyRoot, 'dist/pages/p/p.js'), 'utf8')
    const minified = mpb(minifyRoot, ['build', '--minify'])
    expect(minified.status, `${minified.stdout}\n${minified.stderr}`).toBe(0)
    const after = await readFile(join(minifyRoot, 'dist/pages/p/p.js'), 'utf8')
    expect(after.length).toBeLessThan(before.length)

    const badRoot = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'const x = {\n',
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: [] }, output: { dir: 'dist' } }\n",
    })
    const bad = mpb(badRoot, ['build'])
    expect(bad.status).toBe(1)
    expect(`${bad.stderr}\n${bad.stdout}`).toContain('TRANSFORM_FAIL')
  })
})
