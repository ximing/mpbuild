# mpbuild 5.0 P3 金样 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `example/demo` 能用 `mpb build` 打出可对照的产物：router 页面、子仓库、`platform: 'wx'`、ifdef、`.config.js`、npm、`project.config.json`、类 SCSS 的 wxss；金样对比文件集合与 `app.json` 的 pages/subPackages，不比空白。

**Architecture:** 在 P1/P2 流水线上补配置与 resolve/load。生成 `app.json` 来自 entry.router。官方插件 `projectConfig` / `legacyScss` / `npmCompat`。金样基线是仓库里已有的 `example/demo/dist`（4.x 产物），比较相对路径集合（忽略 `.map`）和 app.json 结构。

**Tech Stack:** 现有 v5 + postcss / postcss-scss / postcss-nested / `@yeanzhi/postcss-advanced-variables`（仅 `legacyScss`）。Node >= 20。

## Global Constraints

- 命令名是 `mpb`。
- 实现目录：`v5/packages/core`、`v5/packages/cli`。可新增 `example/demo/mpbuild.config.js` 与 `example/demo/scripts/compare-gold.mjs`。
- 公开 kind 仍是抽象 kind；后缀/标签只读 adapter。
- 图 id posix 相对 srcDir；子仓库模块 id 用 `project.name + '/' + posixRelative(project.src, abs)`（如 `@one/pages/test/index.js`）。
- TDD；每 Task 提交。禁止 Co-authored-by 与 AI 署名。`git -c trailer.ifexists=doNothing commit`。
- 测试：`eval "$(fnm env)" && fnm use 22` 后 `cd v5 && pnpm --filter @mpbuild/core test -- --run`
- 中文注释；标识符英文。不要读已删 4.x 源码。

---

## File map

```
v5/packages/core/src/config/schema.ts
v5/packages/core/src/config/load.ts
v5/packages/core/src/config/entry.ts
v5/packages/core/src/graph/entries.ts
v5/packages/core/src/resolve/resolver.ts
v5/packages/core/src/load/ifdef.ts
v5/packages/core/src/load/config-js.ts
v5/packages/core/src/plugin/project-config.ts
v5/packages/core/src/plugin/legacy-scss.ts
v5/packages/core/src/plugin/npm-compat.ts
v5/packages/core/src/analyze-json.ts
v5/packages/core/src/compiler.ts
v5/packages/cli/src/index.ts
example/demo/mpbuild.config.js
example/demo/scripts/compare-gold.mjs
```

---

### Task 1: 配置 schema 与加载 entry 文件

