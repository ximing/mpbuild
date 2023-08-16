# mpbuild 5.0 P1 可构建 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 产品命令就是 `mpb`；删掉无用的 4.x 包；在 `v5/` 落地 `mpb build`：页面四件套写出，`plugin://` 原样保留且不失败。

**Architecture:** 在 P0 图内核上补 suite 展开、src 相对 id、`planGraph`、按 kind 的 transform、按 placement 的 rewrite/emit。`createCompiler(config).run()` 串起流水线。CLI 只调 core。不实现 watch、platform/ifdef、projects、npmCompat、minify、金样 CI（P2/P3）。

**Tech Stack:** TypeScript 5、Node >= 20、pnpm、vitest、zod、@swc/core、lightningcss。不读不拷已删除的 4.x / `next/`。

## Global Constraints

- 命令名是 `mpb`，禁止再引入 `mpb5`。
- 实现目录：`v5/packages/core`、`v5/packages/cli`。Task 1 可改根 workspace / 删 `packages/mpbuild` `packages/cli` `packages/website`。
- **保留** `example/demo` 与 `example/projects`（P3 金样）。
- 公开 kind 必须是 `script | json | template | style | script-module | asset`。抽取 / suite / emit 后缀 / 模板标签 / JSON 字段只读 adapter。
- 建图：全局 visited（最终 id）、队列 BFS、环边入图。禁止 async DFS 递归。
- 图 id 用 posix、相对 `srcDir`（`pages/index/index.js`）。`sourcePath` 为磁盘绝对路径。`resolveId` 的 `importer` 必须传 `sourcePath`。
- TDD：先写失败测试并跑红，再写最少实现。报告必须含 RED/GREEN 命令与输出摘要。
- 提交：每 Task 至少一次。禁止 `Co-authored-by`，禁止 AI/Grok/Claude/Cursor/Generated/assistant。`git -c trailer.ifexists=doNothing commit`，不要 `--trailer`。
- 测试：`eval "$(fnm env)" && fnm use 22` 后 `cd v5 && pnpm --filter @mpbuild/core test -- --run`
- 中文注释；标识符英文。
- 不要读或复制已删除的 `packages/mpbuild/**` 或任何 `next/**`。

---

## File map

```
v5/packages/cli/bin/mpb.js          # 原 mpb5.js 改名
v5/packages/cli/package.json        # bin.mpb
v5/packages/cli/src/index.ts        # inspect + build
v5/packages/core/src/graph/builder.ts
v5/packages/core/src/graph/suite.ts
v5/packages/core/src/graph/entries.ts
v5/packages/core/src/plan/plan.ts
v5/packages/core/src/compile/transform.ts
v5/packages/core/src/compile/rewrite.ts
v5/packages/core/src/compile/emit.ts
v5/packages/core/src/compiler.ts
v5/packages/core/src/__tests__/suite.test.ts
v5/packages/core/src/__tests__/plan.test.ts
v5/packages/core/src/__tests__/transform.test.ts
v5/packages/core/src/__tests__/rewrite.test.ts
v5/packages/core/src/__tests__/build.test.ts
```

---

### Task 1: `mpb` 接管并删除 4.x 包

**Files:**
- Delete: `packages/mpbuild/`（整树）
- Delete: `packages/cli/`（4.x `mpbuild-cli`，整树）
- Delete: `packages/website/`（4.x 文档站，整树）
- Rename: `v5/packages/cli/bin/mpb5.js` → `v5/packages/cli/bin/mpb.js`（内容仍是 tsx register + `run()`）
- Modify: `v5/packages/cli/package.json` — `"bin": { "mpb": "./bin/mpb.js" }`，去掉 `mpb5`
- Modify: `v5/packages/cli/src/index.ts` — usage 字符串改成 `usage: mpb inspect graph`
- Modify: `pnpm-workspace.yaml` — 去掉 `'packages/*'`，保留 `'example/*'` 与 `'v5/packages/*'`
- Modify: 根 `package.json` — 删除 `build:website` script（可选留下其它 script）
- Modify: `example/demo/package.json` — 去掉对 workspace `mpbuild` / `mpbuild-cli` 的依赖（P3 再接 `@mpbuild/cli`）。不要改 demo 源码。
- Modify: `docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md` — 所有 `mpb5` 改成 `mpb`；§3 CLI 行改为「`mpb`；`@mpbuild/core` `@mpbuild/cli@2.0.0`」；§4「4.x 包不改行为」改为「4.x 包已删除，实现只在 `v5/`」；删「不在 5.0 首发时接管 `mpb`」；§2.1「4.x 继续可发布」改为「4.x 源码已移出仓库」。
- Modify: `docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md` — `mpb5` → `mpb`；编排规则分支改为 `feat/v5-p1-build`。

