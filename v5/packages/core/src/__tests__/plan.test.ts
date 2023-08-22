import { describe, expect, it } from 'vitest'
import { planGraph, weappAdapter } from '../index'
import type { Edge, Module, ModuleGraph, TargetAdapter } from '../index'

function mod(id: string, extra: Partial<Omit<Module, 'id'>> = {}): Module {
  return {
    id,
    kind: 'script',
    sourcePath: id,
    owner: 'main',
    hash: '',
    meta: {},
    ...extra,
  }
}

function edge(from: string, to: string, extra: Partial<Edge> = {}): Edge {
  return {
    from,
    to,
    kind: 'require',
    raw: `./${to}`,
    meta: {},
    ...extra,
  }
}

function graphOf(nodes: Module[], edges: Edge[] = []): ModuleGraph {
  return {
    entries: nodes.map((node) => node.id),
    nodes: new Map(nodes.map((node) => [node.id, node])),
    edges,
    packages: [],
  }
}

function run(
  graph: ModuleGraph,
  extra: { shared?: 'duplicate' | 'main'; adapter?: TargetAdapter } = {},
) {
  return planGraph(graph, {
    outputDir: 'dist',
    shared: extra.shared ?? 'duplicate',
    adapter: extra.adapter ?? weappAdapter,
  })
}

