import { resolve } from 'node:path'
import { emitPlan } from '../compile/emit.js'
import type { ResolvedConfig } from '../config/schema.js'
import type { Diagnostic } from '../diagnostic/index.js'
import { analyzeGraph } from '../graph/analyze.js'
import { applyGraphChange } from '../graph/patch.js'
import { planGraph } from '../plan/plan.js'
import type { ModuleGraph, OutputPlan } from '../types.js'
import { planChanged, topologyChanged } from './diff.js'

/** 补图后按 topology/plan 谓词决定是否 analyze/plan，再以 clean:false 差量 emit。 */
export async function applyWatchTick(input: {
  config: ResolvedConfig
  graph: ModuleGraph
  plan: OutputPlan
  previousDests: Iterable<string>
  changedIds: string[]
  deletedIds: string[]
  addedRelPaths: string[]
  skipAppJsonPages?: boolean
}): Promise<{
  graph: ModuleGraph
  plan: OutputPlan
  diagnostics: Diagnostic[]
  dests: string[]
  topologyChanged: boolean
  planChanged: boolean
}> {
  const { config, graph, plan: beforePlan } = input
  const srcDir = resolve(config.rootDir, config.src)
  const outputDir = resolve(config.rootDir, config.output.dir)
  const beforeGraph = topologyView(graph)

  const patched = await applyGraphChange({
    graph,
    srcDir,
    rootDir: config.rootDir,
    adapter: config.target,
    alias: config.resolve.alias,
    projects: config.projects,
    platform: config.platform,
    ifdef: config.ifdef,
    changedIds: input.changedIds,
    deletedIds: input.deletedIds,
    addedRelPaths: input.addedRelPaths,
    skipAppJsonPages: input.skipAppJsonPages === true,
    plugins: config.plugins,
  })

  const diagnostics: Diagnostic[] = [...patched.diagnostics]
  const topoChanged = topologyChanged(beforeGraph, patched.graph)

  let plan = beforePlan
  if (topoChanged) {
    const packages = patched.graph.packages.length ? patched.graph.packages : [{ root: '' }]
    const analyzed = analyzeGraph(patched.graph, packages, config.target)
    diagnostics.push(...analyzed.diagnostics)
    const planned = planGraph(analyzed.graph, {
      outputDir,
      shared: config.subPackage.shared,
      adapter: config.target,
      platform: config.platform,
      npm: config.output.npm,
    })
    diagnostics.push(...planned.diagnostics)
    plan = planned.plan
  }

  const planDidChange = planChanged({
    topologyChanged: topoChanged,
    before: beforePlan,
    after: plan,
  })

  const emitted = await emitPlan({
    graph: patched.graph,
    plan,
    outputDir,
    clean: false,
    js: config.compile.js,
    css: config.compile.css,
    previousDests: input.previousDests,
    preserveNames: [config.target.projectConfigFile],
    npmCompat: config.target.npmCompat,
  })
  diagnostics.push(...emitted.diagnostics)

  return {
    graph: patched.graph,
    plan,
    diagnostics,
    dests: emitted.dests,
    topologyChanged: topoChanged,
    planChanged: planDidChange,
  }
}

/** 浅拷贝拓扑相关字段；applyGraphChange 会原地改原数组。 */
function topologyView(graph: ModuleGraph): ModuleGraph {
  return {
    entries: [...graph.entries],
    nodes: new Map(graph.nodes),
    edges: [...graph.edges],
    packages: [...graph.packages],
  }
}