**Interfaces:**
- Consumes: 现有 P0 CLI
- Produces: 仓库内只有一个 `mpb` 二进制（`v5/packages/cli/bin/mpb.js`）；4.x 包不存在

- [ ] **Step 1: Write the failing test**

`v5/packages/cli` 暂无 vitest。在 `v5/packages/core/src/__tests__/package.test.ts` **追加**（不要删 version 测试）：

```ts
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

it('exposes mpb bin and not mpb5', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const cli = join(here, '../../../../cli')
  expect(existsSync(join(cli, 'bin/mpb.js'))).toBe(true)
  expect(existsSync(join(cli, 'bin/mpb5.js'))).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v5/packages/core && pnpm exec vitest run src/__tests__/package.test.ts`  
Expected: FAIL（`mpb.js` 不存在或 `mpb5.js` 仍在）

- [ ] **Step 3: Write minimal implementation**

按 Files 列表改名、删包、改文档与 workspace。`mpb.js` 权限保持 `100755`。不要 `git rm example/`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v5/packages/core && pnpm exec vitest run`  
Expected: 全绿（含新断言）

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: drop 4.x packages and expose mpb"
```

---

### Task 2: 图节点 id 改为相对 srcDir

**Files:**
- Modify: `v5/packages/core/src/graph/builder.ts`
- Modify: `v5/packages/core/src/__tests__/graph-builder.test.ts`
- Create: `v5/packages/core/src/__tests__/id-space.test.ts`

**Interfaces:**
- Consumes: `buildGraph`、`analyzeGraph`、`resolveId`
- Produces: `Module.id` / `Edge.from` / `Edge.to` / `graph.entries` 均为 posix 相对 `srcDir` 的路径。`Module.sourcePath` 为绝对路径。external 边的 `to` 仍是 `plugin://...`。`readFile` 只读 `sourcePath`。

- [ ] **Step 1: Write the failing test**

```ts
// v5/packages/core/src/__tests__/id-space.test.ts
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeGraph, buildGraph, weappAdapter } from '../index'

describe('src-relative ids', () => {
  it('keeps subpackage prefix so analyze can own pkgA pages', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mpb-ids-'))
    const src = join(root, 'src')
    await mkdir(join(src, 'pkgA', 'pages'), { recursive: true })
    await writeFile(join(src, 'app.js'), `require('./pkgA/pages/x')\n`)
    await writeFile(join(src, 'pkgA', 'pages', 'x.js'), `module.exports = 1\n`)
    const { graph } = await buildGraph({
      rootDir: root,
      srcDir: src,
      adapter: weappAdapter,
      entryScripts: ['src/app.js'],
    })
    expect([...graph.nodes.keys()].sort()).toEqual(['app.js', 'pkgA/pages/x.js'])
    expect(graph.nodes.get('pkgA/pages/x.js')?.sourcePath).toBe(join(src, 'pkgA', 'pages', 'x.js'))
    analyzeGraph(graph, [{ root: '' }, { root: 'pkgA' }], weappAdapter)
    expect(graph.nodes.get('app.js')?.owner).toBe('main')
    expect(graph.nodes.get('pkgA/pages/x.js')?.owner).toBe('pkgA')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL（节点 id 仍是绝对路径，analyze 把 `pkgA` 页染成 main）

- [ ] **Step 3: Write minimal implementation**

`builder.ts`：解析成功后 `id = posixRelative(srcDir, absPath)`，`sourcePath = absPath`。`enqueue` / `visited` / `edges` 用相对 id。循环里 `readFile(node.sourcePath)`。`resolveId` 的 `importer` 用当前模块 `sourcePath`（入口第一次用绝对路径）。`posixRelative`：`relative(from, to).split(/[\\/]/).join('/')`。

更新 `graph-builder.test.ts` 里对绝对 id 的断言，改为相对 id（`app.js`、`pages/index.js`）。

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): use src-relative module ids"
```

---

### Task 3: app.json 页面入口 + suite 展开

**Files:**
- Create: `v5/packages/core/src/graph/suite.ts`
- Create: `v5/packages/core/src/graph/entries.ts`
- Modify: `v5/packages/core/src/graph/builder.ts`
- Create: `v5/packages/core/src/__tests__/suite.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `buildGraph`、`weappAdapter.suite` / `sourceExts`、`EdgeKinds.pageSuite` / `componentSuite`
- Produces:

```ts
export function companionPath(scriptAbs: string, kind: AbstractKind, adapter: TargetAdapter): string | undefined
// 同目录、同 basename，按 adapter.sourceExts[kind] 找第一个存在的文件

