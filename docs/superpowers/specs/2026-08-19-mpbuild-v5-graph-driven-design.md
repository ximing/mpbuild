# mpbuild 5.0 图驱动架构设计

日期：2026-08-19  
状态：待用户审阅  
范围：主版本重写（方案 C）。4.x 冻结，不续写 `next/`。

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
- JS/TS 用 SWC，CSS 用 Lightning CSS。依赖从源码 AST 抽取，不再扫描编译后代码。
- Watch 按内容 hash 失效子图；归属变化时重跑 analyze + plan。
- 4.x 继续可发布；5.0 新包并行。

### 2.2 非目标

- 不兼容旧 loader 链和旧钩子。
- 不把小程序打成少量 JS bundle（页面/组件必须保持独立文件）。
- 不在本版本做支付宝/百度等平台的完整适配（`platform` 字符串预留，默认只做微信 + 条件编译）。
- 不做 HMR 运行时（小程序开发者工具自己刷新；本版本只做增量重编译）。
- 不实现 `next/` 文档里的五层 application/service/foundation。
- 不把 Babel / PostCSS 做成默认引擎。需要时用可选 `transform` 插件，本设计不交付该插件。
- 不在 5.0 首发时接管 `mpb` 二进制名（避免误伤 4.x 用户）。

## 3. 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 迭代策略 | 方案 C：主版本重写 | 用户确认；A/B 会把旧耦合做成长期包袱 |
| 兼容策略 | 只保证产物语义 | 旧 API 与图驱动模型冲突 |
| 代码位置 | 新建 `v5/`，冻结 4.x，不改 `next/` | `next/` 不可用且文档污染判断 |
| CLI 名 | 开发期 `mpb5`，稳定后再考虑抢 `mpb` | 与 4.x 并存 |
| 包名 | `@mpbuild/core`、`@mpbuild/cli` | 与 npm 上的 `mpbuild@4` 分离 |
| 图与编译 | 分阶段，禁止 emit 时发现新模块 | 这是整次重写的中心约束 |
| JS 工具 | SWC 解析 + 变换 + minify | 一次 AST；minify 成熟 |
| CSS 工具 | Lightning CSS；Sass/Less 为可选预处理插件 | 替换 PostCSS 7 |
| 插件模型 | `resolve/load/transform/analyze/plan/generate` | Vite 风格，对应阶段，不能 `addAsset` |
| 分包共享 | 默认 `duplicate` | 对齐 4.x 文档与 demo 行为 |
| 模块格式 | 默认 CommonJS，target 默认 `es2018` | 微信运行时主流；可配置 |
| 入口 | 保留 `entry.js` 的 `router` 形态 | 这是产物语义，不是旧插件 API |
| 金样 | 从 `example/demo` 迁到 `v5/packages/example` | 对比文件集合、归属、引用路径，不对比字节 |

## 4. 仓库布局

```
v5/
  package.json                 # name: mpbuild-v5, private, pnpm workspace
  pnpm-workspace.yaml          # packages/*
  tsconfig.json
  packages/
    core/                      # @mpbuild/core
    cli/                       # @mpbuild/cli，bin: mpb5
    example/                   # 金样，从 example/demo + example/projects 迁入
```

根目录 `pnpm-workspace.yaml` 增加 `v5/packages/*`。`packages/mpbuild` 与 `packages/cli`（4.x）不改行为。`next/` 本设计不删除，但禁止作为依赖或拷贝源。

`@mpbuild/core` 源码只允许这四块业务目录加编排与类型：

```
v5/packages/core/src/
  index.ts                     # 对外：createCompiler / defineConfig / 类型
  config/                      # 加载、Zod 校验、默认值
  resolve/                     # 路径解析
  graph/                       # 扫描、抽依赖、ModuleGraph、analyze
  plan/                        # OutputPlan
  compile/                     # SWC / Lightning CSS / WXML / JSON / emit
  watch/                       # 文件监听与子图失效
  plugin/                      # 钩子调度
  diagnostic/                  # 统一诊断
  types.ts
```

禁止再拆 application / service / foundation / output 等空壳层。

`@mpbuild/cli` 只做参数解析、调 core、打印诊断。不含图或编译逻辑。

## 5. 流水线