**Files:**
- Modify: `v5/packages/core/src/config/schema.ts`
- Modify: `v5/packages/core/src/config/load.ts`
- Create: `v5/packages/core/src/config/entry.ts`
- Modify: `v5/packages/core/src/__tests__/config.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: 现有 `loadConfig`
- Produces:

```ts
export type AliasValue = string | ((ctx: { importer: string; request: string }) => string | undefined)
export interface SubProject { name: string; src: string; alias: Record<string, string> }
export interface AppEntry {
  router?: Array<{ root: string; pages: Record<string, string>; independent?: boolean; [k: string]: unknown }>
  pages?: string[]
  subPackages?: Array<{ root: string; pages: string[]; independent?: boolean; [k: string]: unknown }>
  usingComponents?: Record<string, string>
  [k: string]: unknown
}
export async function loadAppEntry(rootDir: string, entry: string | Record<string, unknown>): Promise<AppEntry>
```

`ResolvedConfig` 增加：`projects: SubProject[]`、`platform?: string`、`ifdef: { tokens: Record<string, boolean | string>; blockcode: boolean }`、`resolve.alias: Record<string, AliasValue>`、`appEntry: AppEntry`（loadConfig 里填好）。

zod：alias 值 `z.union([z.string(), z.function()])`；projects 默认 `[]`；ifdef.blockcode 默认 true。

`entry` 为字符串：相对 rootDir 加载该 JS（`pathToFileURL` + import），取 default 或 module.exports。失败 → diagnostic 级 throw `ENTRY_LOAD`。

- [ ] **Step 1: Write the failing test**

tmpdir `mpbuild.config.js`：`export default { entry: './entry.js', src: 'src' }` 且 `entry.js` `export default { router: [{ root: '', pages: { 'pages/index/index': '/pages/index/index' } }] }`。`loadConfig` 后 `appEntry.router[0].pages['pages/index/index']` 为该字符串。函数 alias `{ '@/': ({ importer }) => importer }` 解析后仍是函数。

- [ ] **Step 2: FAIL**（appEntry 不存在）

- [ ] **Step 3: 最小实现**

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit** `feat(core): load app entry and extend config schema`

---

### Task 2: router 入口与生成 app.json

**Files:**
- Modify: `v5/packages/core/src/graph/entries.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/graph/builder.ts` / `walk.ts`（入口列表）
- Create: `v5/packages/core/src/__tests__/router-entry.test.ts`

**Interfaces:**

```ts
export function pageScriptsFromRouter(entry: AppEntry): {
  scripts: string[] // 逻辑页路径 pages/index/index（无扩展名）
  sources: string[] // router 的 value（/pages/... 或 alias）
  packages: PackageInfo[]
}
export function appJsonFromEntry(entry: AppEntry, adapter: TargetAdapter): Record<string, unknown>
```

有 `router`：忽略磁盘 `app.json` 的 pages 扫描；`packages` 来自各组 `root`；每个 value 作为页面源（Task 3 再解析 alias）。输出 app.json：`pages` = 主包组 `Object.keys(pages)`；`subPackages` = 其它组 `{ ...group, pages: Object.keys(group.pages) }`（去掉映射对象，保留 networkTimeout 等顶层键）。

compiler：`loadAppEntry` 后 `buildGraph` 的 `entryScripts` = `[app.js, ...resolved page sources]`。把生成的 app.json 写成 **虚模块** `virtual:app.json`（kind json，code = JSON.stringify(generated)），加入图并 extract 字段表（全局 usingComponents）。emit 时 dest = `dist/app.json`。

无 router 时保持 P1：从磁盘 app.json 抽 pages。

- [ ] **Step 1: 失败测试**

tmpdir：`src/app.js`、`src/pages/index/index.js`+json/wxml/wxss，无 `src/app.json`。config.entry 为 router 对象（不必走文件）。`createCompiler.run()` 后存在 `dist/app.json`，`pages` 含 `pages/index/index`，且 `dist/pages/index/index.js` 存在。

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 实现**。`virtual:` id 不 readFile；code 来自生成。`sourcePath` 可为空字符串。

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit** `feat(core): build pages from entry router`

---

### Task 3: 函数 alias 与 projects

**Files:**
- Modify: `v5/packages/core/src/resolve/resolver.ts`
- Modify: `v5/packages/core/src/graph/walk.ts` / `builder.ts`（把 config.alias 与 projects 传入）
- Modify: `v5/packages/core/src/__tests__/resolve.test.ts`
- Create: `v5/packages/core/src/__tests__/projects.test.ts`

**Interfaces:**
`ResolveRequest.alias` 改为 `Record<string, AliasValue>`。`projects?: SubProject[]`。

规则：
1. 若 importer 落在某个 `projects[].src` 下，先用该 project.alias，再用全局 alias。
2. 函数 alias：最长 key 匹配后调用 `( { importer, request } )`；返回空则跳过该 key。
3. 字符串 alias 行为不变。
4. 解析结果 abs 落在 `projects[i].src` 时，图 id = `posixJoin(project.name, posixRelative(project.src, abs))`（`@one/pages/test/index.js`）。dest 已由 id 前缀决定（plan 的 main 相对路径会带 `@one/`）。

- [ ] **Step 1: 失败测试**

`@utils` → src/utils。`require('@utils/util')` 从 `src/a.js` 解析到 `src/utils/util.js`。

函数 `@/`：importer 在 `../projects/one/pages/x.js` 时返回该 project src；`require('@/utils/b')` 命中 `projects/one/utils/b.js`。

project name `@one`：该文件入图 id 为 `@one/utils/b.js`。

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 实现**。intern 时检测 project 前缀。

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit** `feat(core): resolve function aliases and subprojects`

---

### Task 4: platform 选文件与 suite 落点

**Files:**
- Modify: `v5/packages/core/src/resolve/resolver.ts`（completeSource）
- Modify: `v5/packages/core/src/plan/plan.ts`
- Create: `v5/packages/core/src/__tests__/platform.test.ts`

**Interfaces:**
`ResolveRequest.platform?: string`。`completeSource`：每个候选先试 `name.${platform}${ext}` 再 `name${ext}`，目录则 `index.${platform}${ext}` 再 `index${ext}`。未选中的兄弟列入 `extraWatchFiles`（写在 Module 上，若 intern 已存在则 concat）。

dest：`pageType` 为 `app|page|component` 时，basename 去掉 `.${platform}` 再换 `emitExt`（`index.wx.js` → `index.js`）。其它模块保留源 basename（`a.wx.js` → `a.wx.js`）。

- [ ] **Step 1: 失败测试**

`platform: 'wx'`。`src/utils/a.js` 与 `a.wx.js` 并存；`require('./a')` 命中 `a.wx.js`。页面 `pages/user/index.wx.js` 作为 page suite script，dest 为 `dist/pages/user/index.js` 不是 `index.wx.js`。非 suite `utils/a.wx.js` dest 为 `dist/utils/a.wx.js`。

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 实现**。compiler 把 `config.platform` 传入 resolve。

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit** `feat(core): pick platform infix files and suite dest names`

---

### Task 5: ifdef 块剥离

**Files:**
- Create: `v5/packages/core/src/load/ifdef.ts`
- Modify: walk/extract 前对 code 做 ifdef（buildGraph + applyGraphChange 读文件之后）
- Create: `v5/packages/core/src/__tests__/ifdef.test.ts`

**Interfaces:**

```ts
export function applyIfdef(code: string, kind: AbstractKind, ctx: Record<string, string | boolean>): string
```

`blockcode === false` 或无 platform：原样返回。

js/ts/json/style：支持 `// @ifdef TOKEN` / `/* @ifdef TOKEN */` 与对应 `@endif`；`@ifndef`；`@if TOKEN || TOKEN`。template：`<!-- @ifdef TOKEN -->`。

