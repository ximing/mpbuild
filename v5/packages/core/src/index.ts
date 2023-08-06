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