编排器 `Compiler.run()` / `Compiler.watch()` 按固定阶段执行。阶段之间只传递不可变快照（graph、plan、diagnostics）。插件挂阶段，不能插入新阶段，不能从 `generate` 回调回 `graph`。

```
loadConfig
  → resolveEntries
    → buildGraph          # 含 load + 四种依赖抽取 + resolve
      → analyze           # 循环依赖、包归属
        → plan            # 落点、复制份数、rewrite 表
          → transform     # 按模块类型编译，不再解析新依赖
            → rewrite     # 按 plan 改 specifier
              → generate  # 插件最后改写输出
                → emit
```

约束：

1. `transform` 及之后若发现未入图的模块引用，报 `UNRESOLVED_AFTER_GRAPH`，不补边、不补写。
2. 一个源模块可以对应 plan 里的多条 placement（复制到多个分包）。transform 对每个源模块只做一次，emit 按 placement 写多份并分别 rewrite。
3. Watch 命中后：按 dependents 闭包失效节点；若失效节点的 `owner` 可能变化（新增/删除跨包边），从 `analyze` 重跑；否则从 `transform` 重跑失效闭包。

## 6. 核心数据模型

```ts
type ModuleKind = 'js' | 'json' | 'wxml' | 'wxss' | 'wxs' | 'asset'
type EdgeKind =
  | 'import' | 'require' | 'dynamic-import'
  | 'usingComponent'
  | 'wxml-import' | 'wxml-include' | 'wxs'
  | 'wxss-import'
  | 'page-suite' | 'component-suite'  // 四件套展开，不是源码里的引用

interface Module {
  id: string                 // 解析后的绝对路径，平台变体选定之后
  kind: ModuleKind
  sourcePath: string
  pageType?: 'app' | 'page' | 'component'
  owner: 'main' | string     // string 为分包 root，analyze 之后才有最终值
  hash: string               // 源码内容 hash（load 之后、transform 之前）
}

interface Edge {
  from: string
  to: string
  kind: EdgeKind
  raw: string                // 源码里的原始 specifier
  loc?: { line: number; column: number }
}

interface ModuleGraph {
  entries: string[]          // app + 每个 page 的 js id
  nodes: Map<string, Module>
  edges: Edge[]
  packages: PackageInfo[]    // main + subpackages，来自 entry
}

interface Placement {
  moduleId: string
  destPath: string           // 绝对输出路径
  package: 'main' | string
}

interface Rewrite {
  from: string               // 引用方 moduleId
  raw: string
  destSpecifier: string      // 写出后的相对路径，以 ./ 或 ../ 开头
  placementPackage: 'main' | string
}

interface OutputPlan {
  placements: Placement[]
  rewrites: Rewrite[]
}
```

`page-suite` / `component-suite` 边：页面或组件的 js 节点指向其 json/wxml/wxss/wxs（若存在）。这样归属和失效沿四件套传播。

## 7. 配置

只加载项目根下第一个存在的文件，顺序：

1. `mpbuild.config.ts`
2. `mpbuild.config.mts`
3. `mpbuild.config.js`（ESM 或 CJS 均可，必须 `export default` 或 `module.exports`）

不读取 `mpb.config.js`。发现仅有 `mpb.config.js` 时，诊断 `LEGACY_CONFIG`，退出码 2，并提示迁移文档路径。

```ts
export interface MPBuildConfig {
  src: string
  entry: string | AppEntry
  output: {
    dir: string
    npm: string
    clean: boolean
    componentRelative: boolean
  }
  resolve: {
    alias: Record<string, string | AliasFn>
    extensions: {
      js: string[]
      json: string[]
      wxml: string[]
      wxss: string[]
      wxs: string[]
    }
  }
  compile: {
    js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
    css: { lightningcss: boolean }
    minify: boolean | { js?: boolean; wxml?: boolean; json?: boolean; wxss?: boolean }
  }
  subPackage: {
    shared: 'duplicate' | 'main'
    mainMaxKb?: number
    subMaxKb?: number
  }
  platform?: string
  projects?: SubProject[]
  plugins?: Plugin[]
}

type AliasFn = (ctx: { importer: string; request: string }) => string | undefined

interface SubProject {
  name: string               // 输出命名空间，如 @one
  src: string
  alias: Record<string, string>
}

interface AppEntry {
  router?: RouterGroup[]
  pages?: string[]
  subPackages?: { root: string; name?: string; pages: string[]; independent?: boolean }[]
  [extra: string]: unknown   // 透传到输出 app.json（去掉 router）
}

interface RouterGroup {
  root: string               // 主包为 ''
  pages: Record<string, string>  // 路由路径 → 源路径（可含 alias）
}
```

