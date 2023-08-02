# mpbuild 5.0 图驱动架构设计

日期：2026-08-19  
状态：评审后修订稿  
范围：主版本重写（方案 C）。4.x 冻结，不续写 `next/`。  
修订来源：架构 / 性能 / 多端三路评审。本版本仍只实现微信；为抖音等第二目标留 adapter 缝，不实现 tt。

## 1. 背景与问题

`packages/mpbuild`（4.x）是可用的微信小程序构建器，流水线是边发现、边编译、边改路径、边写盘：

```
entry → Scan 展开四件套 → addAsset → loaders → beforeEmitFile 解析依赖并改写 → 递归 addAsset → emit
```

依赖散落在 `HandleJSDep` / `HandleWXMLDep` / `HandleWXSSDep` / `HandleJSONComponentDep`。没有一等公民的模块图。输出路径靠 `rewriteOutputPath` 和全局 `subPkgPathMap` 边走边定。Watch 按旧 outputPath 重跑单个 Asset，删除不清理依赖方。

工具链停在 Tapable 1、Babel 7、PostCSS 7、UglifyJS、htmlparser2、Watchpack 1（默认 poll）。

`next/` 是半成品：文档互相矛盾，CLI 是 glob 全量编译，依赖用正则抽取，不作为实现基础。

根因不是依赖版本，是「图、变换、落盘」揉在同一条钩子链里。原地换 SWC 解决不了归属计算、增量失效和插件边界。

## 2. 目标与非目标

### 2.1 目标

- 先完整建图，再分析归属，再出 Output Plan，最后变换和写盘。
- 产物语义对齐 4.x，金样为 `example/demo`（含子仓库、函数 alias、wx 多态、自定义 router、分包、组件相对路径、npm 重写）。
- 配置和插件 API 全新。不读取 `mpb.config.js` 的 `module.rules`，不兼容 `apply(mpb)` / Tapable 1。
- JS/TS 用 SWC，CSS 用 Lightning CSS。依赖从 **load 之后、transform 之前** 的源码 AST 抽取。
- Watch 按内容 hash 做增量建图与失效；用拓扑/Plan 谓词决定重跑范围，不猜 `owner`。
- 公开类型用抽象 kind + `TargetAdapter`。首发只实现 `weapp`；加抖音是填表，不是改 core。
- 4.x 继续可发布；5.0 新包并行。

### 2.2 非目标

- 不兼容旧 loader 链和旧钩子。
- 不把小程序打成少量 JS bundle。
- **不实现**抖音 / 头条 / 支付宝 / 百度适配。不发布 `@mpbuild/target-tt`。
- 不做 HMR 运行时。
- 不实现 `next/` 的五层空壳目录。
- 不把 Babel / PostCSS 做成默认引擎。`legacyScss()` 仅为金样可选插件。
- 不在 5.0 首发时接管 `mpb` 二进制名。
- 首发不做：workers、sitemap/theme 入图、tabBar 图标入图、WXML `<image src>` 入图、json `extends`、指定分包编译、HTML 分析图、`tsc` 型检查、minify 的 include/exclude、路径 hash 缩短。

## 3. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 迭代策略 | 方案 C：主版本重写 | 用户确认 |
| 兼容策略 | 只保证产物语义 | 旧 API 与图驱动冲突 |
| 代码位置 | 新建 `v5/`，冻结 4.x，不改 `next/` | `next/` 不可用 |
| CLI / 包名 | `mpb5`；`@mpbuild/core` `@mpbuild/cli@2.0.0` | 与 `mpbuild@4` 分离 |
| 图冻结点 | **`buildGraph` 结束**后拓扑不可变 | transform 后补边会毁掉 Plan；建图期必须还能加虚拟模块和入口 |
| JS 工具 | SWC；**允许 parse 两次**（抽依赖 + 编译） | 不为「一次 AST」在图上常驻整棵树 |
| CSS 工具 | Lightning CSS；Sass/Less / 类 SCSS 为插件 | 替换 PostCSS 7 |
| 多端 | `TargetAdapter` + 抽象 kind；`target` ≠ `platform` | `platform` 只够 ifdef/多态后缀，不够抖音的 `.ttml`/`.sjs` |
| 插件 | 阶段钩子 + `PluginContext`；不能插入阶段 | 缺的是建图期 API，不是更多阶段 |
| 分包共享 | 默认 `duplicate` | 对齐 4.x |
| 模块格式 | 默认 CommonJS，`compile.js.target` 默认 `es2018` | 微信运行时；与 adapter `target` 不同名 |
| 入口 | 保留 `entry.js` 的 `router` | 产物语义 |
| 金样 | `example/demo` | 不对比字节 |
| 性能验收 | 5x / 200ms 为志向指标，不进 CI fail | 金样太小，测的是噪声 |

## 4. 仓库布局

