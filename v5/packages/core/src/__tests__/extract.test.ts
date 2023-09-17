import { describe, it, expect } from 'vitest'
import { extractEdges, weappAdapter, EdgeKinds } from '../index'

describe('extractEdges', () => {
  it('extracts static import and require from script', () => {
    const edges = extractEdges({
      id: '/a.js',
      kind: 'script',
      adapter: weappAdapter,
      code: `import x from './x'\nconst y = require('./y')\nimport type { Z } from './z'\n`,
    })
    const raws = edges.map((e) => e.raw).sort()
    expect(raws).toEqual(['./x', './y'])
    expect(edges.find((e) => e.raw === './x')?.kind).toBe(EdgeKinds.import)
  })

  it('reads usingComponents from json via adapter table', () => {
    const edges = extractEdges({
      id: '/p.json',
      kind: 'json',
      adapter: weappAdapter,
      code: JSON.stringify({ usingComponents: { btn: '/comp/btn' } }),
    })
    expect(edges).toEqual([
      expect.objectContaining({ raw: '/comp/btn', kind: EdgeKinds.usingComponent }),
    ])
  })

  it('reads template tags from adapter, not hardcoded wxml names in caller', () => {
    const edges = extractEdges({
      id: '/p.wxml',
      kind: 'template',
      adapter: weappAdapter,
      code: `<import src="./t.wxml"/><wxs src="./u.wxs"/>`,
    })
    expect(edges.map((e) => e.raw).sort()).toEqual(['./t.wxml', './u.wxs'])
  })

  it('extracts style @import', () => {
    const edges = extractEdges({
      id: '/a.wxss',
      kind: 'style',
      adapter: weappAdapter,
      code: `@import "./mix.wxss";`,
    })
    expect(edges[0]).toMatchObject({ raw: './mix.wxss', kind: EdgeKinds.styleImport })
  })

  it('follows adapter.templateTags instead of weapp tag names', () => {
    const adapter = {
      ...weappAdapter,
      templateTags: [{ tag: 'inc', attr: 'href', edge: EdgeKinds.templateInclude }],
    }
    const edges = extractEdges({
      id: '/x.tpl',
      kind: 'template',
      adapter,
      code: `<inc href="./part.tpl"/><import src="./t.wxml"/>`,
    })
    expect(edges.map((e) => e.raw)).toEqual(['./part.tpl'])
    expect(edges[0]?.kind).toBe(EdgeKinds.templateInclude)
  })

  it('ignores json keys outside adapter.jsonPathFields', () => {
    const edges = extractEdges({
      id: '/p.json',
      kind: 'json',
      adapter: weappAdapter,
      code: JSON.stringify({
        usingComponents: { btn: '/comp/btn' },
        componentPlaceholder: { item: '/comp/item' },
      }),
    })
    expect(edges.map((e) => e.raw)).toEqual(['/comp/btn'])
  })

  it('extracts string componentGenerics leaves and skips true / objects', () => {
    const edges = extractEdges({
      id: '/p.json',
      kind: 'json',
      adapter: weappAdapter,
      code: JSON.stringify({
        componentGenerics: {
          item: '/comp/item',
          slot: true,
          nested: { default: '/comp/nested' },
        },
      }),
    })
    expect(edges).toEqual([
      expect.objectContaining({ raw: '/comp/item', kind: EdgeKinds.usingComponent }),
    ])
  })

  it('extracts string import() and export-from', () => {
    const edges = extractEdges({
      id: '/a.js',
      kind: 'script',
      adapter: weappAdapter,
      code: `const x = import('./x')\nexport { a } from './a'\nexport type { Z } from './z'\n`,
    })
    const raws = edges.map((e) => e.raw).sort()
    expect(raws).toEqual(['./a', './x'])
    expect(edges.find((e) => e.raw === './x')?.kind).toBe(EdgeKinds.dynamicImport)
    expect(edges.find((e) => e.raw === './a')?.kind).toBe(EdgeKinds.import)
  })
})