默认值：

```ts
{
  src: 'src',
  output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
  resolve: {
    alias: {},
    extensions: {
      js: ['.ts', '.js', '.tsx', '.jsx'],
      json: ['.config.js', '.json'],
      wxml: ['.wxml'],
      wxss: ['.wxss', '.css'],
      wxs: ['.wxs'],
    },
  },
  compile: {
    js: { target: 'es2018', module: 'commonjs' },
    css: { lightningcss: true },
    minify: false,
  },
  subPackage: { shared: 'duplicate' },
}
```

`defineConfig(config)` 只做类型导出，运行时原样返回。

`entry` 为字符串时：按路径加载该文件，取其 default / module.exports 作为 `AppEntry`。

`AppEntry` 规范化：

- 有 `router`：只按 `router` 扫页面。同文件的 `pages` / `subPackages` 不参与扫描，也不写入输出（输出的 pages/subPackages 由 router 生成）。
- 无 `router` 且有 `pages`：生成主包组 `root: ''`，`pages[p] = '/' + p`。
- 无 `router` 且有 `subPackages`：每项生成一组，页面源路径为 `'/' + join(root, page)`。可与上一条同时成立。
- `router`、`pages`、`subPackages` 都没有：诊断 `EMPTY_ENTRY`。

输出 `app.json`：`router` 转回微信字段 `pages` + `subPackages`，其余未知键原样写出。`beforeOutputAppJSON` 不存在，要改 app.json 用 `generate` 钩子匹配 `app.json`。

## 8. 解析（resolve）

解析顺序，命中即停：

1. 插件 `resolve` 钩子返回的绝对路径（必须存在，否则 `RESOLVE_PLUGIN_MISS`）。
2. `alias`：最长前缀匹配。值为函数则调用；返回空则跳过该 alias。
3. `request` 以 `.` 开头：相对 `importer` 目录。
4. `request` 以 `/` 开头：相对 `src`。子仓库内的 `/` 引用诊断 `ABS_PATH_IN_SUBPROJECT`（对齐 4.x SubProjectPlugin）。
5. 否则当 npm 包：从 `importer` 目录向上 `node_modules`，用 package.json 的 `miniprogram` / `browser` / `main` / `module` 字段，顺序固定为这一次序。

扩展名补全：按当前 `resolveType` 对应的 `extensions` 列表，先试原名，再试名 + ext，再试 `name/index` + ext。

`platform` 非空时，每个候选在同一位置先试 `*.${platform}${ext}`，再试不带平台后缀的文件。只选一个文件进入图。

子仓库：`request` 或解析结果落在某个 `projects[].src` 下时，后续 alias 先用该 project 的 `alias`，再用全局 `alias`。

## 9. 建图（graph）

### 9.1 入口扫描

1. 解析 app 四件套：在 `src` 下找 `app` + `extensions.js/json/wxml/wxss`。缺 js 则 `MISSING_APP_JS`。
2. 对每个 router 页面：解析页面源路径，展开四件套。缺 js 则 `MISSING_PAGE_JS`。json 缺省不报错。
3. 页面 json / 组件 json 的 `usingComponents` 再展开目标四件套（`component-suite`）。

`.config.js`：当作 json 模块。`load` 阶段执行该文件（隔离 `require`，只允许导出纯对象），得到对象后当 JSON 继续抽 `usingComponents`。输出扩展名改为 `.json`。

### 9.2 依赖抽取

全部从 **load 之后、transform 之前** 的源码抽取。