```
v5/
  package.json
  pnpm-workspace.yaml
  tsconfig.json
  packages/
    core/          # @mpbuild/core
    cli/           # @mpbuild/cli，bin: mpb5
    example/       # 从 example/demo + example/projects 迁入
```

根 workspace 增加 `v5/packages/*`。4.x 包不改行为。`next/` 不删除，禁止当依赖或拷贝源。

```
v5/packages/core/src/
  index.ts
  config/
  resolve/          # 解析服务，不是一个流水线阶段
  graph/
  plan/
  compile/
  watch/
  plugin/
  diagnostic/
  target/           # 仅常量表，不是空壳层。weapp.ts 为默认 adapter
  types.ts
```

禁止再拆 application / service / foundation。`target/` 只放 adapter 表。

`@mpbuild/cli` 只做参数、调 core、打印诊断。

## 5. 流水线

### 5.1 阶段

```
loadConfig
  → resolveEntries          # 插件可改 AppEntry
    → buildGraph            # load + 抽边 + resolve；允许 emitModule / 虚模块
      → analyze             # 只写 owner / 环 / diagnostics / meta，不改拓扑
        → plan
          → transform
            → rewrite
              → generate
                → emit
                  → extras  # copy / project.config 等非模块产物
```

阶段之间：`buildGraph` 结束后 **拓扑不可变**（节点与边的增删）。`analyze` 只写 `owner`、`meta`、诊断。`plan` 返回新对象，不就地改传入的 plan。

插件不能插入阶段，不能从 `generate` 回到 graph。

### 5.2 硬约束

1. `transform` 及之后若出现未入图的模块引用，报 `UNRESOLVED_AFTER_GRAPH`，不补边。增量路径在 **graph 阶段** 补边，见 §14。
2. 一个源模块可对应多条 placement。transform 对每个源模块只做一次；emit 按 placement 写多份并分别 rewrite。相同字节复用同一 Buffer。
3. Watch 重跑范围用 §14 的 `topologyChanged` / `planChanged`，**禁止**用「owner 可能变化」这种口语谓词，**禁止**把 dependents 闭包默认送进 transform。

### 5.3 并发契约（硬性，不是优化可选项）

必须串行的屏障：完整 `resolveEntries` → 整图封闭 → `analyze` → `plan` →（transform 与 plan 都完成后）`rewrite` → `generate` → `emit`。

必须有界并行（默认上限 `os.availableParallelism()`，封顶 16）：

- `buildGraph`：队列 BFS，按最终 `id` 做 visited，环边照常入图留到 analyze。禁止 async DFS 递归。
- `resolve`：按 `(importer, request, kind, platform)` memoize。
- `analyze`：一次多源染色，禁止「每个包走一遍闭包」的 `O(P·(n+e))`。
- `transform`：模块间独立，有界并行。允许与 analyze/plan **重叠**（transform 不得读取 owner/dest）。
- `emit`：有界并行写盘。

P1 验收：N 个无依赖模块的 transform wall time 不得约等于 N 倍单模块时间。

### 5.4 图规模与内存

热数据常驻：`id` / `kind` / `hash` / `owner` / 边。源码在 extract/transform 后可丢。禁止在 `Module` 上常驻 SWC AST。asset 流式拷贝，用 size + 内容 hash（大文件可抽样），不要整图进字符串。

预期量级（文档声明，非 CI）：约 5k 模块 / 200MB 源。金样远小于此，不能当性能证明。

## 6. 核心数据模型

```ts
type AbstractKind = 'script' | 'json' | 'template' | 'style' | 'script-module' | 'asset'

/** 边类型是开放字符串。core 内置常量，analyze 对未知边默认参与归属闭包。 */
type EdgeKind = string
const EdgeKinds = {
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

interface Module {
  id: string
  kind: AbstractKind
  sourcePath: string          // 虚模块可为空字符串
  virtual?: boolean
  pageType?: 'app' | 'page' | 'component'
  owner: 'main' | string      // analyze 之后；'shared' 是保留注解，禁止分包 root 取名 shared
  hash: string                // load + ifdef 之后、transform 之前的字节
  extraWatchFiles?: string[]
  meta: Record<string, unknown>
}

interface Edge {
  from: string
  to: string
  kind: EdgeKind
  raw: string
  loc?: { line: number; column: number }
  /** JSON pointer 或模板属性定位，供 rewrite 使用，避免 switch(kind) */
  rewritePath?: string
  external?: boolean
  affectsOwnership?: boolean  // 默认 true；false 则染色时忽略
  meta: Record<string, unknown>
}

interface ModuleGraph {
  entries: string[]
  nodes: Map<string, Module>
  edges: Edge[]
  packages: PackageInfo[]
}

interface Placement {
  moduleId: string
  destPath: string
  package: 'main' | string
}

interface Rewrite {
  from: string
  raw: string
  destSpecifier: string
  placementPackage: 'main' | string
  rewritePath?: string
}

interface OutputPlan {
  placements: Placement[]
  rewrites: Rewrite[]
}

interface TargetAdapter {
  id: string
  ifdefToken: string
  suite: Record<'script' | 'json' | 'template' | 'style' | 'scriptModule', AbstractKind>
  sourceExts: Record<AbstractKind, string[]>
  emitExt: Record<AbstractKind, string>
  templateTags: Array<{ tag: string; attr: string; edge: EdgeKind }>
  jsonPathFields: Array<{
    path: string                    // 如 usingComponents.*, componentGenerics.*.default
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
```