ctx = `{ [platform]: true, p: platform, ...ifdef.tokens }`。platform 字符串当 token 名，值为 true。

未匹配块删除（含标记行）。

- [ ] **Step 1: 失败测试**

platform wx。源码含 wx/mt 两块。`applyIfdef` 后含 `wx platform` 不含 `mt platform`。template 同理。再跑一个 build：`index.js` dest 不含 mt 分支。

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 实现**。hash 用剥离后的字节。

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit** `feat(core): strip ifdef blocks before extract`

---

### Task 6: `.config.js` 当 json

**Files:**
- Create: `v5/packages/core/src/load/config-js.ts`
- Modify: walk 读文件：若 basename 匹配 `*.config.js` 或 kind 因 `.config.js` 被认成 json，则 `isolateLoadConfigJs(abs)` 得到对象再 `JSON.stringify`。
- Create: `v5/packages/core/src/__tests__/config-js.test.ts`

**Interfaces:**

```ts
export function loadConfigJs(absPath: string): { json: string; watchFiles: string[] }
```

用 `import()` 或 `createRequire` 加载。只允许导出纯对象，否则 diagnostic `CONFIG_JS_INVALID`。emitExt.json。dest 换 `.json`（`index.config.js` → `index.json`）。`pageType` suite 的 json 槽优先选 `index.${platform}.config.js`（由 Task 4 选文件）再 `index.config.js`。