| 类型 | 抽取方式 | 边 |
|---|---|---|
| js / ts / jsx / tsx | SWC parse，遍历 `ImportDeclaration`、`export from`、`require('…')` 字符串字面量、`import('…')` 字符串字面量 | import / require / dynamic-import |
| wxs | 同上，仅字符串字面量 require/import | require / import |
| json / config.js | 解析对象的 `usingComponents` 值 | usingComponent |
| wxml | 解析标签 `import` / `include` / `wxs` 的 `src` | wxml-import / wxml-include / wxs |
| wxss / css / scss / less | 解析 `@import`，忽略 `url()` 里的字体图片（那些走 asset，仅当值为相对/alias 路径时入图） | wxss-import |
| 图片等 asset | 不抽依赖 | — |

JS 抽取规则：

- 只处理静态字符串。`require(foo)`、`import(foo)` 忽略，打 `DYNAMIC_SPECIFIER` 警告，不失败。
- `import type` / `import type { }` 不入图。
- `require('./x.json')` 入图；plan 阶段默认 **不内联**。4.x 会把 JSON 内联进 JS。5.0 改为输出独立 `.json` 并把 specifier 改成相对 json 路径（微信运行时支持）。金样对比时允许这一处语义差，在迁移文档写明。
- 注释和字符串里的假 import 不会被 SWC AST 收进来。

WXML 解析：用能保留文本节点和属性顺序的解析器。只改 `import`/`include`/`wxs` 的 `src`，其余原样写出。禁止 4.x 那种整树序列化（会改变自闭合和空白）。

WXSS：默认按 CSS/`@import` 抽取，不跑 Sass/Less。`.scss` / `.less` 只有在对应插件把扩展名注册进 `resolve.extensions.wxss` 后才会入图，否则解析阶段当作找不到。

4.x demo 的样式是 **`.wxss` 文件 + PostCSS（scss parser / nested / advanced-variables）**，不是 `.scss` 扩展名。官方 `legacyScss()` 挂在 `load`：对 `.wxss` 做同等预处理，再交给抽取和 Lightning CSS。该插件不进 core 默认，金样配置显式打开。

### 9.3 analyze

- 有向环：按边报告 `CYCLE`，列出环上 id。默认当警告，不失败。`independent` 分包与主包之间出现边则升级为错误 `INDEPENDENT_PACKAGE_EDGE`。
- 归属：
  1. 模块被主包入口（`root === ''` 的页面闭包，含 app）触及 → `owner = 'main'`。
  2. 否则只被一个分包闭包触及 → `owner = 该分包 root`。
  3. 否则被多个分包触及、主包未触及 → `owner` 记为 `'shared'`，plan 再按策略展开。
- 闭包沿所有边走，含 suite 边。

## 10. Output Plan

对每个模块计算 placements：

1. `owner === 'main'` → 一份，写到 `output.dir` 下相对 `src` 的路径（扩展名按类型改写：ts/tsx/jsx → js，scss/less/css → wxss，config.js → json）。
2. `owner === 某分包` → 一份，写到 `output.dir / 分包root /` 下。源文件已在该分包目录内则保持相对结构；源在 `src` 其它位置或子仓库，则按第 4 条。
3. `owner === 'shared'` 且 `subPackage.shared === 'duplicate'` → 每个使用它的分包一份。
4. `owner === 'shared'` 且 `subPackage.shared === 'main'` → 一份进主包。
5. npm 模块的相对路径为 `output.npm + 包内路径`（去掉 `node_modules` 前缀），再套用 1–4。
6. 子仓库模块：相对路径为 `project.name + 相对 project.src 的路径`（对齐 demo 的 `@one/...`、`@two/...`）。

扩展名改写后若两个源模块落到同一 `destPath`，用「多保留一级源目录」消解；仍冲突则 dest 文件名加 8 位内容 hash 后缀，并警告 `PATH_COLLISION`。

`output.componentRelative === true` 时，json 里 `usingComponents` 的 rewrite 必须是相对该 json 输出目录的路径，且以 `./` 或 `../` 开头。

JS/WXML/WXSS 的 specifier rewrite 同样相对 **当前 placement 的 dest 目录**。复制到多个分包时，同一源模块的不同 placement 可以有不同 destSpecifier。

体积：`mainMaxKb` / `subMaxKb` 按 placement 源文件字节估算（transform 前）。超过报警告 `PACKAGE_SIZE`，默认不失败。

## 11. 编译与写出

