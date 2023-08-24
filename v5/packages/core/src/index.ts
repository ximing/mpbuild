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
export type { ResolvedConfig } from './config/schema.js'
export { defineConfig, loadConfig } from './config/load.js'
export type { ResolveRequest, ResolveResult } from './resolve/resolver.js'
export { resolveId } from './resolve/resolver.js'
export type { ExtractInput, ExtractedEdge } from './graph/extract.js'
export { extractEdges } from './graph/extract.js'
export type { BuildGraphOptions } from './graph/builder.js'
export { buildGraph } from './graph/builder.js'
export { companionPath } from './graph/suite.js'
export { pageScriptsFromAppJson } from './graph/entries.js'
export { analyzeGraph } from './graph/analyze.js'
export { planGraph } from './plan/plan.js'
export { transformModule } from './compile/transform.js'
export { rewriteCode } from './compile/rewrite.js'
export { formatGraphInspect } from './inspect.js'

