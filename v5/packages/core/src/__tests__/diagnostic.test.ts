import { describe, it, expect } from 'vitest'
import { diagnostic, isError } from '../index'

describe('diagnostic', () => {
  it('marks error severity as fatal', () => {
    const d = diagnostic({
      code: 'RESOLVE_MISS',
      severity: 'error',
      message: 'cannot resolve ./missing',
      file: '/app/a.js',
    })
    expect(isError(d)).toBe(true)
    expect(d.code).toBe('RESOLVE_MISS')
  })

  it('does not treat warnings as fatal', () => {
    const d = diagnostic({
      code: 'CYCLE',
      severity: 'warning',
      message: 'cycle',
    })
    expect(isError(d)).toBe(false)
  })
})
