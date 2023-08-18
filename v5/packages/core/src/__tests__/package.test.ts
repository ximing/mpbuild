import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { version } from '../index'

describe('package', () => {
  it('exports a semver version string', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('exposes mpb bin and not mpb5', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const cli = join(here, '../../../cli')
    expect(existsSync(join(cli, 'bin/mpb.js'))).toBe(true)
    expect(existsSync(join(cli, 'bin/mpb5.js'))).toBe(false)
  })
})