`page-suite` / `component-suite`：页面或组件的 script 节点指向其 json/template/style/script-module（若存在）。

`inspect graph` / `analyze` JSON 可多写调试字段 `debugExt: '.wxml'`，**不得**用微信后缀做 TypeScript 判别联合。

## 7. 配置

加载顺序：`mpbuild.config.ts` → `.mts` → `.js`（`export default` 或 `module.exports`）。

不读取 `mpb.config.js`。仅有旧文件时诊断 `LEGACY_CONFIG`，退出码 2。

```ts
export interface MPBuildConfig {
  src: string
  entry: string | AppEntry
  target?: string | TargetAdapter   // 字符串只查内置表；首发仅 'weapp'
  output: {
    dir: string
    npm: string
    clean: boolean
    componentRelative: boolean
  }
  resolve: {
    alias: Record<string, string | AliasFn>
    extensions?: Partial<Record<AbstractKind, string[]>>
  }
  compile: {
    js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
    css: { lightningcss: boolean }
    minify: boolean | Partial<Record<AbstractKind, boolean>>
  }
  subPackage: {
    shared: 'duplicate' | 'main'
    mainMaxKb?: number
    subMaxKb?: number
  }
  platform?: string                 // 多态后缀与 ifdef TOKEN，demo 为 'wx'
  ifdef?: {
    tokens?: Record<string, string | boolean>
    blockcode?: boolean             // 默认 true
  }
  projects?: SubProject[]
  plugins?: Plugin[]
}

type AliasFn = (ctx: { importer: string; request: string }) => string | undefined

interface SubProject {
  name: string
  src: string
  alias: Record<string, string>
}

interface AppEntry {
  router?: RouterGroup[]
  pages?: string[]
  subPackages?: { root: string; name?: string; pages: string[]; independent?: boolean; [k: string]: unknown }[]
  usingComponents?: Record<string, string>
  [extra: string]: unknown
}

interface RouterGroup {
  root: string
  pages: Record<string, string>
  name?: string
  independent?: boolean
  [extra: string]: unknown
}
```

默认值：

```ts
{
  src: 'src',
  target: 'weapp',
  output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
  resolve: { alias: {} },          // extensions 默认 = adapter.sourceExts
  compile: {
    js: { target: 'es2018', module: 'commonjs' },
    css: { lightningcss: true },
    minify: false,
  },
  subPackage: { shared: 'duplicate' },
}
```

未识别的 `target` 字符串 → `UNKNOWN_TARGET`，不要静默当成 ifdef token。

`defineConfig` 只做类型，运行时原样返回。

`entry` 为字符串时加载该文件得到 `AppEntry`。

规范化：

- 有 `router`：只按 `router` 扫页面。输出的 pages/subPackages 由 router 生成：`{ ...group, pages: Object.keys(group.pages) }`（去掉映射对象，保留 `name` / `independent` / 其它键）。
- 无 `router` 且有 `pages`：主包组 `root: ''`，`pages[p] = '/' + p`。
- 无 `router` 且有 `subPackages`：每项一组，源路径 `'/' + join(root, page)`。可与上一条同时成立。
- 都没有：`EMPTY_ENTRY`。

输出 app.json 的字段名走 `adapter.appJson`。entry / 生成后的 app.json **必须再跑一遍 JSON 字段表**（全局 `usingComponents` 入图并 rewrite）。这是对 4.x `AppJSON` 虚拟文件走 `HandleJSONComponentDep` 的对齐，不是新功能。

改 app.json 用 `generate` 或 `plan`；要改落点只能走 `plan`。

## 8. 解析（resolve）

顺序，命中即停：

1. 插件 `resolve`。可返回：
   - 磁盘绝对路径（必须存在，否则 `RESOLVE_PLUGIN_MISS`）；
   - 虚拟 id（`virtual:` 或 `\0` 前缀），**不**要求落盘，必须有对应 `load`。
