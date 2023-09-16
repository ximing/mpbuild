import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { emitPlan } from './compile/emit.js'
import { loadAppEntry } from './config/entry.js'
import type { ResolvedConfig } from './config/schema.js'
import { diagnostic, type Diagnostic } from './diagnostic/index.js'
import { analyzeGraph } from './graph/analyze.js'
import { buildGraph } from './graph/builder.js'
import { appJsonFromEntry, pageScriptsFromRouter } from './graph/entries.js'
import { planGraph } from './plan/plan.js'
import type { ModuleGraph, OutputPlan } from './types.js'
import { applyWatchTick as applyWatchTickOnce } from './watch/tick.js'
import { startWatch, watchPaths } from './watch/watcher.js'

function emptyGraph(): ModuleGraph {
  return { entries: [], nodes: new Map(), edges: [], packages: [] }
}

function emptyPlan(): OutputPlan {
  return { placements: [], rewrites: [] }
}

type CompilerRunResult = {
  graph: ModuleGraph
  plan: OutputPlan
  diagnostics: Diagnostic[]
  dests: string[]
}

type CompilerTickResult = CompilerRunResult & {
  topologyChanged: boolean
  planChanged: boolean
}

/** 建图 → analyze → plan → emit。缺 app.js/ts 则 MISSING_APP_JS。 */
export function createCompiler(config: ResolvedConfig): {
  run(): Promise<CompilerRunResult>
  applyWatchTick(args: {
    changedIds: string[]
    deletedIds: string[]
    addedRelPaths: string[]
  }): Promise<CompilerTickResult>
  watch(): Promise<{ close(): Promise<void> }>
} {
  let lastGraph: ModuleGraph = emptyGraph()
  let lastPlan: OutputPlan = emptyPlan()
  let lastDests: string[] = []
  let didEmit = false
  let skipAppJsonPages = false

  async function run(): Promise<CompilerRunResult> {
    const srcDir = resolve(config.rootDir, config.src)
    const appJs = join(srcDir, 'app.js')
    const appTs = join(srcDir, 'app.ts')
    const entryScript = existsSync(appJs) ? appJs : existsSync(appTs) ? appTs : undefined
    if (!entryScript) {
      skipAppJsonPages = false
      const result: CompilerRunResult = {
        graph: emptyGraph(),
        plan: emptyPlan(),
        diagnostics: [
          diagnostic({
            code: 'MISSING_APP_JS',
            severity: 'error',
            message: 'MISSING_APP_JS: no app.js or app.ts',
            file: appJs,
          }),
        ],
        dests: [],
      }
      remember(result)
      return result
    }

    const diagnostics: Diagnostic[] = []
    const appEntry = await loadAppEntry(config.rootDir, config.entry)
    const fromRouter = Array.isArray(appEntry.router) ? pageScriptsFromRouter(appEntry) : undefined
    skipAppJsonPages = fromRouter !== undefined
    const built = await buildGraph({
      rootDir: config.rootDir,
      srcDir,
      adapter: config.target,
      entryScripts: fromRouter ? [entryScript, ...fromRouter.sources] : [entryScript],
      alias: config.resolve.alias,
      projects: config.projects,
      platform: config.platform,
      ifdef: config.ifdef,
      packages: fromRouter?.packages,
      skipAppJsonPages,
      virtualModules:
        fromRouter === undefined
          ? undefined
          : [
              {
                id: 'virtual:app.json',
                kind: 'json',
                code: JSON.stringify(appJsonFromEntry(appEntry, config.target)),
              },
            ],
    })
    diagnostics.push(...built.diagnostics)

    const analyzed = analyzeGraph(
      built.graph,
      built.graph.packages.length ? built.graph.packages : [{ root: '' }],
      config.target,
    )
    diagnostics.push(...analyzed.diagnostics)

    const outputDir = resolve(config.rootDir, config.output.dir)
    const planned = planGraph(analyzed.graph, {
      outputDir,
      shared: config.subPackage.shared,
      adapter: config.target,
      platform: config.platform,
      npm: config.output.npm,
    })
    diagnostics.push(...planned.diagnostics)

    const emitted = await emitPlan({
      graph: analyzed.graph,
      plan: planned.plan,
      outputDir,
      clean: didEmit ? false : config.output.clean,
      js: config.compile.js,
      previousDests: didEmit ? lastDests : [],
      preserveNames: [config.target.projectConfigFile],
      npmCompat: config.target.npmCompat,
    })
    diagnostics.push(...emitted.diagnostics)

    const result: CompilerRunResult = {
      graph: analyzed.graph,
      plan: planned.plan,
      diagnostics,
      dests: emitted.dests,
    }
    remember(result)
    return result
  }

  function remember(result: CompilerRunResult): void {
    lastGraph = result.graph
    lastPlan = result.plan
    lastDests = result.dests
    didEmit = true
  }

  async function applyWatchTick(args: {
    changedIds: string[]
    deletedIds: string[]
    addedRelPaths: string[]
  }): Promise<CompilerTickResult> {
    if (!didEmit) {
      await run()
    }
    const result = await applyWatchTickOnce({
      config,
      graph: lastGraph,
      plan: lastPlan,
      previousDests: lastDests,
      changedIds: args.changedIds,
      deletedIds: args.deletedIds,
      addedRelPaths: args.addedRelPaths,
      skipAppJsonPages,
    })
    remember(result)
    return result
  }

  async function watch(): Promise<{ close(): Promise<void> }> {
    if (!didEmit) {
      await run()
    }
    const srcDir = resolve(config.rootDir, config.src)
    const paths = [
      ...watchPaths(lastGraph, srcDir),
      join(config.rootDir, 'mpbuild.config.js'),
      join(config.rootDir, 'mpbuild.config.ts'),
      join(config.rootDir, 'mpbuild.config.mts'),
    ]
    if (config.configPath) {
      paths.push(config.configPath)
    }
    return startWatch({
      paths,
      srcDir,
      onTick: (batch) => applyWatchTick(batch),
      onConfigChange: () => run(),
    })
  }

  return {
    run,
    applyWatchTick,
    watch,
  }
}