- [ ] **Step 1: 失败测试**

`index.config.js` `module.exports = { usingComponents: { x: '/components/c/c' } }`。页面只有 js+config.js+wxml。run 后 `dist/pages/p/p.json` 含 usingComponents.x，且组件入图。

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 实现**

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit** `feat(core): load .config.js as json modules`

---

### Task 7: npm resolve 与 npm dest

**Files:**
- Modify: `v5/packages/core/src/resolve/resolver.ts`
- Modify: `v5/packages/core/src/plan/plan.ts`（id 含 `node_modules` 时 dest = `output.npm + 包内路径`）
- Create: `v5/packages/core/src/plugin/npm-compat.ts`
- Create: `v5/packages/core/src/__tests__/npm.test.ts`
- Modify: compiler 在 transform 前对 `node_modules` script 跑 npmCompat（adapter.npmCompat==='weapp'）

**Interfaces:**
bare specifier：从 importer 向上找 `node_modules/<name>`，按 `adapter.npmPackageFields` 读 package.json（weapp: miniprogram, browser, main, module）。图 id 保持 posix 相对 srcDir 或若在 src 外则 `npm/<pkg>/...` 相对包根。

plan：若 sourcePath 含 `node_modules`，dest = `posixJoin(outputDir, output.npm, posixRelative(packageRoot, sourcePath) 换 emitExt)`。

npmCompat：SWC 把 `require('fs')` 等不处理；P3 最小：对 node_modules 内 script 做一次 SWC（与 compile.js 相同 target），不整文件正则。可几乎是 transformModule。

- [ ] **Step 1: 失败测试**

tmpdir `node_modules/leftpad/package.json` `{ main: 'index.js' }` + `index.js`。`src/a.js` `require('leftpad')`。run 后 `dist/npm/leftpad/index.js` 存在，`dist/a.js` 改写指向相对 npm 路径。

- [ ] **Step 2: FAIL**

- [ ] **Step 3: 实现**。`output.npm` 从 config 传入 planGraph。

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit** `feat(core): resolve npm packages into output.npm`

---

### Task 8: 官方插件、demo 配置、金样对比、`mpb analyze`

**Files:**
- Create: `v5/packages/core/src/plugin/project-config.ts`
- Create: `v5/packages/core/src/plugin/legacy-scss.ts`
- Create: `v5/packages/core/src/analyze-json.ts`
- Modify: `v5/packages/core/package.json` + `v5/pnpm-lock.yaml`（postcss 系）
- Modify: `v5/packages/cli/src/index.ts` — `mpb analyze`
- Create: `example/demo/mpbuild.config.js`
- Create: `example/demo/scripts/compare-gold.mjs`
- Create: `v5/packages/core/src/__tests__/gold-demo.test.ts`
- Modify: `v5/packages/core/src/index.ts` 导出 `projectConfig`、`legacyScss`、`defineConfig`

**Interfaces:**

```ts
export function projectConfig(opts: { projectname: string; appId: string; setting?: Record<string, unknown> }): {
  name: string
  generate?(...): ...
}
// 若 dest 已有 adapter.projectConfigFile 则不覆盖；否则写一份 JSON（appid/projectname/setting 合并进模板最小集）

export function legacyScss(): { name: string; load?(id, ctx): string | void }
// 仅 kind===style 或 id 以 adapter.sourceExts.style 结尾。postcss + postcss-scss + postcss-nested + advanced-variables（importFilter: mixin）。失败 → diagnostic UNSUPPORTED_PREPROCESSOR

export function formatAnalyzeJson(graph: ModuleGraph, plan: OutputPlan): unknown
```

CLI `analyze`：run 但不强制（可只 buildGraph+plan），写 `join(output.dir, 'mpbuild-analyze.json')`。

