import { describe, expect, it } from 'vitest'
import { analyzeGraph, EdgeKinds, formatAnalyzeJson, weappAdapter } from '../index'
import type { Edge, Module, ModuleGraph, PackageInfo, TargetAdapter } from '../index'

function mod(id: string, owner: string = 'main'): Module {
  return {
    id,
    kind: 'script',
    sourcePath: id,
    owner,
    hash: '',
    meta: {},
  }
}

function edge(from: string, to: string, extra: Partial<Edge> = {}): Edge {
  return {
    from,
    to,
    kind: EdgeKinds.require,
    raw: `./${to}`,
    meta: {},
    ...extra,
  }
}

function graphOf(ids: string[], entries: string[], edges: Edge[], owners?: Record<string, string>): ModuleGraph {
  const nodes = new Map<string, Module>()
  for (const id of ids) {
    nodes.set(id, mod(id, owners?.[id] ?? 'main'))
  }
  return { entries, nodes, edges, packages: [] }
}

const threePkg: PackageInfo[] = [{ root: '' }, { root: 'pkgA' }, { root: 'pkgB' }]

describe('analyzeGraph', () => {
  it('assigns main when the main closure touches a module, else the single subpackage', () => {
    const graph = graphOf(
      ['app.js', 'shared-lib.js', 'main-only.js', 'pkgA/page.js', 'pkgB/page.js', 'only-b.js'],
      ['app.js', 'pkgA/page.js', 'pkgB/page.js'],
      [
        edge('app.js', 'shared-lib.js'),
        edge('app.js', 'main-only.js'),
        edge('pkgA/page.js', 'shared-lib.js'),
        edge('pkgB/page.js', 'only-b.js'),
      ],
    )

    const { graph: out } = analyzeGraph(graph, threePkg, weappAdapter)

    expect(out.nodes.get('main-only.js')?.owner).toBe('main')
    expect(out.nodes.get('shared-lib.js')?.owner).toBe('main')
    expect(out.nodes.get('only-b.js')?.owner).toBe('pkgB')
    expect(out.nodes.get('app.js')?.owner).toBe('main')
    expect(out.nodes.get('pkgA/page.js')?.owner).toBe('pkgA')
    expect(out.nodes.get('pkgB/page.js')?.owner).toBe('pkgB')
  })

  it('assigns shared when two subpackages touch a module the main package does not', () => {
    const graph = graphOf(
      ['app.js', 'pkgA/page.js', 'pkgB/page.js', 'dup.js'],
      ['app.js', 'pkgA/page.js', 'pkgB/page.js'],
      [edge('pkgA/page.js', 'dup.js'), edge('pkgB/page.js', 'dup.js')],
    )

    const { graph: out } = analyzeGraph(graph, threePkg, weappAdapter)

    expect(out.nodes.get('dup.js')?.owner).toBe('shared')
    expect(out.nodes.get('app.js')?.owner).toBe('main')
    expect(out.nodes.get('pkgA/page.js')?.owner).toBe('pkgA')
    expect(out.nodes.get('pkgB/page.js')?.owner).toBe('pkgB')
  })

  it('emits CYCLE warning for A↔B and does not throw', () => {
    const graph = graphOf(['a.js', 'b.js'], ['a.js'], [edge('a.js', 'b.js'), edge('b.js', 'a.js')])

    let result: ReturnType<typeof analyzeGraph> | undefined
    expect(() => {
      result = analyzeGraph(graph, [{ root: '' }], weappAdapter)
    }).not.toThrow()
    expect(result?.diagnostics.some((d) => d.code === 'CYCLE' && d.severity === 'warning')).toBe(true)
  })

  it('emits INDEPENDENT_PACKAGE_EDGE when an independent page edges to a main lib', () => {
    const graph = graphOf(
      ['app.js', 'pkgA/page.js', 'main-lib.js'],
      ['app.js', 'pkgA/page.js'],
      [edge('pkgA/page.js', 'main-lib.js')],
    )
    const packages: PackageInfo[] = [{ root: '' }, { root: 'pkgA', independent: true }]

    const { diagnostics } = analyzeGraph(graph, packages, weappAdapter)

    expect(
      diagnostics.some((d) => d.code === 'INDEPENDENT_PACKAGE_EDGE' && d.severity === 'error'),
    ).toBe(true)
  })

  it('honors adapter.independentEdge warning and ignore', () => {
    const graph = graphOf(
      ['app.js', 'pkgA/page.js', 'main-lib.js'],
      ['app.js', 'pkgA/page.js'],
      [edge('pkgA/page.js', 'main-lib.js')],
    )
    const packages: PackageInfo[] = [{ root: '' }, { root: 'pkgA', independent: true }]

    const warnAdapter: TargetAdapter = { ...weappAdapter, independentEdge: 'warning' }
    const ignoreAdapter: TargetAdapter = { ...weappAdapter, independentEdge: 'ignore' }

    const warned = analyzeGraph(graphOf(
      ['app.js', 'pkgA/page.js', 'main-lib.js'],
      ['app.js', 'pkgA/page.js'],
      [edge('pkgA/page.js', 'main-lib.js')],
    ), packages, warnAdapter)
    const ignored = analyzeGraph(graph, packages, ignoreAdapter)

    expect(warned.diagnostics.some((d) => d.code === 'INDEPENDENT_PACKAGE_EDGE' && d.severity === 'warning')).toBe(
      true,
    )
    expect(ignored.diagnostics.some((d) => d.code === 'INDEPENDENT_PACKAGE_EDGE')).toBe(false)
  })

  it('walks unknown EdgeKind, skips external and affectsOwnership false', () => {
    const graph = graphOf(
      ['app.js', 'pkgA/page.js', 'via-unknown.js', 'via-external.js', 'via-false.js'],
      ['app.js', 'pkgA/page.js'],
      [
        edge('pkgA/page.js', 'via-unknown.js', { kind: 'plugin-custom' }),
        edge('pkgA/page.js', 'via-external.js', { external: true }),
        edge('pkgA/page.js', 'via-false.js', { affectsOwnership: false }),
      ],
      { 'via-external.js': 'untouched', 'via-false.js': 'untouched' },
    )

    const { graph: out } = analyzeGraph(graph, [{ root: '' }, { root: 'pkgA' }], weappAdapter)

    expect(out.nodes.get('via-unknown.js')?.owner).toBe('pkgA')
    expect(out.nodes.get('via-external.js')?.owner).toBe('untouched')
    expect(out.nodes.get('via-false.js')?.owner).toBe('untouched')
  })

  it('leaves unreachable owners, copies packages, and does not add or remove nodes or edges', () => {
    const edges = [edge('app.js', 'main-only.js')]
    const graph = graphOf(
      ['app.js', 'main-only.js', 'orphan.js'],
      ['app.js'],
      edges,
      { 'orphan.js': 'keep-me' },
    )
    const nodeIds = [...graph.nodes.keys()]
    const packages: PackageInfo[] = [{ root: '' }]

    const { graph: out } = analyzeGraph(graph, packages, weappAdapter)

    expect(out.nodes.get('orphan.js')?.owner).toBe('keep-me')
    expect(out.edges).toBe(edges)
    expect(out.edges.length).toBe(1)
    expect([...out.nodes.keys()]).toEqual(nodeIds)
    expect(out.packages).toEqual(packages)
    expect(out.packages).not.toBe(packages)
  })
})

describe('formatAnalyzeJson', () => {
  it('serializes nodes as an array so JSON.stringify works', () => {
    const graph = graphOf(['app.js', 'lib.js'], ['app.js'], [edge('app.js', 'lib.js')])
    const json = formatAnalyzeJson(graph, {
      placements: [{ moduleId: 'app.js', destPath: 'dist/app.js', package: 'main' }],
      rewrites: [],
    })
    const text = JSON.stringify(json)
    expect(text).toContain('"app.js"')
    const parsed = JSON.parse(text) as { nodes: Array<{ id: string }> }
    expect(parsed.nodes.map((node) => node.id).sort()).toEqual(['app.js', 'lib.js'])
  })
})