2. `adapter.externalSpecifiers` 命中：不建节点，边标 `external: true`（或不建边），**不** `RESOLVE_MISS`，源码/JSON 里原样保留。至少包含 `plugin:`、`http:`、`https:`、`data:`、`wxfile:`。
3. Node builtin（`path` / `fs` 等）→ `RESOLVE_MISS`。禁止偷偷 polyfill。
4. `alias`：最长前缀。函数返回空则跳过该 alias。
5. `request` 以 `.` 开头：相对 importer。
6. `request` 以 `/` 开头：相对 `src`。子仓库内 `/` → `ABS_PATH_IN_SUBPROJECT`。
7. 否则当 npm：从 importer 向上找 `node_modules`，字段序为 `adapter.npmPackageFields`。weapp 为 `miniprogram` / `browser` / `main` / `module`。这比 4.x（`browser-resolve`，不读 `miniprogram`）更强，属刻意差异。

扩展名补全：按该边的 `AbstractKind` 对应 `sourceExts`，先原名，再名+ext，再 `name/index`+ext。

script 边额外尝试 `json` 与 `script-module` 的扩展名，对齐 4.x `exts.js.concat(['.json','.wxs'])`。模板边的 script-module 引用（`<wxs src>`）用 `script-module` 扩展名列表。

`platform` 非空时，每个候选先试 `*.${platform}${ext}`，再试无后缀。只选一个进图。未选中的兄弟文件列入 `extraWatchFiles`。

子仓库：解析结果落在 `projects[].src` 时，先用该 project 的 alias，再用全局 alias。

## 9. 建图（graph）

遍历：全局 visited（最终 `id`）、队列 BFS、有界并发。环边入图，analyze 再报。

### 9.1 入口扫描

1. 在 `src` 下按 `adapter.sourceExts` 展开 app suite。缺 script → `MISSING_APP_JS`。
2. 每个 router 页面展开 suite。缺 script → `MISSING_PAGE_JS`。json 可缺。
3. json 字段表抽到的路径再展开 component suite。
4. 插件 `resolveEntries` 瀑布之后，可 `addEntry` / `emitModule`。

`.config.js`：当 json 模块。隔离执行，只允许导出纯对象。输出用 `adapter.emitExt.json`。不要求对象必须带 `usingComponents`（相对 4.x 的修复，§18 登记）。执行结果字节进 hash；该文件 `require` 到的邻接文件进 `extraWatchFiles`。

### 9.2 依赖抽取

全部从 load + ifdef 之后、transform 之前的源码抽取。core **只问 adapter**，不写死 `wxml`/`wxs` 字符串。

| kind | 抽取 |
|---|---|
| script | SWC parse：`import` / `export from` / 字符串 `require` / 字符串 `import()` |
| script-module | 同上，仅静态字符串 |
| json | 按 `jsonPathFields` 取值 |
| template | 按 `templateTags` 取属性 |
| style | `@import`；`url()` 规则见下 |
| asset | 不抽 |

JS：动态 specifier → `DYNAMIC_SPECIFIER` 警告。`import type` 不入图。`require('./x.json')` 入图，**不内联**，输出独立 json（刻意 break）。

`url()`：只收相对路径和 alias；忽略绝对 URL、`data:`、`#`、`url(var(--x))`。首发 WXML `<image src>` **不抽**（对齐 4.x，§22 登记）。

模板解析只改正表内属性，禁止整树序列化。

样式默认当 CSS 抽 `@import`。`.scss`/`.less` 仅当插件经 `configResolved` 写入 `sourceExts.style` 后才入图。金样的类 SCSS 是 **`.wxss` + PostCSS**，由 `legacyScss()` 挂在 `load` 上；预处理 import 必须登记为边或 `extraWatchFiles`。

插件可提供 `extract(mod, code) → Edge[]`，与内置合并、按 `(from,to,kind,raw)` 去重。

### 9.3 analyze

- 环：`CYCLE` 警告。独立分包越界边按 `adapter.independentEdge`（weapp 默认 `error` → `INDEPENDENT_PACKAGE_EDGE`）。此条 **严于 4.x**（4.x 不查），也严于微信「独立分包异步化后可引用主包」；登记在 §18。
- 归属：
  1. 被主包闭包（`root === ''` 的页面 + app）触及 → `owner = 'main'`
  2. 只被一个分包触及 → `owner = 该 root`
  3. 被多个分包触及、主包未触及 → `owner = 'shared'`
- 闭包沿 `affectsOwnership !== false` 的边走，含 suite。
- 禁止增删节点和边。只写 `owner` / `meta` / 诊断。

## 10. Output Plan

dest 扩展名 = `adapter.emitExt[kind]`，禁止写死 `.wxss`。

1. `owner === 'main'` → 一份，相对 `src`（虚模块按 id 去掉 `virtual:` 前缀）。
2. `owner === 某分包` → 一份，在 `output.dir / root /` 下。源已在该分包目录则保持相对结构；否则按 4–6。
3. `shared` + `duplicate` → 每个使用它的分包一份。
4. `shared` + `main` → 一份进主包。
5. npm：`output.npm + 包内路径`，再套 1–4。
6. 子仓库：`project.name + 相对 project.src`。

