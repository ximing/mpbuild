import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { transformCacheDir } from './compile/cache.js'
import { emitPlan } from './compile/emit.js'
import { loadAppEntry } from './config/entry.js'
import { CONFIG_NAMES, reloadConfig } from './config/load.js'
import type { ResolvedConfig } from './config/schema.js'
import { diagnostic, type Diagnostic } from './diagnostic/index.js'
import { analyzeGraph } from './graph/analyze.js'
import { buildGraph } from './graph/builder.js'
import { appJsonFromEntry, pageScriptsFromRouter } from './graph/entries.js'
import { planGraph } from './plan/plan.js'
import type { ModuleGraph, OutputPlan, Plugin } from './types.js'
import { applyWatchTick as applyWatchTickOnce } from './watch/tick.js'
import { startWatch, watchPaths } from './watch/watcher.js'

export type CompilerOptions = { cache?: boolean }

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
export function createCompiler(
  config: ResolvedConfig,
  options?: CompilerOptions,
): {
  run(): Promise<CompilerRunResult>
  analyze(): Promise<Omit<CompilerRunResult, 'dests'>>
  applyWatchTick(args: {
    changedIds: string[]
    deletedIds: string[]
    addedRelPaths: string[]
  }): Promise<CompilerTickResult>
  watch(opts?: {
    onDiagnostics?: (diagnostics: Diagnostic[]) => void
  }): Promise<{ close(): Promise<void>; diagnostics: Diagnostic[] }>
} {
  const cacheDir = options?.cache === false ? undefined : transformCacheDir(config.rootDir)
  let lastGraph: ModuleGraph = emptyGraph()
  let lastPlan: OutputPlan = emptyPlan()
  let lastDests: string[] = []
  let lastExtraDests: string[] = []
  let lastWatchFiles: string[] = []
  let didEmit = false
  let skipAppJsonPages = false

  async function missingApp(): Promise<CompilerRunResult> {
    const srcDir = resolve(config.rootDir, config.src)
    const appJs = join(srcDir, 'app.js')
    skipAppJsonPages = false
    return {
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
  }

  async function buildAndPlan(): Promise<Omit<CompilerRunResult, 'dests'> & { outputDir: string }> {
    const srcDir = resolve(config.rootDir, config.src)
    const appJs = join(srcDir, 'app.js')
    const appTs = join(srcDir, 'app.ts')
    const entryScript = existsSync(appJs) ? appJs : existsSync(appTs) ? appTs : undefined
    const outputDir = resolve(config.rootDir, config.output.dir)
    if (!entryScript) {
      const result = await missingApp()
      return { ...result, outputDir }
    }

    const diagnostics: Diagnostic[] = []
    const appEntry = await loadAppEntry(config.rootDir, config.entry)
    const fromRouter = Array.isArray(appEntry.router) ? pageScriptsFromRouter(appEntry) : undefined
    skipAppJsonPages = fromRouter !== undefined
    const pageEntries = fromRouter
      ? fromRouter.sources.map((source, index) => ({
          source,
          logical: fromRouter.scripts[index] ?? source,
        }))
      : undefined
    const built = await buildGraph({
      rootDir: config.rootDir,
      srcDir,
      adapter: config.target,
      entryScripts: [entryScript],
      pageEntries,
      alias: config.resolve.alias,
      projects: config.projects,
      platform: config.platform,
      ifdef: config.ifdef,
      packages: fromRouter?.packages,
      skipAppJsonPages,
      plugins: config.plugins,
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

    const planned = planGraph(analyzed.graph, {
      outputDir,
      shared: config.subPackage.shared,
      adapter: config.target,
      platform: config.platform,
      npm: config.output.npm,
    })
    diagnostics.push(...planned.diagnostics)

    return {
      graph: analyzed.graph,
      plan: planned.plan,
      diagnostics,
      outputDir,
    }
  }

  async function run(): Promise<CompilerRunResult> {
    const built = await buildAndPlan()
    const emitted = await emitPlan({
      graph: built.graph,
      plan: built.plan,
      outputDir: built.outputDir,
      clean: didEmit ? false : config.output.clean,
      js: config.compile.js,
      css: config.compile.css,
      previousDests: didEmit ? lastDests : [],
      preserveNames: [config.target.projectConfigFile],
      preservePaths: lastExtraDests,
      npmCompat: config.target.npmCompat,
      minify: config.compile.minify,
      cacheDir,
      platform: config.platform,
      ifdefTokens: config.ifdef?.tokens ?? {},
    })
    const extras = await applyGeneratePlugins(config.plugins ?? [], {
      outputDir: built.outputDir,
      adapter: config.target,
      graph: built.graph,
      plan: built.plan,
      rootDir: config.rootDir,
      srcDir: resolve(config.rootDir, config.src),
    })
    lastWatchFiles = extras.watchFiles
    lastExtraDests = extras.dests
    const result: CompilerRunResult = {
      graph: built.graph,
      plan: built.plan,
      diagnostics: [
        ...(config.loadWarnings ?? []),
        ...built.diagnostics,
        ...emitted.diagnostics,
        ...extras.diagnostics,
      ],
      dests: [...emitted.dests, ...extras.dests],
    }
    remember(result)
    return result
  }

  async function analyze(): Promise<Omit<CompilerRunResult, 'dests'>> {
    const built = await buildAndPlan()
    lastGraph = built.graph
    lastPlan = built.plan
    return {
      graph: built.graph,
      plan: built.plan,
      diagnostics: [...(config.loadWarnings ?? []), ...built.diagnostics],
    }
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
      preservePaths: lastExtraDests,
      changedIds: args.changedIds,
      deletedIds: args.deletedIds,
      addedRelPaths: args.addedRelPaths,
      skipAppJsonPages,
      cacheDir,
    })
    const extras = await applyGeneratePlugins(config.plugins ?? [], {
      outputDir: resolve(config.rootDir, config.output.dir),
      adapter: config.target,
      graph: result.graph,
      plan: result.plan,
      rootDir: config.rootDir,
      srcDir: resolve(config.rootDir, config.src),
    })
    lastWatchFiles = extras.watchFiles
    lastExtraDests = extras.dests
    const withExtras = {
      ...result,
      dests: [...result.dests, ...extras.dests],
      diagnostics: [...result.diagnostics, ...extras.diagnostics],
    }
    remember(withExtras)
    return withExtras
  }

  async function watch(opts?: {
    onDiagnostics?: (diagnostics: Diagnostic[]) => void
  }): Promise<{ close(): Promise<void>; diagnostics: Diagnostic[] }> {
    let firstDiagnostics: Diagnostic[] = []
    if (!didEmit) {
      const first = await run()
      firstDiagnostics = first.diagnostics
      opts?.onDiagnostics?.(firstDiagnostics)
    }
    const srcDir = resolve(config.rootDir, config.src)
    const projects = (config.projects ?? []).map((project) => ({
      ...project,
      src: resolve(config.rootDir, project.src),
    }))
    const reloadFiles = [
      ...CONFIG_NAMES.map((name) => join(config.rootDir, name)),
      config.configPath,
      typeof config.entry === 'string' ? resolve(config.rootDir, config.entry) : '',
    ].filter((file) => Boolean(file))
    const paths = [...watchPaths(lastGraph, srcDir, projects), ...reloadFiles, ...lastWatchFiles]
    const handle = await startWatch({
      paths,
      srcDir,
      get graph() {
        return lastGraph
      },
      projects,
      reloadFiles,
      onTick: async (batch) => {
        const result = await applyWatchTick(batch)
        opts?.onDiagnostics?.(result.diagnostics)
      },
      onConfigChange: async () => {
        await reloadConfig(config)
        const result = await run()
        opts?.onDiagnostics?.(result.diagnostics)
      },
    })
    return { close: handle.close, diagnostics: firstDiagnostics }
  }

  return {
    run,
    analyze,
    applyWatchTick,
    watch,
  }
}

async function applyGeneratePlugins(
  plugins: Plugin[],
  ctx: {
    outputDir: string
    adapter: ResolvedConfig['target']
    graph: ModuleGraph
    plan: OutputPlan
    rootDir: string
    srcDir: string
  },
): Promise<{ dests: string[]; watchFiles: string[]; diagnostics: Diagnostic[] }> {
  const dests: string[] = []
  const watchFiles: string[] = []
  const diagnostics: Diagnostic[] = []
  const destPath = join(ctx.outputDir, ctx.adapter.projectConfigFile)
  for (const plugin of plugins) {
    if (!plugin.generate) {
      continue
    }
    const result = await plugin.generate(
      { destPath, content: '' },
      {
        adapter: ctx.adapter,
        outputDir: ctx.outputDir,
        graph: ctx.graph,
        plan: ctx.plan,
        rootDir: ctx.rootDir,
        srcDir: ctx.srcDir,
        addWatchFile: (path) => {
          watchFiles.push(path)
        },
        warn: (d) => {
          diagnostics.push(d)
        },
      },
    )
    const files = result == null ? [] : Array.isArray(result) ? result : [result]
    for (const file of files) {
      await mkdir(dirname(file.destPath), { recursive: true })
      await writeFile(file.destPath, file.content)
      dests.push(file.destPath)
    }
  }
  return { dests, watchFiles, diagnostics }
}