`example/demo/mpbuild.config.js`（ESM 或 CJS 与 demo 一致，demo 无 "type":module 则 CJS）：

```js
const path = require('path')
const { defineConfig, projectConfig, legacyScss } = require('../../v5/packages/core/src/index.ts')
// 若 CJS 不能 require ts，改为在 gold 测试里直接构造 ResolvedConfig，config 文件用注释说明。
```

**若 CJS 无法加载 TS：** gold 测试不经过 demo 的 mpbuild.config.js，而在测试里构造 ResolvedConfig（entry 指向 example/demo/entry.js，src、alias、projects、platform:'wx'、plugins 行为在 core 内默认开启 npmCompat + 测试调用 legacyScss load 与 projectConfig generate）。另写 `example/demo/mpbuild.config.js` 为 **合法 CJS**，字段与规格同名，供以后 CLI 用 tsx 加载。

CLI 已用 tsx 加载 core，故 `mpbuild.config.js` 可用：

```js
const path = require('path')
module.exports = {
  entry: './entry.js',
  src: path.join(__dirname, 'src'),
  platform: 'wx',
  output: { dir: 'dist-v5', npm: 'npm', clean: true, componentRelative: true },
  resolve: {
    alias: {
      '@one': path.join(__dirname, '../projects/one'),
      '@two': path.join(__dirname, '../projects/two'),
      '@utils': path.join(__dirname, 'src/utils'),
      '@root': path.join(__dirname, 'src'),
      '@components': path.join(__dirname, 'src/components'),
    },
  },
  projects: [
    { name: '@one', src: path.join(__dirname, '../projects/one'), alias: { '@one': path.join(__dirname, '../projects/one') } },
    { name: '@two', src: path.join(__dirname, '../projects/two'), alias: { '@two': path.join(__dirname, '../projects/two') } },
  ],
}
```

output.dir 用 `dist-v5`，避免覆盖金样 `dist/`。

`compare-gold.mjs`：列出 `dist-v5` 与 `dist` 的相对路径（忽略 `.map`、忽略 `mpbuild-analyze.json`）。断言金样中下列前缀在新产物中都存在：`app.js` `app.json` `pages/` `components/` `utils/` `wxs/` `subpkg1/` `@one/` `@two/` `project.config.json`。npm 只要求 `npm/querystring` 与 `npm/util` 存在（不要求 babel-runtime 树一致）。读两边 `app.json` 的 `pages` 与 `subPackages` 深等。

gold-demo.test.ts：`createCompiler` 跑 demo（rootDir = example/demo 的绝对路径），timeout 30s。若 RESOLVE_MISS 导致失败，测试失败（这就是 P3 验收）。

componentGenerics：weappAdapter.jsonPathFields 增加 `{ path: 'componentGenerics.*', edge: EdgeKinds.usingComponent, value: 'name-or-path' }`，仅字符串叶子当路径。

- [ ] **Step 1: 先写 compare 与 gold 测试（预期 FAIL 或缺文件）**

- [ ] **Step 2: 实现插件 + demo config + analyze CLI + adapter 字段**

- [ ] **Step 3: 跑 gold 直到 pages/subPackages 与关键前缀通过。** 不要为了绿而放宽到空断言。

- [ ] **Step 4: 全 core 测试绿**

- [ ] **Step 5: Commit** `feat: align example demo gold sample`

---

## Self-review

- 规格 P3：platform/ifdef、projects、`.config.js`、npmCompat、legacyScss、projectConfig、全局 usingComponents（router 生成 app.json 再抽字段）、金样 CI、componentGenerics、`mpb analyze` 均有 Task。
- minify：demo 全 false；默认已是 false。不单列 Task（YAGNI）。
- 函数 alias `@/` 在 Task 3；demo 配置 Task 8 可先不写函数 alias，字符串 alias 足够解析 `@one`/`@two`。`@/` 仍要有单元测试。
- 不做：copy() extras 全量、磁盘缓存、金样字节级一致。