平台 infix（对齐 4.x 金样）：

- suite 落点用逻辑名 + `emitExt`（`pages/user/index.js`，不含 `.wx`）。
- 非 suite 依赖保留源 basename（`utils/a.wx.js`、`tpl.wx.wxml`），只替换语言扩展名（`.ts`→`emitExt.script`）。

dest 冲突：多留一级源目录；仍冲突则 8 位内容 hash 后缀 + `PATH_COLLISION`。

`componentRelative === true` 时，json 里路径类字段的 rewrite 必须相对该 json 的 dest 目录，且以 `./` 或 `../` 开头。

体积警告用 **transform 后** 字节；未 transform 时退回源字节并在文案标明估算。默认阈值取 `adapter.sizeLimits`。

plan 返回值必须校验：`moduleId` 存在、suite 成员同包、dest 冲突走上述规则。失败 → `INVALID_PLAN`。

`generate` **禁止**改 `destPath`。

## 11. 编译与写出

| kind | 实现 | 输出 |
|---|---|---|
| script | SWC，`jsc.target` / `module.type` 来自 `compile.js` | `emitExt.script`，可选 map |
| script-module | SWC parse + 可选 minify；不降到破坏 wxs 的 target；不转 JSX | `emitExt['script-module']` |
| style | Lightning CSS | `emitExt.style` |
| template | 专用解析 + 按 rewritePath 改属性 | `emitExt.template` |
| json | `JSON.stringify` | `emitExt.json` |
| asset | 流式拷贝 | 原扩展名 |

transform 与 minify 共享同一次 SWC 调用。建图那次 parse 用完即弃。

Source map：`minify` 为假时默认独立 `.map`。duplicate 的每份 placement 单独改写 `sources` / `sourceMappingURL`；或在 duplicate 时关闭 map。必须在实现里二选一，默认选「每份改写」。

`output.clean === true`：**仅** `run()` / `mpb5 build` 的第一次 emit，以及 `dev` 启动的第一次 emit。Watch **禁止**全量删盘。保留文件名为 `adapter.projectConfigFile`。

已存在的 project config 不覆盖。自定义用 `projectConfig()`，文件名读 adapter。

Watch 维护「上次 placements」：写新文件、删取消的 dest。emit 层比较新旧字节，相同则不 touch（减少开发者工具刷新）。

压缩：script/script-module 用 SWC minify（不 mangle 属性）；style 用 Lightning；template 去注释并折叠空白、保留大小写与闭合斜杠；json 无空白。无 4.x 的 include/exclude glob。

`npmCompat`：仅当 `adapter.npmCompat === 'weapp'` 时默认插入，且排在用户 `transform` **之前**。只处理 `node_modules` 内 script。SWC 变换，禁止整文件正则。用户可显式开关。

## 12. 条件编译与子仓库

`platform` 有值时开启文件级后缀选择。块级由 `ifdef.blockcode` 控制，默认 true。

块级在 load 之后、抽依赖之前。js/ts/json/style 用 `//` 或 `/* */`，template 用 `<!-- -->`。

指令：`@ifdef` / `@ifndef` / `@if TOKEN || TOKEN` / `@endif`。

上下文 = `{ [platform]: platform, p: platform, ...ifdef.tokens }`。对齐 4.x `blockContext` 的可扩展部分；未配置 tokens 时与现稿 demo（`@ifdef wx`）一致。

子仓库见 §8 / §10.6。不再提供 `resolveOutside`。

## 13. 插件

```ts
interface PluginContext {
  adapter: TargetAdapter
  resolve(id: string, importer: string, kind: AbstractKind): Promise<string>
  emitModule(mod: { id: string; kind: AbstractKind; code: string; importer?: string }): void  // 仅 buildGraph
  addEntry(id: string): void                                                                  // 仅 buildGraph
  emitFile(file: { destPath: string; content: string | Buffer; hash?: string }): void         // extras
  addWatchFile(path: string): void
  warn(d: Diagnostic): void
  error(d: Diagnostic): void
}

interface Plugin {
  name: string
  cacheKey?(options: unknown): string
  configResolved?(config: MPBuildConfig): MPBuildConfig | void | Promise<...>
  resolveEntries?(entry: AppEntry, ctx: PluginContext): AppEntry | Promise<AppEntry>
  resolve?(id: string, ctx: { importer: string; kind: AbstractKind } & PluginContext): string | void | Promise<...>
  load?(id: string, ctx: PluginContext): string | void | Promise<...>
  extract?(mod: Module, code: string, ctx: PluginContext): Edge[] | Promise<Edge[]>
  transform?(mod: Module, code: string, ctx: PluginContext): { code: string; map?: string } | void | Promise<...>
  analyze?(graph: ModuleGraph, ctx: PluginContext): void | Promise<void>
  plan?(plan: OutputPlan, graph: ModuleGraph, ctx: PluginContext): OutputPlan | Promise<OutputPlan>
  generate?(file: { destPath: string; content: string | Buffer; moduleId?: string }, ctx: { graph: ModuleGraph; plan: OutputPlan } & PluginContext): typeof file | void | Promise<...>
}
```

