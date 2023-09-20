import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const coreDir = join(here, '../..')
export const cliDir = join(here, '../../../cli')
export const v5Dir = join(here, '../../../..')
export const repoRoot = join(here, '../../../../..')

export function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

const SKIP = new Set(['node_modules', 'dist', '.git', '.worktrees'])

export function listPackageJson(dir: string): string[] {
  const out: string[] = []
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (SKIP.has(name)) {
      continue
    }
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      out.push(...listPackageJson(p))
    } else if (name === 'package.json') {
      out.push(p)
    }
  }
  return out
}