export function pageScriptsFromAppJson(code: string, adapter: TargetAdapter): {
  scripts: string[] // posix 相对 src，无扩展名（如 pages/index/index）
  packages: PackageInfo[]
}
```

`buildGraph` 增加可选 `packages?: PackageInfo[]` 输出：若图中存在 `app.json`（或 app 的 json suite），解析 `pages` 与 `subPackages`，把每个页面 script 入队，并写 `graph.packages`。

对每个 **script** 节点：用 `companionPath` 找 json/template/style，存在则加边（entry/`app.js`/`pageType==='app'` 用 `page-suite`，`usingComponent` 目标用 `component-suite`，其它 script 也用 `page-suite` 即可），`affectsOwnership: true`。缺伴生文件不报错（json 可缺）。缺页面 script 文件 → `MISSING_PAGE_JS`，不入队。

- [ ] **Step 1: Write the failing test**

```ts
// 夹具 src/
//   app.js          空
//   app.json        { pages: ['pages/index/index'] }
//   pages/index/index.js
//   pages/index/index.json  { usingComponents: {} }
//   pages/index/index.wxml  <view/>
//   pages/index/index.wxss  .a{}
// entryScripts: ['src/app.js']
// 断言：nodes 含 app.js、app.json、pages/index/index.js|.json|.wxml|.wxss
// 存在 page-suite 边 app.js → app.json 与 index.js → index.wxml
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL（只有 app.js，没有四件套）

- [ ] **Step 3: Write minimal implementation**

`suite.ts` / `entries.ts` 按上面接口。`pages` 字段名读 `adapter.appJson.pages`，分包读 `adapter.appJson.subPackages`（weapp 为 `pages` / `subPackages`）。分包页路径 = `posixJoin(root, page)`。`packages` 至少含 `{ root: '' }`，每个 subPackage 一项 `{ root, independent }`。

展开伴生：在 script 节点写入后、抽边前，扫描 adapter.suite 里除 script 外的 kind。

页面 script 解析：`resolveId({ request: './' + spec, importer: join(srcDir, 'app.js'), kind: 'script', ... })`。

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): expand page suites from app.json"
```

---

### Task 4: planGraph

**Files:**
- Create: `v5/packages/core/src/plan/plan.ts`
- Create: `v5/packages/core/src/__tests__/plan.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `ModuleGraph`、`ResolvedConfig.output` / `subPackage`、`adapter.emitExt`
- Produces:

```ts
export function planGraph(
  graph: ModuleGraph,
  opts: { outputDir: string; shared: 'duplicate' | 'main'; adapter: TargetAdapter },
): { plan: OutputPlan; diagnostics: Diagnostic[] }
```

规则（P1）：
1. external 节点/边不产生 placement。
2. dest 扩展名 = `adapter.emitExt[kind]`（`asset` 保留原后缀）。路径用 id 换扩展：`replaceExt(id, ext)`。
3. `owner === 'main'` → 一份，`destPath = posixJoin(outputDir, replaceExt(id, ext))`，`package: 'main'`。
4. `owner === 某分包` → `destPath = posixJoin(outputDir, owner, replaceExt(idWithoutOwnerPrefix, ext))`；若 id 已以 `owner/` 开头则不要重复套 root。
5. `owner === 'shared'` 且 `shared === 'duplicate'` → 对每个触及该模块的分包 root 各一份（从 graph.edges 反查非 external、affectsOwnership 的 from 的 owner；from 为 main 则跳过）。`shared === 'main'` → 当 main 一份。
6. 同一 destPath 两份不同 moduleId → `PATH_COLLISION` warning，后者 dest 加 8 位 `module.hash` 后缀（文件名 `name-<hash8>.ext`）。
7. 每个 placement 为每条出边（非 external）生成 `Rewrite`：`from=moduleId`，`raw=edge.raw`，`destSpecifier` 先占位为 `edge.to`（Task 6 再算相对路径），`placementPackage`，拷贝 `rewritePath`。external 边也生成 Rewrite，`destSpecifier = edge.to`（原样）。

测试用手工 `ModuleGraph`（相对 id），不要读盘。

- [ ] **Step 1: Write the failing test**

三例：
1. `app.js` + `pages/index/index.wxml` owner main → dest `dist/app.js`、`dist/pages/index/index.wxml`（emitExt.template）。
2. `pkgA/p.js` owner `pkgA` → `dist/pkgA/p.js`。
3. `lib.js` owner `shared`，`shared: 'duplicate'`，边从 `pkgA/a.js` 与 `pkgB/b.js` → 两个 placement `dist/pkgA/lib.js`、`dist/pkgB/lib.js`。