调度：按 `plugins` 数组。默认插件插入规则：`npmCompat`（若启用）在用户 transform 之前。`resolve` / `load` 第一个非空胜出。`transform` / `extract` / `generate` / `resolveEntries` / `plan` 瀑布。`analyze` 禁改拓扑。

`configResolved` 可合并 `resolve.extensions`（`legacyScss()` 自己注册，不必用户手写一份）。

官方插件：

| 插件 | 默认 | 作用 |
|---|---|---|
| `npmCompat()` | adapter.npmCompat==='weapp' 时开 | weapp 运行时 hack，不是通用 npm 语义 |
| `projectConfig(opts)` | 关 | 写 `adapter.projectConfigFile` |
| `copy(patterns, opts?)` | 关 | 见下 |
| `legacyScss()` | 关 | demo 的 postcss-nested + advanced-variables；emit 用 `adapter.emitExt.style` |

`copy`：默认走 extras（`graph: false`）——进 watch、进 cache 键、clean 之后写、**不**参与归属。`graph: true` 时以 `asset` 节点入图。禁止官方插件走未文档化后门。

用户不能 `scan.addAssetByEXT`。加模块：源码引用、`resolveEntries`、或建图期 `emitModule` / `addEntry`。

## 14. Watch 与缓存

### 14.1 监听集

- 已入图 `sourcePath` 与 `extraWatchFiles`
- 每个已入图 page/component 的目录（补齐 suite：后加的 `index.wxml`）
- `src` 与 `projects[].src` 的 `add` / `unlink` / `rename`（debounce 80ms）
- `mpbuild.config.*`、`config.entry` 文件
- extras / `addWatchFile` / `copy` 源
- **不要**整树监听 `node_modules`；只盯已入图 npm 文件。新依赖通过引用方变更走增量建图

配置文件变化：从 `loadConfig` 全量，并作废全部 transform 缓存。

### 14.2 增量建图状态机

对变更/删除的模块：重新 load + ifdef + 抽边 + resolve。新 id 入队，有界并发走到闭包，节点加入图。消失的边删除。从 entries 不可达的节点标 stale，其 placement 在 emit 时删除。

然后：

```
topologyChanged = 边/节点/suite 成员/entry/分包集合 变化
planChanged     = topologyChanged
                或 dest 因碰撞 hash / 配置(output|subPackage) 变化
                或 shared 模块的使用包集合变化（第三个分包引用）
```

- `planChanged` → 重跑 analyze + plan；只 transform **内容 hash 变了或缓存未命中** 的模块；rewrite+emit placement 或 destSpecifier 变了的模块；删取消 dest。
- 否则只 transform + rewrite + emit 内容变化的模块。

`UNRESOLVED_AFTER_GRAPH` 只适用于已经越过 graph 屏障的阶段。

200ms 志向指标的场景写死：无新边的叶子 template，debounce **之后**，只 emit 该文件。

### 14.3 缓存

目录：`node_modules/.cache/mpbuild`。算法：xxhash 或 blake3。

transform 缓存键至少：

- `Module.hash`（post-load / post-ifdef 字节）
- `compile.js` / `compile.css` / `minify`
- `platform` + `ifdef.tokens`
- `@mpbuild/core` 版本、SWC / Lightning 版本
- 每个已应用插件的 `name + cacheKey(options)`（无 cacheKey 则序列化 options）

不变量：transform **不得**把 destPath / specifier / owner 编进输出。那些只属于 rewrite。缓存命中仍按 **当前** plan rewrite + emit。

磁盘缓存要有上限或内容寻址 GC。提供 `--no-cache`。`dev` 与 `build` 可共享缓存。`output.clean` 不清缓存。

## 15. CLI

`mpb5 <command>`

| 命令 | 行为 |
|---|---|
| `build` | 一次 `run()`。`--minify` 覆盖。`--no-cache` 可用。 |
| `dev` | 首次 `run()` 后 `watch()`。默认不 minify。 |
| `analyze` | 建图 + plan，写 `output.dir/mpbuild-analyze.json`。 |
| `inspect graph` | 打印 owner、边、`raw → id`。 |

`--watch` 作为 `dev` 别名。退出码：0 成功；1 含 error；2 配置错误。

## 16. 诊断

`{ code, severity, message, file?, loc? }`

