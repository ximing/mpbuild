import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { emitPlan } from './compile/emit.js'
import type { ResolvedConfig } from './config/schema.js'
import { diagnostic, type Diagnostic } from './diagnostic/index.js'
import { analyzeGraph } from './graph/analyze.js'
import { buildGraph } from './graph/builder.js'
import { planGraph } from './plan/plan.js'
import type { ModuleGraph, OutputPlan } from './types.js'

function emptyGraph(): ModuleGraph {
  return { entries: [], nodes: new Map(), edges: [], packages: [] }
}

function emptyPlan(): OutputPlan {
  return { placements: [], rewrites: [] }
}

/** 建图 → analyze → plan → emit。缺 app.js/ts 则 MISSING_APP_JS。 */
export function createCompiler(config: ResolvedConfig): {
  run(): Promise<{
    graph: ModuleGraph
    plan: OutputPlan
    diagnostics: Diagnostic[]
    dests: string[]
  }>
} {
  return {
    async run() {
      const srcDir = resolve(config.rootDir, config.src)
      const appJs = join(srcDir, 'app.js')
      const appTs = join(srcDir, 'app.ts')
      const entryScript = existsSync(appJs) ? appJs : existsSync(appTs) ? appTs : undefined
      if (!entryScript) {
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

      const diagnostics: Diagnostic[] = []
      const built = await buildGraph({
        rootDir: config.rootDir,
        srcDir,
        adapter: config.target,
        entryScripts: [entryScript],
        alias: config.resolve.alias,
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
      })
      diagnostics.push(...planned.diagnostics)

      const emitted = await emitPlan({
        graph: analyzed.graph,
        plan: planned.plan,
        outputDir,
        clean: config.output.clean,
        js: config.compile.js,
        previousDests: [],
        preserveNames: [config.target.projectConfigFile],
      })
      diagnostics.push(...emitted.diagnostics)

      return { graph: analyzed.graph, plan: planned.plan, diagnostics, dests: emitted.dests }
    },
  }
}
