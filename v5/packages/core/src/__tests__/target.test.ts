import { describe, it, expect } from 'vitest'
import { getTargetAdapter, weappAdapter, EdgeKinds } from '../index'

describe('weapp adapter', () => {
  it('maps template source ext to .wxml and emit ext to .wxml', () => {
    expect(weappAdapter.sourceExts.template).toEqual(['.wxml'])
    expect(weappAdapter.emitExt.template).toBe('.wxml')
    expect(weappAdapter.ifdefToken).toBe('wx')
    expect(weappAdapter.npmCompat).toBe('weapp')
  })

  it('lists wxs as a template tag, not a closed ModuleKind', () => {
    expect(weappAdapter.templateTags).toContainEqual({
      tag: 'wxs',
      attr: 'src',
      edge: EdgeKinds.scriptModule,
    })
  })

  it('treats plugin: as external', () => {
    expect(weappAdapter.externalSpecifiers.test('plugin://foo/bar')).toBe(true)
    expect(weappAdapter.externalSpecifiers.test('./a')).toBe(false)
  })

  it('resolves weapp by id and rejects unknown targets', () => {
    expect(getTargetAdapter('weapp').id).toBe('weapp')
    expect(() => getTargetAdapter('tt')).toThrow(/UNKNOWN_TARGET/)
  })
})