| code | severity | 含义 |
|---|---|---|
| LEGACY_CONFIG | error | 只找到 mpb.config.js |
| UNKNOWN_TARGET | error | target 字符串不在内置表 |
| EMPTY_ENTRY | error | 无页面 |
| MISSING_APP_JS | error | 无 app script |
| MISSING_PAGE_JS | error | 页面缺 script |
| RESOLVE_MISS | error | 引用解析失败（external 除外） |
| RESOLVE_PLUGIN_MISS | error | 插件返回的磁盘路径不存在 |
| ABS_PATH_IN_SUBPROJECT | error | 子仓库用了 `/` |
| UNRESOLVED_AFTER_GRAPH | error | 越过 graph 屏障后出现新模块 |
| INDEPENDENT_PACKAGE_EDGE | error | 独立分包越界（weapp 默认） |
| PLUGIN_MUTATED_GRAPH | error | analyze 之后改了拓扑 |
| INVALID_PLAN | error | plan 校验失败 |
| UNSUPPORTED_PREPROCESSOR | error | 未注册的预处理器文件已入图 |
| CYCLE | warning | 循环依赖 |
| DYNAMIC_SPECIFIER | warning | 动态 require/import |
| PATH_COLLISION | warning | dest 已加 hash |
| PACKAGE_SIZE | warning | 超过 adapter 体积阈值 |

build 遇 error 失败。dev 打印后保持进程，上次成功产物保留。禁止业务代码 `process.exit`。

## 17. 测试与验收

1. **单元**：resolve（含 virtual、external、函数 alias、platform 后缀、子仓库、npm 字段序）；adapter 表驱动的四种抽取；归属四条；路径冲突。
2. **图快照**：≤8 个迷你夹具。**其中一张用假 adapter**（假后缀、假模板标签），证明抽取与 emit 后缀跟着表变，core 不读死 `wxml`。
3. **金样**：迁 `example/demo`。对比文件集合（忽略 `.map`）、分包归属、`app.json` 的 pages/subPackages、路径类字段是否相对且指向存在文件。不对比空白、注释、helper 文件名、JSON 是否内联。
4. **增量正确性**（优先于毫秒）：json 新增 usingComponents；第三个分包引用 shared；删除引用后 dest 消失；suite 目录补 template；`plugin://` 不失败。

性能：

- 「相对 4.x 冷构建快 5 倍」：README 志向。测量必须 `--no-cache` 或删 `.cache/mpbuild`，两边第二次进程（只预热 OS/Node），打印模块数 / transform 数 / 命中数。**不进 CI fail**。
- 「叶子 template 200ms」：informational；场景见 §14.2。CI 记录可不失败。

## 18. 4.x 功能对照

| 4.x | 5.0 |
|---|---|
| `mpb.config.js` + loaders | `mpbuild.config.*` |
| Tapable | §13 |
| Handle\*Dep | graph + adapter 表 |
| babel / ts-loader | SWC |
| postcss-loader | Lightning + 可选 `legacyScss()` |
| PolymorphismPlugin | `platform` + `ifdef` |
| SubProjectPlugin | `projects` |
| SubPackagesPlugin | 首发不做；预留 `resolveEntries` |
| CleanMbpPlugin | `output.clean`（仅首次 emit） |
| ProjectConfigPlugin | `projectConfig()`，文件名来自 adapter |
| Copy / CopyImage | `copy()` extras 或 `graph: true` |
| Minify + workerpool | `compile.minify`，无 glob / 无 path hash |
| TsTypeCheckPlugin | 不做，用 `tsc --noEmit` |
| inject / rename / replace | 用户 `transform` |
| `resolveJS` 跳过依赖 | 不提供 |
| JSON require 内联 | 独立 json（刻意 break） |
| 全局 usingComponents | **做**（生成 app.json 再抽字段表） |
| RouterGroup 透传 / independent | **做**（spread 组字段） |
| `blockContext` | `ifdef.tokens` |
| WatchEntry 目录 add | **做**（suite 目录监听 + 增量建图） |
| json `extends` | 首发不做 |
| AppJSONPick | 不做；用户 `generate` 或虚模块 |
| `mpb analyze` HTML | 仅 JSON |
| `new MPB().run()` | `createCompiler(config).run()` |
| JS resolve 附带 .json/.wxs | **做**（§8） |
| 平台 infix 输出名 | **对齐 4.x**（§10） |
| npm 读 `miniprogram` | 新行为，weapp adapter 字段序 |
| 独立分包边检查 | 新行为，严于 4.x |
| `.config.js` 必须有 usingComponents 才改后缀 | 修复：一律当 json |

## 19. 交付阶段

**P0 图内核**  
config Zod、weapp adapter 表、resolve（含 virtual/external）、入口扫描、表驱动抽取、BFS 建图、analyze、假 adapter 图快照、`mpb5 inspect graph`。

**P1 可构建**  
plan、SWC、Lightning、template/json、rewrite、emit 并行、`mpb5 build`。页面 suite 必须出。`plugin://` 不失败。

