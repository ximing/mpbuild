import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repoRoot } from './repo'

describe('migration-v5.md', () => {
  it('covers spec §21 eight items with numbered headings', () => {
    const md = readFileSync(join(repoRoot, 'docs/migration-v5.md'), 'utf8')
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(md).toContain(`## ${n}.`)
    }
    const required = [
      '@mpbuild/cli',
      '`mpb`',
      'mpbuild.config',
      'mpb.config.js',
      'module.rules',
      'legacyScss',
      'PolymorphismPlugin',
      "platform: 'wx'",
      'ifdef.tokens',
      'SubProjectPlugin',
      'projects',
      'createCompiler',
      'virtual:',
      "require('./x.json')",
      '不再内联',
      'plugin://',
      'Node.js',
      '>=20',
      'mpbuild.config.ts',
      'mpbuild.config.mjs',
      '不要同时留下',
      '--no-cache',
    ]
    for (const token of required) {
      expect(md, `missing ${token}`).toContain(token)
    }
  })
})
