export const version = '2.0.0'

export type {
  AbstractKind,
  EdgeKind,
  Module,
  Edge,
  PackageInfo,
  ModuleGraph,
  Placement,
  Rewrite,
  OutputPlan,
  TargetAdapter,
} from './types.js'
export { EdgeKinds } from './types.js'
export { weappAdapter, getTargetAdapter } from './target/index.js'
export type { Severity, Diagnostic } from './diagnostic/index.js'
export { diagnostic, isError } from './diagnostic/index.js'
export type { ResolvedConfig, AliasValue, SubProject, AppEntry } from './config/schema.js'
export { defineConfig, loadConfig } from './config/load.js'
export { loadAppEntry } from './config/entry.js'
export type { ResolveRequest, ResolveResult } from './resolve/resolver.js'
export { resolveId } from './resolve/resolver.js'
export type { ExtractInput, ExtractedEdge } from './graph/extract.js'
export { extractEdges } from './graph/extract.js'
export { applyIfdef } from './load/ifdef.js'
export { loadConfigJs } from './load/config-js.js'
export type { BuildGraphOptions } from './graph/builder.js'
export { buildGraph } from './graph/builder.js'
export { applyGraphChange } from './graph/patch.js'
export { companionPath } from './graph/suite.js'
export { pageScriptsFromAppJson, pageScriptsFromRouter, appJsonFromEntry } from './graph/entries.js'
export { analyzeGraph } from './graph/analyze.js'
export { planGraph } from './plan/plan.js'
export { transformModule } from './compile/transform.js'
export { rewriteCode } from './compile/rewrite.js'
export { emitPlan } from './compile/emit.js'
export { createCompiler } from './compiler.js'
export { topologyChanged, planChanged } from './watch/diff.js'
export { applyWatchTick } from './watch/tick.js'
export { watchPaths } from './watch/watcher.js'
export { formatGraphInspect } from './inspect.js'

