import type { Diagnostic } from './diagnostic/index.js'

/** 公开模块 kind。禁止把微信后缀做成判别联合。 */
export type AbstractKind =
  | 'script'
  | 'json'
  | 'template'
  | 'style'
  | 'script-module'
  | 'asset'

/** 边类型是开放字符串。core 内置常量，analyze 对未知边默认参与归属闭包。 */
export type EdgeKind = string

export const EdgeKinds = {
  import: 'import',
  require: 'require',
  dynamicImport: 'dynamic-import',
  usingComponent: 'usingComponent',
  templateImport: 'template-import',
  templateInclude: 'template-include',
  scriptModule: 'script-module',
  styleImport: 'style-import',
  pageSuite: 'page-suite',
  componentSuite: 'component-suite',
  jsonPath: 'json-path',
} as const

export interface Module {
  id: string
  kind: AbstractKind
  /** 虚模块可为空字符串 */
  sourcePath: string
  virtual?: boolean
  pageType?: 'app' | 'page' | 'component'
  /** analyze 之后；'shared' 是保留注解，禁止分包 root 取名 shared */
  owner: 'main' | string
  /** load + ifdef 之后、transform 之前的字节 */
  hash: string
  extraWatchFiles?: string[]
  meta: Record<string, unknown>
}

export interface Edge {
  from: string
  to: string
  kind: EdgeKind
  raw: string
  loc?: { line: number; column: number }
  /** JSON pointer 或模板属性定位，供 rewrite 使用，避免 switch(kind) */
  rewritePath?: string
  external?: boolean
  /** 默认 true；false 则染色时忽略 */
  affectsOwnership?: boolean
  meta: Record<string, unknown>
}

export interface PackageInfo {
  /** 空字符串表示 main */
  root: string
  independent?: boolean
}

export interface ModuleGraph {
  entries: string[]
  nodes: Map<string, Module>
  edges: Edge[]
  packages: PackageInfo[]
}

export interface Placement {
  moduleId: string
  destPath: string
  package: 'main' | string
}

export interface Rewrite {
  from: string
  raw: string
  destSpecifier: string
  placementPackage: 'main' | string
  rewritePath?: string
}

export interface OutputPlan {
  placements: Placement[]
  rewrites: Rewrite[]
}

export interface TargetAdapter {
  id: string
  ifdefToken: string
  suite: Record<'script' | 'json' | 'template' | 'style' | 'scriptModule', AbstractKind>
  sourceExts: Record<AbstractKind, string[]>
  emitExt: Record<AbstractKind, string>
  templateTags: Array<{ tag: string; attr: string; edge: EdgeKind }>
  jsonPathFields: Array<{
    path: string
    edge: EdgeKind
    value: 'path' | 'path-or-true' | 'name-or-path'
  }>
  projectConfigFile: string
  appJson: { pages: string; subPackages: string }
  npmPackageFields: string[]
  sizeLimits: { mainKb: number; subKb: number; totalKb?: number }
  npmCompat: 'weapp' | 'none'
  externalSpecifiers: RegExp
  independentEdge: 'error' | 'warning' | 'ignore'
}

export interface PluginLoadContext {
  adapter: TargetAdapter
  kind: AbstractKind
  sourcePath: string
  code: string
  addWatchFile(path: string): void
  warn(d: { code: string; severity: 'error' | 'warning'; message: string; file?: string }): void
  error(d: { code: string; severity: 'error' | 'warning'; message: string; file?: string }): void
}

export interface PluginGenerateContext {
  adapter: TargetAdapter
  outputDir?: string
  rootDir?: string
  srcDir?: string
  graph?: ModuleGraph
  plan?: OutputPlan
  addWatchFile?(path: string): void
  warn?(d: Diagnostic): void
}

export interface Plugin {
  name: string
  load?(id: string, ctx: PluginLoadContext): string | void | Promise<string | void>
  generate?(
    file: { destPath: string; content: string | Buffer; moduleId?: string },
    ctx: PluginGenerateContext,
  ):
    | { destPath: string; content: string | Buffer; moduleId?: string }
    | Array<{ destPath: string; content: string | Buffer; moduleId?: string }>
    | void
    | Promise<
        | { destPath: string; content: string | Buffer; moduleId?: string }
        | Array<{ destPath: string; content: string | Buffer; moduleId?: string }>
        | void
      >
}
