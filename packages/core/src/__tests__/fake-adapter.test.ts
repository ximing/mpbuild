import { describe, expect, it } from 'vitest'
import {
  extractEdges,
  formatGraphInspect,
  getTargetAdapter,
  weappAdapter,
} from '../index'
import type { Edge, Module, ModuleGraph } from '../index'

describe('fake adapter extract', () => {
  it('extracts inc[href] from the adapter table, not weapp tags', () => {
    const adapter = {
      ...weappAdapter,
      id: 'fake',
      sourceExts: { ...weappAdapter.sourceExts, template: ['.tpl'] },
      emitExt: { ...weappAdapter.emitExt, template: '.out' },
      templateTags: [{ tag: 'inc', attr: 'href', edge: 'template-include' }],
    }
    const edges = extractEdges({
      id: '/x.tpl',
      kind: 'template',
      adapter,
      code: '<inc href="./part.tpl"/>',
    })
    expect(edges[0].raw).toBe('./part.tpl')
    expect(weappAdapter.templateTags.some((t) => t.tag === 'inc')).toBe(false)
    expect(() => getTargetAdapter('fake')).toThrow(/UNKNOWN_TARGET/)
  })
})

describe('formatGraphInspect', () => {
  it('prints two nodes as id, owner, and raw→to deps sorted by id', () => {
    const graph: ModuleGraph = {
      entries: ['a.js'],
      nodes: new Map<string, Module>([
        [
          'a.js',
          {
            id: 'a.js',
            kind: 'script',
            sourcePath: 'a.js',
            owner: 'main',
            hash: '',
            meta: {},
          },
        ],
        [
          'b.js',
          {
            id: 'b.js',
            kind: 'script',
            sourcePath: 'b.js',
            owner: 'pkgA',
            hash: '',
            meta: {},
          },
        ],
      ]),
      edges: [
        {
          from: 'a.js',
          to: 'b.js',
          kind: 'require',
          raw: './b',
          meta: {},
        } satisfies Edge,
      ],
      packages: [],
    }
    expect(formatGraphInspect(graph)).toBe(
      ['a.js\towner=main\tdeps=./b→b.js', 'b.js\towner=pkgA\tdeps='].join('\n'),
    )
  })
})