假 adapter：`emitExt.template = '.out'`，template 节点 dest 以 `.out` 结尾。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL（`planGraph` 未导出）

- [ ] **Step 3: Write minimal implementation**

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): plan output placements from owners"
```

---

### Task 5: transform

**Files:**
- Create: `v5/packages/core/src/compile/transform.ts`
- Create: `v5/packages/core/src/__tests__/transform.test.ts`
- Modify: `v5/packages/core/package.json` — 加运行时依赖 `lightningcss`（已有 `@swc/core`）
- Modify: `v5/pnpm-lock.yaml`（在 `v5/` 执行 `pnpm install`）
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `AbstractKind`、`ResolvedConfig.compile`（可只传 `{ js, css, minify: false }`）
- Produces:

```ts
export function transformModule(input: {
  kind: AbstractKind
  sourcePath: string
  code: string
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  minify?: boolean
}): { code: string }
```

- script：`@swc/core` `transformSync`。`.ts/.tsx` → `syntax: 'typescript'`，否则 `ecmascript`。`jsc.target` = `js.target`。`module.type` = `js.module === 'es6' ? 'es6' : 'commonjs'`。`minify` 默认 false。
- script-module：同样 SWC，但 `jsc.target` 固定 `es2015`，不要 JSX。
- style：`lightningcss.transform`，`minify` 默认 false。
- json：`JSON.stringify(JSON.parse(code), null, 2)`（minify 时无空白）。
- template / asset：原样返回。
- 禁止在输出里写入 destPath / owner。

- [ ] **Step 1: Write the failing test**

```ts
it('strips typescript types via swc', () => {
  const { code } = transformModule({
    kind: 'script',
    sourcePath: '/x.ts',
    code: 'export const n: number = 1\n',
    js: { target: 'es2018', module: 'commonjs' },
  })
  expect(code).not.toContain('number')
  expect(code).toContain('exports')
})