| 类型 | 实现 | 输出 |
|---|---|---|
| js/ts/jsx/tsx | SWC，`jsc.target` 来自配置，`module.type` 来自配置 | `.js`，可选 `.js.map` |
| wxs | SWC parse + 可选 minify，不降 target 到会破坏 wxs 语法的级别；不转 JSX | `.wxs` |
| wxss/css | Lightning CSS；输入已是 CSS | `.wxss` |
| scss/less | 仅当插件已注册扩展名；未注册则进不了图。已入图却无 transform 时 `UNSUPPORTED_PREPROCESSOR` | `.wxss` |
| wxml | 专用解析，rewrite src 后写出 | `.wxml` |
| json | `JSON.stringify`，minify 时去掉空白 | `.json` |
| asset | 原样拷贝 | 原扩展名 |

Source map：`compile.js` 在 `minify === false` 时默认生成独立 `.map` 并在 js 末尾加 `//# sourceMappingURL=`。`minify` 为真时不生成。

`output.clean === true` 时，emit 前删除 `output.dir` 下除 `project.config.json` 以外的文件。这是 4.x CleanMbpPlugin 常用默认的内置化。

内置 `project.config.json`：若不存在则写入 `{ description, packOptions, setting: { minified: compile.minify !== false }, appid: '', projectname: '' }`。已存在则不覆盖。需要自定义时用官方 `projectConfig({ appId, projectname, setting })` 插件走 `generate`。

压缩：

- js / wxs：SWC minify，不mangle 对象属性。
- wxss：Lightning CSS minify。
- wxml：去注释、折叠空白、保留大小写和闭合斜杠。
- json：无空白 stringify。

4.x 的 `instanceof Function` / `process.env` / `Function('return this')` npm 修补：做成官方插件 `npmCompat()`，默认 **启用**（对齐 demo 能跑微信环境）。实现改为 SWC 变换，禁止对整文件正则替换 `instanceof Function`。作用范围仅 `node_modules` 内模块。

## 12. 条件编译与子仓库

`platform` 有值时内置开启，不再需要 PolymorphismPlugin。

文件级：见第 8 节扩展名选择。

块级：在 `load` 之后、抽依赖之前，对 js/ts/wxs/wxss/scss/less/json/config.js 用 `//` 或 `/* */` 注释，对 wxml 用 `<!-- -->`，处理：

- `@ifdef TOKEN` / `@ifndef TOKEN` / `@if TOKEN || TOKEN` / `@endif`
- `TOKEN` 为 `platform` 值。上下文只有 `{ [platform]: platform, p: platform }`。
- 使用 `preprocess` 的语义对齐 4.x，但实现可以自写小扫描器，避免引入过期包。行为必须以 4.x 金样注释块为准。

子仓库：见第 8 节。输出命名空间见第 10 节第 6 条。不再提供 `resolveOutside` / `rewriteOutsideOutputPath`。

## 13. 插件

```ts
interface Plugin {
  name: string
  resolve?(id: string, ctx: { importer: string; kind: ModuleKind }): string | void | Promise<string | void>
  load?(id: string): string | void | Promise<string | void>
  transform?(mod: Module, code: string): { code: string; map?: string } | void | Promise<...>
  analyze?(graph: ModuleGraph): void | Promise<void>
  plan?(plan: OutputPlan, graph: ModuleGraph): OutputPlan | Promise<OutputPlan>
  generate?(file: { destPath: string; content: string | Buffer; moduleId?: string }): typeof file | void | Promise<...>
}
```

调度：同名钩子按 `plugins` 数组顺序。`resolve` / `load` 第一个返回非空的胜出。`transform` / `generate` 瀑布。`plan` 瀑布，后一个拿到前一个返回值。`analyze` 可改 graph 的 metadata，但 **禁止增删节点和边**（违规则 `PLUGIN_MUTATED_GRAPH`）。

官方插件（与 core 同仓，可从 `@mpbuild/core/plugins` 导出）：

| 插件 | 默认 | 作用 |
|---|---|---|
| `npmCompat()` | 开 | node_modules JS 运行时修补 |
| `projectConfig(opts)` | 关 | 写 project.config.json |
| `copy(patterns)` | 关 | 额外拷贝，不进图 |
| `legacyScss()` | 关 | 覆盖 demo 的 postcss-nested + advanced-variables |

