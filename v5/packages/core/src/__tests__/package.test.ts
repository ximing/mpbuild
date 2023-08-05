import { describe, it, expect } from 'vitest'
import { version } from '../index'

describe('package', () => {
  it('exports a semver version string', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })
})