it('minifies neither style nor json in P1 default', () => {
  const { code } = transformModule({
    kind: 'style',
    sourcePath: '/a.wxss',
    code: '.a { color: red; }\n',
    js: { target: 'es2018', module: 'commonjs' },
  })
  expect(code).toContain('color')
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write minimal implementation + pnpm install in v5/**

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): transform script style and json"
```

---

### Task 6: rewrite

**Files:**
- Create: `v5/packages/core/src/compile/rewrite.ts`
- Create: `v5/packages/core/src/__tests__/rewrite.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `OutputPlan`、`transform` 后的 code、`Edge.rewritePath`
- Produces:

```ts
export function rewriteCode(input: {
  moduleId: string
  kind: AbstractKind
  code: string
  placement: Placement
  plan: OutputPlan
}): string
```

- 取出 `plan.rewrites` 中 `from === moduleId && placementPackage === placement.package` 的项。
- script / script-module：替换字符串字面量里的 `raw`（只替换引号包裹的完整 specifier：`'raw'` / `"raw"`）。`destSpecifier` 在本 Task **就算好**：对非 external，找到 `to` 模块在**同一** `placement.package` 下的 dest（duplicate 时对应该包那一份；找不到则用任意一份），再 `posixRelative(dirname(placement.destPath), toDest)`，保证以 `./` 或 `../` 开头。external：`destSpecifier` 保持 `raw`（`plugin://` 不变）。
- json：`componentRelative` 视为 true。若有 `rewritePath` JSON pointer，写入相对 dest。external 指针目标保持原字符串。
- template：按出现的 `raw` 替换属性值（引号内）。不要整树序列化。
- style：替换 `@import` 引号内 raw。
- 无 rewrite 的模块返回原文。

`planGraph` 若仍把 `destSpecifier` 写成 `edge.to`，`rewriteCode` 必须按上面重算，不要依赖 plan 里的占位。

- [ ] **Step 1: Write the failing test**

手工 plan：`pages/index/index.js` dest `dist/pages/index/index.js`，边 `raw: './lib'` → `lib.js` dest `dist/pages/index/lib.js`。源码 `require('./lib')` → 仍是相对 `./lib`（或 `./lib.js`，二选一，测试锁你选的那个并在实现里固定）。

第二例：`require('plugin://x/y')` 变换后仍含 `plugin://x/y`。

第三例：json `{"usingComponents":{"x":"plugin://x/y"}}` rewritePath `/usingComponents/x` → 仍是 `plugin://x/y`。

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write minimal implementation**

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): rewrite specifiers per placement"
```

---

### Task 7: emit + createCompiler + `mpb build`

**Files:**
- Create: `v5/packages/core/src/compile/emit.ts`
- Create: `v5/packages/core/src/compiler.ts`
- Create: `v5/packages/core/src/__tests__/build.test.ts`
- Modify: `v5/packages/core/src/index.ts` — 导出 `createCompiler`、`planGraph` 若还未导出
- Modify: `v5/packages/cli/src/index.ts` — `mpb build`

**Interfaces:**
- Consumes: 以上全部
- Produces:

```ts
export async function emitPlan(input: {
  graph: ModuleGraph
  plan: OutputPlan
  outputDir: string
  clean: boolean
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
}): Promise<Diagnostic[]>

export function createCompiler(config: ResolvedConfig): {
  run(): Promise<{ graph: ModuleGraph; plan: OutputPlan; diagnostics: Diagnostic[] }>
}
```

`run()`：
1. `srcDir = resolve(config.rootDir, config.src)`
2. `buildGraph({ rootDir, srcDir, adapter: config.target, entryScripts: [join(srcDir, 'app.js')], alias: config.resolve.alias })`
3. 若无 `app.js` 试 `app.ts`；都没有 → diagnostic `MISSING_APP_JS`，返回
4. `analyzeGraph(graph, graph.packages.length ? graph.packages : [{ root: '' }], config.target)`
5. `planGraph(graph, { outputDir: resolve(rootDir, config.output.dir), shared: config.subPackage.shared, adapter: config.target })`
6. `emitPlan`：`clean` 则 `rm(outputDir, { recursive, force })` 后重建（P1 无 watch，每次 run 都是第一次 emit）。对每个 placement：读 `sourcePath`，`transformModule`，`rewriteCode`，`mkdir` + `writeFile` dest。有界并行可用 `Promise.all` 分批，P1 也可串行写出（并行留到有测试再加）。
7. 合并所有 diagnostics。

CLI：`argv[2]==='build'` 时 `loadConfig(cwd)` → `createCompiler` → `run`。把 diagnostics 打到 stderr（`code message file`）。有 `severity==='error'` 则 `process.exitCode = 1`。`CONFIG_NOT_FOUND` / `LEGACY_CONFIG` → `exitCode = 2`。**禁止** `process.exit`。`inspect graph` 的 usage 改为 `usage: mpb <inspect graph|build>`。

- [ ] **Step 1: Write the failing test**（集成，tmpdir）

```
src/app.js                 // App({})
src/app.json               { "pages": ["pages/index/index"] }
src/pages/index/index.js   require('./lib'); require('plugin://x/y')
src/pages/index/index.json { "usingComponents": { "x": "plugin://x/y" } }
src/pages/index/index.wxml <view/>
src/pages/index/index.wxss .a{color:red}
src/pages/index/lib.js     module.exports = 1
```

构造最小 `ResolvedConfig`（不要依赖磁盘上的 mpbuild.config）：`src:'src', target: weappAdapter, output:{dir:'dist',npm:'npm',clean:true,componentRelative:true}, ...`。

`await createCompiler(config).run()`。

断言磁盘存在：
- `dist/app.js`
- `dist/app.json`
- `dist/pages/index/index.js`
- `dist/pages/index/index.json`
- `dist/pages/index/index.wxml`
- `dist/pages/index/index.wxss`
- `dist/pages/index/lib.js`

断言不存在任何含 `plugin:` 的输出文件路径。  
`index.json` 文本仍含 `plugin://x/y`。  
`index.js` 文本仍含 `plugin://x/y`。  
`diagnostics` 无 `severity==='error'`。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL（`createCompiler` 未导出）

- [ ] **Step 3: Write minimal implementation**

- [ ] **Step 4: Run tests** — `v5/packages/core` 全绿。再用 Node 22 对同一夹具跑 `node v5/packages/cli/bin/mpb.js build` 作 smoke（写进报告即可）。

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add mpb build for page suites"
```

---

## Self-review

- P1 规格：plan、SWC、Lightning、template/json、rewrite、emit、`mpb build`、页面四件套、`plugin://` 不失败 → Tasks 4–7。
- 用户新增：命令 `mpb`、删除 4.x → Task 1。src-相对 id（终审 P1-start）→ Task 2。suite/入口 → Task 3。
- 不在本计划：watch、dev、platform/ifdef、projects、`.config.js` 执行、npmCompat、legacyScss、projectConfig、minify、金样 CI、`mpb analyze`。
- 无 TBD 步骤。