**P2 增量**  
§14 状态机、缓存键、chokidar、首次-only clean、差量 dest、`mpb5 dev`、增量正确性测试。

**P3 对齐金样**  
platform/ifdef、projects、`.config.js`、`npmCompat`、`legacyScss`、projectConfig、minify、全局 usingComponents、`mpb5 analyze`、金样 CI。JSON 表在本阶段挂上 `componentGenerics` 的字符串路径。

**P4 发布**  
迁移文档、根 README。`@mpbuild/core@2.0.0` / `@mpbuild/cli@2.0.0`（开发期 `2.0.0-alpha.N`）。不发布名为 `mpbuild` 的 5.0。

## 20. 风险

- 金样类 SCSS ≠ Lightning。用 `legacyScss()` 隔离。
- SWC 与 Babel 对老语法不一致。以 demo 源码为准。
- 函数 alias 难调试。`inspect graph` 必须打印 `raw → id`。
- 4.x `setAsset` 重复 push、emit 未 await、`npmRewrite` 的 `indexOf('node_modules')` 误伤：不移植。
- 公开类型一旦发 2.0.0 就是 semver 承诺。P0 就必须是抽象 kind + adapter，禁止先写死 `wxml` 再重命名。

## 21. 迁移要点

1. 安装 `@mpbuild/cli`，命令 `mpb5`。
2. 抄 `entry` / `src` / `output.path` / `alias` / minify 到新字段。`target` 默认 weapp，`platform` 仍写 `'wx'`。
3. 删除 `module.rules`。原 PostCSS 用 `legacyScss()` 或改真实 Sass。
4. 删除 PolymorphismPlugin → `platform: 'wx'`；需要额外宏 → `ifdef.tokens`。
5. 删除 SubProjectPlugin → `projects`。
6. 插件按 §13 重写；虚文件走 `virtual:` + `load`。
7. `require('./x.json')` 不再内联。
8. `plugin://` 会原样保留；不要改成相对路径。

## 22. 微信默认 adapter 与已知未做

### 22.1 内置 `weapp`（P0 实现这一张表，不实现 tt）

```ts
{
  id: 'weapp',
  ifdefToken: 'wx',
  suite: { script: 'script', json: 'json', template: 'template', style: 'style', scriptModule: 'script-module' },
  sourceExts: {
    script: ['.ts', '.js', '.tsx', '.jsx'],
    json: ['.config.js', '.json'],
    template: ['.wxml'],
    style: ['.wxss', '.css'],
    'script-module': ['.wxs'],
    asset: [],
  },
  emitExt: {
    script: '.js',
    json: '.json',
    template: '.wxml',
    style: '.wxss',
    'script-module': '.wxs',
    asset: '',
  },
  templateTags: [
    { tag: 'import', attr: 'src', edge: 'template-import' },
    { tag: 'include', attr: 'src', edge: 'template-include' },
    { tag: 'wxs', attr: 'src', edge: 'script-module' },
  ],
  jsonPathFields: [
    { path: 'usingComponents.*', edge: 'usingComponent', value: 'path' },
    // P3 挂上：
    // { path: 'componentGenerics.*.default', edge: 'usingComponent', value: 'path-or-true' }
    // { path: 'componentGenerics.*', edge: 'usingComponent', value: 'path-or-true' } // 使用侧实化
  ],
  projectConfigFile: 'project.config.json',
  appJson: { pages: 'pages', subPackages: 'subPackages' },
  npmPackageFields: ['miniprogram', 'browser', 'main', 'module'],
  sizeLimits: { mainKb: 2048, subKb: 2048, totalKb: 30720 },
  npmCompat: 'weapp',
  externalSpecifiers: /^(plugin:|https?:|data:|wxfile:|\/\/)/,
  independentEdge: 'error',
}
```

日后抖音只需另填一张表（`.ttml` / `.ttss` / `.sjs`、`<sjs src>`、`ifdefToken: 'tt'`、`npmCompat: 'none'`）。**本仓库本版本不写这张表。**

### 22.2 已知未入图 / 首发不做

| 项 | 处理 |
|---|---|
| `componentGenerics` | P3 挂字段表 |
| `componentPlaceholder` | 按组件名校验，不当路径，不入图 |
| tabBar iconPath / selectedIconPath | 不抽；可用 `copy()` |
| sitemap / theme.json | 不抽 |
| workers 目录 | 不抽 |
| WXML `<image src>` 等媒体 | 不抽 |
| `publicComponents` / plugin.json | 不抽 |
| json `extends` | 不做 |
| 指定分包编译 | 不做，用 `resolveEntries` 可后续加 |
| minify include/exclude、`minimize.path` | 不做 |
| AppJSONPick | 不做 |

这些一旦以后补，只加 adapter 表项或 extras，不改 `AbstractKind` 联合类型。