describe('planGraph', () => {
  it('places main app script and page template under outputDir', () => {
    const graph = graphOf([
      mod('app.js'),
      mod('pages/index/index.wxml', { kind: 'template' }),
    ])

    const { plan } = run(graph)

    expect(plan.placements).toEqual(
      expect.arrayContaining([
        { moduleId: 'app.js', destPath: 'dist/app.js', package: 'main' },
        {
          moduleId: 'pages/index/index.wxml',
          destPath: 'dist/pages/index/index.wxml',
          package: 'main',
        },
      ]),
    )
    expect(plan.placements).toHaveLength(2)
  })

  it('places a subpackage module under owner without repeating the root', () => {
    const graph = graphOf([mod('pkgA/p.js', { owner: 'pkgA' })])

    const { plan } = run(graph)

    expect(plan.placements).toEqual([
      { moduleId: 'pkgA/p.js', destPath: 'dist/pkgA/p.js', package: 'pkgA' },
    ])
  })

  it('duplicates a shared module into each touching subpackage', () => {
    const graph = graphOf(
      [
        mod('app.js'),
        mod('pkgA/a.js', { owner: 'pkgA' }),
        mod('pkgB/b.js', { owner: 'pkgB' }),
        mod('pkgC/c.js', { owner: 'pkgC' }),
        mod('lib.js', { owner: 'shared' }),
      ],
      [
        edge('app.js', 'lib.js'),
        edge('pkgA/a.js', 'lib.js'),
        edge('pkgB/b.js', 'lib.js'),
        edge('pkgC/c.js', 'lib.js', { affectsOwnership: false }),
        edge('pkgA/a.js', 'plugin://x/y', { raw: 'plugin://x/y', external: true }),
      ],
    )

    const { plan } = run(graph)

    expect(plan.placements.filter((p) => p.moduleId === 'lib.js')).toEqual(
      expect.arrayContaining([
        { moduleId: 'lib.js', destPath: 'dist/pkgA/lib.js', package: 'pkgA' },
        { moduleId: 'lib.js', destPath: 'dist/pkgB/lib.js', package: 'pkgB' },
      ]),
    )
    expect(plan.placements.filter((p) => p.moduleId === 'lib.js')).toHaveLength(2)
    expect(plan.placements.some((p) => p.package === 'pkgC' && p.moduleId === 'lib.js')).toBe(false)
    expect(plan.placements.some((p) => p.destPath.includes('plugin:'))).toBe(false)
  })

  it('uses adapter.emitExt.template for dest suffix', () => {
    const adapter: TargetAdapter = {
      ...weappAdapter,
      id: 'fake',
      emitExt: { ...weappAdapter.emitExt, template: '.out' },
    }
    const graph = graphOf([mod('pages/index/index.wxml', { kind: 'template' })])

    const { plan } = run(graph, { adapter })

    expect(plan.placements).toEqual([
      {
        moduleId: 'pages/index/index.wxml',
        destPath: 'dist/pages/index/index.out',
        package: 'main',
      },
    ])
    expect(plan.placements[0]?.destPath.endsWith('.out')).toBe(true)
  })

  it('places a subpackage-owned file outside the root under owner/id', () => {
    const graph = graphOf([mod('utils/x.js', { owner: 'pkgA' })])

    const { plan } = run(graph)

    expect(plan.placements).toEqual([
      { moduleId: 'utils/x.js', destPath: 'dist/pkgA/utils/x.js', package: 'pkgA' },
    ])
  })

  it('keeps the original suffix for asset modules', () => {
    const graph = graphOf([mod('img/a.png', { kind: 'asset' })])

    const { plan } = run(graph)

    expect(plan.placements).toEqual([
      { moduleId: 'img/a.png', destPath: 'dist/img/a.png', package: 'main' },
    ])
  })

  it('places a shared module once in main when shared is main', () => {
    const graph = graphOf(
      [
        mod('pkgA/a.js', { owner: 'pkgA' }),
        mod('pkgB/b.js', { owner: 'pkgB' }),
        mod('lib.js', { owner: 'shared' }),
      ],
      [edge('pkgA/a.js', 'lib.js'), edge('pkgB/b.js', 'lib.js')],
    )

    const { plan } = run(graph, { shared: 'main' })

    expect(plan.placements.filter((p) => p.moduleId === 'lib.js')).toEqual([
      { moduleId: 'lib.js', destPath: 'dist/lib.js', package: 'main' },
    ])
  })

  it('warns PATH_COLLISION and suffixes the latter dest with 8-char hash', () => {
    const graph = graphOf([
      mod('foo.js', { hash: 'aaaaaaaaaaaaaaaa' }),
      mod('foo.ts', { hash: 'deadbeefcafebabe' }),
    ])

    const { plan, diagnostics } = run(graph)
    const byId = new Map(plan.placements.map((p) => [p.moduleId, p]))

    expect(byId.get('foo.js')?.destPath).toBe('dist/foo.js')
    expect(byId.get('foo.ts')?.destPath).toBe('dist/foo-deadbeef.js')
    expect(diagnostics.some((d) => d.code === 'PATH_COLLISION' && d.severity === 'warning')).toBe(
      true,
    )
  })

  it('emits one rewrite per outgoing edge per placement, including external', () => {
    const graph = graphOf(
      [
        mod('pkgA/a.js', { owner: 'pkgA' }),
        mod('pkgB/b.js', { owner: 'pkgB' }),
        mod('lib.js', { owner: 'shared' }),
        mod('page.json', { kind: 'json' }),
      ],
      [
        edge('pkgA/a.js', 'lib.js', { raw: './lib' }),
        edge('pkgB/b.js', 'lib.js', { raw: './lib' }),
        edge('lib.js', 'dep.js', { raw: './dep' }),
        edge('pkgA/a.js', 'plugin://x/y', { raw: 'plugin://x/y', external: true }),
        edge('page.json', 'comp.js', {
          kind: 'usingComponent',
          raw: '/comp',
          rewritePath: '/usingComponents/x',
        }),
      ],
    )

    const { plan } = run(graph)
    const libPlacements = plan.placements.filter((p) => p.moduleId === 'lib.js')
    expect(libPlacements).toHaveLength(2)

    expect(plan.rewrites).toEqual(
      expect.arrayContaining([
        {
          from: 'lib.js',
          raw: './dep',
          destSpecifier: 'dep.js',
          placementPackage: 'pkgA',
        },
        {
          from: 'lib.js',
          raw: './dep',
          destSpecifier: 'dep.js',
          placementPackage: 'pkgB',
        },
        {
          from: 'pkgA/a.js',
          raw: 'plugin://x/y',
          destSpecifier: 'plugin://x/y',
          placementPackage: 'pkgA',
        },
        {
          from: 'page.json',
          raw: '/comp',
          destSpecifier: 'comp.js',
          placementPackage: 'main',
          rewritePath: '/usingComponents/x',
        },
      ]),
    )
  })
})
