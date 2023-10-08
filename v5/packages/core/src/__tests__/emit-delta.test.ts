import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { emitPlan } from '../index'
import type { Module, ModuleGraph, OutputPlan } from '../index'

const dirs: string[] = []

function mod(id: string, sourcePath: string): Module {
  return {
    id,
    kind: 'script',
    sourcePath,
    owner: 'main',
    hash: '',
    meta: {},
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('emitPlan delta', () => {
  it('preserves project.config.json on clean, skips identical bytes, unlinks cancelled dests', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-emit-'))
    dirs.push(rootDir)
    const outputDir = join(rootDir, 'dist')
    const srcA = join(rootDir, 'a.js')
    const srcB = join(rootDir, 'b.js')
    await writeFile(srcA, 'module.exports = 1\n')
    await writeFile(srcB, 'module.exports = 2\n')
    await mkdir(outputDir, { recursive: true })
    await writeFile(join(outputDir, 'project.config.json'), '{"appid":"keep"}\n')
    await writeFile(join(outputDir, 'junk.js'), 'stale\n')

    const destA = join(outputDir, 'a.js')
    const destB = join(outputDir, 'b.js')
    const graph: ModuleGraph = {
      entries: ['a.js', 'b.js'],
      nodes: new Map([
        ['a.js', mod('a.js', srcA)],
        ['b.js', mod('b.js', srcB)],
      ]),
      edges: [],
      packages: [],
    }
    const plan: OutputPlan = {
      placements: [
        { moduleId: 'a.js', destPath: destA, package: 'main' },
        { moduleId: 'b.js', destPath: destB, package: 'main' },
      ],
      rewrites: [],
    }
    const js = { target: 'es2018', module: 'commonjs' } as const

    const first = await emitPlan({
      graph,
      plan,
      outputDir,
      clean: true,
      js,
      preserveNames: ['project.config.json'],
    })

    expect(first.dests).toEqual([destA, destB])
    expect(existsSync(join(outputDir, 'junk.js'))).toBe(false)
    expect(await readFile(join(outputDir, 'project.config.json'), 'utf8')).toBe(
      '{"appid":"keep"}\n',
    )
    expect(existsSync(destA)).toBe(true)
    expect(existsSync(destB)).toBe(true)

    const kept = await stat(destA)
    await new Promise((resolve) => setTimeout(resolve, 10))

    const second = await emitPlan({
      graph,
      plan: { placements: [plan.placements[0]!], rewrites: [] },
      outputDir,
      clean: false,
      js,
      previousDests: first.dests,
      preserveNames: ['project.config.json'],
    })

    expect(second.dests).toEqual([destA])
    expect(existsSync(destB)).toBe(false)
    const after = await stat(destA)
    expect(after.mtimeMs).toBe(kept.mtimeMs)
  })

  it('does not unlink preserveNames extras when they are not placements', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-emit-keep-'))
    dirs.push(rootDir)
    const outputDir = join(rootDir, 'dist')
    const srcA = join(rootDir, 'a.js')
    await writeFile(srcA, 'module.exports = 1\n')
    await mkdir(outputDir, { recursive: true })
    const extra = join(outputDir, 'project.config.json')
    await writeFile(extra, '{"appid":"keep-tick"}\n')
    const destA = join(outputDir, 'a.js')
    const graph: ModuleGraph = {
      entries: ['a.js'],
      nodes: new Map([['a.js', mod('a.js', srcA)]]),
      edges: [],
      packages: [],
    }
    const js = { target: 'es2018', module: 'commonjs' } as const
    await emitPlan({
      graph,
      plan: { placements: [{ moduleId: 'a.js', destPath: destA, package: 'main' }], rewrites: [] },
      outputDir,
      clean: false,
      js,
      previousDests: [destA, extra],
      preserveNames: ['project.config.json'],
    })
    expect(existsSync(extra)).toBe(true)
    expect(await readFile(extra, 'utf8')).toBe('{"appid":"keep-tick"}\n')
  })
})