多态和子仓库是配置，不是插件。

用户不能再调用 `scan.addAssetByEXT`。要加模块：在源码或 entry 里出现引用，或在 `resolveEntries` 之后通过配置 `entry` 增加页面。

## 14. Watch 与缓存

Watch 用 chokidar，`usePolling` 默认 false。监听已入图的 `sourcePath` 加上 `entry` 配置文件。entry 文件变化：全量从 `resolveEntries` 重跑。

缓存目录：`node_modules/.cache/mpbuild`。键 = `hash(source + 序列化后影响该模块的配置子集 + swc/lightningcss 版本 + 插件名列表)`。命中则跳过 transform，仍要按当前 plan rewrite 后 emit。

缓存不跨 `output.dir` 清理。`output.clean` 只清产物，不清缓存。

## 15. CLI

`mpb5 <command>`

| 命令 | 行为 |
|---|---|
| `build` | `mode=production` 的一次 `run()`。`--minify` 覆盖配置。 |
| `dev` | `run()` 后 `watch()`。`--minify` 默认关。 |
| `analyze` | 建图 + plan，写 `output.dir/mpbuild-analyze.json`（节点、边、owner、placements）。 |
| `inspect graph` | 打印每个模块的 owner、入边出边。 |

不实现 4.x 的 `mpb -w` 短选项作为稳定 API。可接受 `--watch` 作为 `dev` 别名。

退出码：0 成功；1 诊断含 error；2 配置错误。

## 16. 诊断

统一结构：`{ code, severity: 'error' | 'warning', message, file?, loc? }`。

| code | severity | 含义 |
|---|---|---|
| LEGACY_CONFIG | error | 只找到 mpb.config.js |
| EMPTY_ENTRY | error | 无页面 |
| MISSING_APP_JS | error | 无 app.js/ts |
| MISSING_PAGE_JS | error | 页面缺 js |
| RESOLVE_MISS | error | 引用解析失败 |
| RESOLVE_PLUGIN_MISS | error | 插件返回的路径不存在 |
| ABS_PATH_IN_SUBPROJECT | error | 子仓库用了 `/` 绝对引用 |
| UNRESOLVED_AFTER_GRAPH | error | transform 后出现新模块 |
| INDEPENDENT_PACKAGE_EDGE | error | 独立分包越界依赖 |
| PLUGIN_MUTATED_GRAPH | error | analyze 插件改了拓扑 |
| UNSUPPORTED_PREPROCESSOR | error | 未装预处理插件却用了 scss/less |
| CYCLE | warning | 循环依赖 |
| DYNAMIC_SPECIFIER | warning | 动态 require/import |
| PATH_COLLISION | warning | 输出路径冲突已加 hash |
| PACKAGE_SIZE | warning | 超过体积阈值 |

build 遇到任何 error 失败。dev 打印后保持进程，上次成功产物保留。

禁止在业务代码里 `process.exit`。只有 CLI 根据诊断设退出码。

## 17. 测试与验收

三层，全部放在 `v5/packages/core` 的 vitest 里，金样脚本放 `v5/packages/example`。

1. **单元**：resolve（相对/绝对/alias/函数 alias/npm/平台后缀/子仓库）；四种抽取；plan 归属四条规则；路径冲突。
2. **图快照**：`core/src/__fixtures__` 下 8 个以内的迷你项目，断言 graph + plan 的 JSON（id 用相对路径）。
3. **金样**：把 `example/demo` 与 `example/projects` 迁到 `v5/packages/example`。用新配置表达与 `mpb.config.js` 同等语义。`mpb5 build` 后对比：
   - 输出文件集合（忽略 `.map`）
   - 每个 js/json/wxml/wxss 的分包归属（路径前缀）
   - `app.json` 的 `pages` / `subPackages`
   - json `usingComponents` 与源码 specifier 是否都是相对路径且指向存在的文件
   - 不对比空白、注释、Babel helper 文件名、是否内联 JSON

4.x 的 `example/demo/dist` 只作人工对照，不进 CI 字节比较。

成功标准：

- 金样 CI 通过。
- 冷构建相对 4.x 同机跑 demo 至少快 5 倍（写在 example README 的测量命令：两次 warm-less，取第二次 wall time）。
- 改金样里一个叶子 wxml，`dev` 增量低于 200ms（同机，CI 记录但不设失败阈值，避免 runner 抖动）。

## 18. 4.x 功能对照

| 4.x | 5.0 |
|---|---|
| `mpb.config.js` + loaders | `mpbuild.config.*`，无 loader |
| Tapable 钩子 | 第 13 节插件 |
| Handle\*Dep | graph 阶段 |
| babel-loader / ts-loader | SWC |
| postcss-loader | Lightning CSS + 可选 `legacyScss()` |
| PolymorphismPlugin | `platform` |
| SubProjectPlugin | `projects` |
| SubPackagesPlugin（指定分包编译） | 首发不做。需要时后续加 `entry` 过滤，不进 P0–P3 |
| CleanMbpPlugin | `output.clean` |
| ProjectConfigPlugin | `projectConfig()` |
| CopyPlugin / CopyImagePlugin | `copy()` |
| MinifyPlugin + workerpool | `compile.minify`，进程内 SWC/Lightning |
| TsTypeCheckPlugin | 首发不做，用 `tsc --noEmit` |
| inject / rename / replace loader | 用户自己写 `transform` |
| `resolveJS` 返回 null 跳过依赖 | 不提供；外部包用 resolve 标 external 的设计删除——小程序必须打进产物 |
| JSON require 内联 | 独立 json 文件（刻意 break） |
| `mpb analyze` / mp-analyzer 图 | `mpb5 analyze` JSON；HTML 图首发不做 |
| 编程式 `new MPB(config).run()` | `createCompiler(config).run()` |

## 19. 交付阶段

实施计划按阶段拆，每阶段可独立验收。本文件是总规格，不在此写逐步测试代码。

**P0 图内核（无写盘）**  
config Zod、resolve、入口扫描、四种抽取、ModuleGraph、analyze 归属、图快照测试。CLI：`mpb5 inspect graph` 打到 stdout。

**P1 可构建**  
plan、SWC、Lightning CSS、WXML/JSON、rewrite、emit、`mpb5 build`。金样主路径（可暂不含 legacyScss / npmCompat 的完整 npm 树，但页面四件套必须出）。

**P2 增量**  
hash 缓存、chokidar、子图失效、`mpb5 dev`。

**P3 对齐金样**  
platform 条件编译、projects、`.config.js`、`npmCompat`、`legacyScss`、clean、projectConfig、minify、`mpb5 analyze`、金样 CI。

**P4 发布**  
迁移文档（旧字段/旧插件对照）、更新根 README 指向 v5。npm 发布 `@mpbuild/core@2.0.0` 与 `@mpbuild/cli@2.0.0`（开发期可用 `2.0.0-alpha.N`）。不发布名为 `mpbuild` 的 5.0，避免和 4.x 抢包名。版本从 2 起，刻意避开 `next/` 废案自称的 `2.0.0-alpha.1` 目录，npm 上这两个 scoped 包名当前不存在，不冲突。

## 20. 风险

- 金样依赖 PostCSS 插件链的类 SCSS，和 Lightning CSS 不等价。用 `legacyScss()` 隔离，避免 core 绑死 PostCSS。
- SWC 对超老语法/装饰器与 Babel 不一致。金样以 demo 源码为准；demo 没有装饰器。
- 函数 alias 的调试体验差。`inspect graph` 必须打印 `raw → id`。
- 4.x `setAsset` 重复 push、emit 未 await 等 bug 不移植。

## 21. 迁移要点（给 4.x 用户）

1. 新装 `@mpbuild/cli`，命令改 `mpb5`。
2. 把 `entry` / `src` / `output.path` / `alias` / `optimization.minimize` 抄到新配置对应字段。
3. 删除 `module.rules`。TS/JS 无需配置。原 PostCSS 插件逐个评估：嵌套与变量用 `legacyScss()` 或改真实 Sass。
4. 删除 `new PolymorphismPlugin`，写 `platform: 'wx'`。
5. 删除 `new SubProjectPlugin`，写 `projects`。
6. 自定义插件按第 13 节重写。
7. `require('./x.json')` 不再内联，确认运行时加载路径被 rewrite。
)