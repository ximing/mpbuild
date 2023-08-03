# mpbuild 5.0 P0 图内核 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `v5/` 落地可测试的图内核：配置、weapp adapter、解析、四种抽取、BFS 建图、归属分析、假 adapter 快照、`mpb5 inspect graph`。

**Architecture:** core 只问 `TargetAdapter`，公开 kind 用 `AbstractKind`。建图用队列 BFS + visited。P0 不写盘、不 transform、不 watch。

**Tech Stack:** TypeScript 5、Node >= 20、pnpm、vitest、zod、@swc/core、tsup。不从 `next/` 拷代码。

## Global Constraints

- 实现目录仅限 `v5/packages/core` 与 `v5/packages/cli`（Task 1 可改根 `pnpm-workspace.yaml` 增加 `v5/packages/*`）。
- 公开 kind 必须是 `script | json | template | style | script-module | asset`，禁止导出 `'wxml'|'wxss'|'wxs'` 判别联合。
- 抽取、suite、emit 后缀、模板标签、JSON 字段只读 adapter，core 不写死 `.wxml` 字符串做分支。
- 建图：全局 visited（最终 id）、队列 BFS、环边入图。禁止 async DFS 递归。
- TDD：先写失败测试并跑红，再写最少实现。报告必须含 RED/GREEN 命令与输出摘要。
- 提交：每 Task 至少一次 commit。信息形如 `feat(core): add weapp target adapter`。禁止 `Co-authored-by`、禁止出现 AI/Grok/Claude/Cursor/Generated/assistant。`git commit` 使用 `git -c trailer.ifexists=doNothing` 且不要 `--trailer`。
- 测试命令：`cd v5 && pnpm --filter @mpbuild/core test -- --run`
- 中文注释；标识符英文。
- Node >= 20；包名 `@mpbuild/core`、`@mpbuild/cli`。
- 不要读或复制 `next/packages/**` 源码。

---

## File map

```
v5/package.json
v5/pnpm-workspace.yaml
v5/tsconfig.json
v5/packages/core/package.json
v5/packages/core/tsconfig.json
v5/packages/core/vitest.config.ts
v5/packages/core/src/index.ts
v5/packages/core/src/types.ts
v5/packages/core/src/target/weapp.ts
v5/packages/core/src/target/index.ts
v5/packages/core/src/diagnostic/index.ts
v5/packages/core/src/config/schema.ts
v5/packages/core/src/config/load.ts
v5/packages/core/src/resolve/resolver.ts
v5/packages/core/src/graph/extract.ts
v5/packages/core/src/graph/builder.ts
v5/packages/core/src/graph/analyze.ts
v5/packages/core/src/__tests__/
v5/packages/cli/package.json
v5/packages/cli/src/index.ts
```

---

### Task 1: v5 脚手架与测试入口

**Files:**
- Create: `v5/package.json`
- Create: `v5/pnpm-workspace.yaml`
- Create: `v5/tsconfig.json`
- Create: `v5/packages/core/package.json`
- Create: `v5/packages/core/tsconfig.json`
- Create: `v5/packages/core/vitest.config.ts`
- Create: `v5/packages/core/src/index.ts`
- Create: `v5/packages/core/src/__tests__/package.test.ts`
- Modify: `pnpm-workspace.yaml`（根目录增加 `- 'v5/packages/*'`）

**Interfaces:**
- Consumes: 无
- Produces: 包 `@mpbuild/core` 可被 vitest 加载；`src/index.ts` 导出空对象占位 `export const version = '2.0.0'`

- [ ] **Step 1: Write the failing test**

```ts
// v5/packages/core/src/__tests__/package.test.ts
import { describe, it, expect } from 'vitest'
import { version } from '../index'

describe('package', () => {
  it('exports a semver version string', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v5/packages/core && pnpm exec vitest run src/__tests__/package.test.ts`  
Expected: FAIL（包或入口不存在，或 `version` 未导出）

- [ ] **Step 3: Write minimal implementation**

`v5/package.json`:

```json
{
  "name": "mpbuild-v5",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.0.0" },
  "scripts": { "test": "pnpm --filter @mpbuild/core test" }
}
```

`v5/pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
```

`v5/packages/core/package.json`: name `@mpbuild/core`, version `2.0.0`, type `module`, scripts.test = `vitest run`, deps: 暂无业务依赖。devDeps: `vitest` `typescript` `@types/node`。

`src/index.ts`: `export const version = '2.0.0'`

根 `pnpm-workspace.yaml` 在现有 packages 后加 `- 'v5/packages/*'`。

在 `v5/` 执行 `pnpm install`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v5/packages/core && pnpm test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml v5
git commit -m "feat: scaffold v5 workspace and core package"
```

---

### Task 2: 类型、EdgeKinds、weapp adapter

**Files:**
- Create: `v5/packages/core/src/types.ts`
- Create: `v5/packages/core/src/target/weapp.ts`
- Create: `v5/packages/core/src/target/index.ts`
- Create: `v5/packages/core/src/__tests__/target.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: Task 1 包结构
- Produces:
  - `export type AbstractKind = 'script' | 'json' | 'template' | 'style' | 'script-module' | 'asset'`
  - `export const EdgeKinds` 与规格 §6 完全一致
  - `export interface TargetAdapter` 与规格 §6 字段一致（`externalSpecifiers: RegExp`）
  - `export function getTargetAdapter(id: string): TargetAdapter` — 仅识别 `'weapp'`，否则抛出带 code `UNKNOWN_TARGET` 的 Error
  - `export const weappAdapter: TargetAdapter` 字段与规格 §22.1 一致

- [ ] **Step 1: Write the failing test**

```ts
// v5/packages/core/src/__tests__/target.test.ts
import { describe, it, expect } from 'vitest'
import { getTargetAdapter, weappAdapter, EdgeKinds } from '../index'

describe('weapp adapter', () => {
  it('maps template source ext to .wxml and emit ext to .wxml', () => {
    expect(weappAdapter.sourceExts.template).toEqual(['.wxml'])
    expect(weappAdapter.emitExt.template).toBe('.wxml')
    expect(weappAdapter.ifdefToken).toBe('wx')
    expect(weappAdapter.npmCompat).toBe('weapp')
  })

  it('lists wxs as a template tag, not a closed ModuleKind', () => {
    expect(weappAdapter.templateTags).toContainEqual({
      tag: 'wxs',
      attr: 'src',
      edge: EdgeKinds.scriptModule,
    })
  })

  it('treats plugin: as external', () => {
    expect(weappAdapter.externalSpecifiers.test('plugin://foo/bar')).toBe(true)
    expect(weappAdapter.externalSpecifiers.test('./a')).toBe(false)
  })

  it('resolves weapp by id and rejects unknown targets', () => {
    expect(getTargetAdapter('weapp').id).toBe('weapp')
    expect(() => getTargetAdapter('tt')).toThrow(/UNKNOWN_TARGET/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v5/packages/core && pnpm exec vitest run src/__tests__/target.test.ts`  
Expected: FAIL（符号未导出）

- [ ] **Step 3: Write minimal implementation**

按规格 §6 / §22.1 实现 `types.ts`、`target/weapp.ts`、`getTargetAdapter`。从 `index.ts` 再导出。`UNKNOWN_TARGET` 用 `error.code = 'UNKNOWN_TARGET'` 或 `message` 含该字符串。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd v5/packages/core && pnpm exec vitest run src/__tests__/target.test.ts`  
Expected: PASS，且 `package.test.ts` 仍绿

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core
git commit -m "feat(core): add abstract kinds and weapp target adapter"
```

---

### Task 3: 诊断对象

**Files:**
- Create: `v5/packages/core/src/diagnostic/index.ts`
- Create: `v5/packages/core/src/__tests__/diagnostic.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: 无类型依赖除 `Diagnostic`
- Produces:
```ts
export type Severity = 'error' | 'warning'
export interface Diagnostic {
  code: string
  severity: Severity
  message: string
  file?: string
  loc?: { line: number; column: number }
}
export function diagnostic(partial: Diagnostic): Diagnostic
export function isError(d: Diagnostic): boolean
```

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { diagnostic, isError } from '../index'

describe('diagnostic', () => {
  it('marks error severity as fatal', () => {
    const d = diagnostic({
      code: 'RESOLVE_MISS',
      severity: 'error',
      message: 'cannot resolve ./missing',
      file: '/app/a.js',
    })
    expect(isError(d)).toBe(true)
    expect(d.code).toBe('RESOLVE_MISS')
  })

  it('does not treat warnings as fatal', () => {
    const d = diagnostic({
      code: 'CYCLE',
      severity: 'warning',
      message: 'cycle',
    })
    expect(isError(d)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd v5/packages/core && pnpm exec vitest run src/__tests__/diagnostic.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`diagnostic` 原样返回；`isError` 为 `d.severity === 'error'`。

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core
git commit -m "feat(core): add diagnostic helpers"
```

---

### Task 4: 配置 schema 与加载

**Files:**
- Create: `v5/packages/core/src/config/schema.ts`
- Create: `v5/packages/core/src/config/load.ts`
- Create: `v5/packages/core/src/__tests__/config.test.ts`
- Modify: `v5/packages/core/package.json`（加依赖 `zod`）
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `getTargetAdapter`、`TargetAdapter`
- Produces:
```ts
export function defineConfig<T>(config: T): T
export async function loadConfig(rootDir: string): Promise<ResolvedConfig>
export interface ResolvedConfig {
  rootDir: string
  src: string
  target: TargetAdapter
  platform?: string
  entry: string | Record<string, unknown>
  output: { dir: string; npm: string; clean: boolean; componentRelative: boolean }
  resolve: { alias: Record<string, string>; extensions: TargetAdapter['sourceExts'] }
  compile: {
    js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
    css: { lightningcss: boolean }
    minify: boolean | Record<string, boolean>
  }
  subPackage: { shared: 'duplicate' | 'main' }
  configPath: string
}
```

默认值按规格 §7。只认 `mpbuild.config.ts` / `.mts` / `.js`。仅有 `mpb.config.js` 时抛出 message 含 `LEGACY_CONFIG`。未知 `target` 字符串抛 `UNKNOWN_TARGET`。

- [ ] **Step 1: Write the failing test**

在 `os.tmpdir()` 建临时目录。用例：

1. 写入 `mpbuild.config.js`：`export default { src: 'src', entry: './entry.js' }`，`loadConfig` 后 `output.dir === 'dist'`、`target.id === 'weapp'`、`subPackage.shared === 'duplicate'`。
2. 只放 `mpb.config.js` → 抛 `/LEGACY_CONFIG/`。
3. `defineConfig({ src: 'src' })` 返回同一对象。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

用 zod 校验并填默认。`loadConfig` 按顺序找三个文件名，用 `pathToFileURL` + `import()` 加载。`defineConfig` 原样返回。

- [ ] **Step 4: Run tests**

`pnpm exec vitest run` 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): load mpbuild.config with zod defaults"
```

---

### Task 5: Resolver

**Files:**
- Create: `v5/packages/core/src/resolve/resolver.ts`
- Create: `v5/packages/core/src/__tests__/resolve.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `TargetAdapter`、`AbstractKind`、`Diagnostic`
- Produces:
```ts
export interface ResolveRequest {
  request: string
  importer: string
  kind: AbstractKind
  adapter: TargetAdapter
  srcDir: string
  alias?: Record<string, string>
  virtualIds?: Set<string>
}
export interface ResolveResult {
  id: string
  external?: boolean
  virtual?: boolean
}
export function resolveId(req: ResolveRequest): ResolveResult
```

规则按规格 §8 的 2–7（P0 不做插件 resolve 钩子，但要支持 `virtualIds` 命中返回 `{ virtual: true }`）。`plugin://` → `{ id: request, external: true }`。相对路径按 kind 的 `sourceExts` 补全。找不到抛 message 含 `RESOLVE_MISS`。

- [ ] **Step 1: Write the failing test**

临时目录：

- `src/a.js` 内容任意；`src/b.js`；`src/n/index.js`。
- `./b` from `a.js` kind script → 解析到 `b.js` 绝对路径。
- `plugin://foo/x` → `external: true`。
- `virtual:helper` 且 `virtualIds` 含该 id → `virtual: true`。
- `./missing` → throw `/RESOLVE_MISS/`。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

纯函数 `resolveId`，用 `fs.existsSync`。alias 最长前缀。npm 字段序 P0 可只实现相对/alias/external/virtual；若测试不覆盖 npm，不要实现 npm（YAGNI）。若你加了 npm 测试，按 `adapter.npmPackageFields` 实现。

本 Task **必须**实现：相对、`/` 相对 srcDir、alias 字符串、external 正则、virtualIds、扩展名补全、`index` 文件。

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): resolve relative, alias, virtual and external ids"
```

---

### Task 6: 四种抽取器（表驱动）

**Files:**
- Create: `v5/packages/core/src/graph/extract.ts`
- Create: `v5/packages/core/src/__tests__/extract.test.ts`
- Modify: `v5/packages/core/package.json`（加 `@swc/core`）
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `TargetAdapter`、`EdgeKinds`、`AbstractKind`
- Produces:
```ts
export interface ExtractInput {
  id: string
  kind: AbstractKind
  code: string
  adapter: TargetAdapter
}
export interface ExtractedEdge {
  raw: string
  kind: string
  rewritePath?: string
  loc?: { line: number; column: number }
}
export function extractEdges(input: ExtractInput): ExtractedEdge[]
```

- script：SWC parse，静态 import/require/import()。`import type` 忽略。
- json：只处理 adapter.jsonPathFields 里已有的 `usingComponents.*`。
- template：只处理 adapter.templateTags。
- style：`@import` 字符串。

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { extractEdges, weappAdapter, EdgeKinds } from '../index'

describe('extractEdges', () => {
  it('extracts static import and require from script', () => {
    const edges = extractEdges({
      id: '/a.js',
      kind: 'script',
      adapter: weappAdapter,
      code: `import x from './x'\nconst y = require('./y')\nimport type { Z } from './z'\n`,
    })
    const raws = edges.map((e) => e.raw).sort()
    expect(raws).toEqual(['./x', './y'])
    expect(edges.find((e) => e.raw === './x')?.kind).toBe(EdgeKinds.import)
  })

  it('reads usingComponents from json via adapter table', () => {
    const edges = extractEdges({
      id: '/p.json',
      kind: 'json',
      adapter: weappAdapter,
      code: JSON.stringify({ usingComponents: { btn: '/comp/btn' } }),
    })
    expect(edges).toEqual([
      expect.objectContaining({ raw: '/comp/btn', kind: EdgeKinds.usingComponent }),
    ])
  })

  it('reads template tags from adapter, not hardcoded wxml names in caller', () => {
    const edges = extractEdges({
      id: '/p.wxml',
      kind: 'template',
      adapter: weappAdapter,
      code: `<import src="./t.wxml"/><wxs src="./u.wxs"/>`,
    })
    expect(edges.map((e) => e.raw).sort()).toEqual(['./t.wxml', './u.wxs'])
  })

  it('extracts style @import', () => {
    const edges = extractEdges({
      id: '/a.wxss',
      kind: 'style',
      adapter: weappAdapter,
      code: `@import "./mix.wxss";`,
    })
    expect(edges[0]).toMatchObject({ raw: './mix.wxss', kind: EdgeKinds.styleImport })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`extract.ts` 按 `input.kind` 分派，但标签/字段来自 `input.adapter`。模板用正则或轻量解析取指定 tag 的 attr，不要整树改写。

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): extract edges from script json template and style"
```

---

### Task 7: BFS GraphBuilder

**Files:**
- Create: `v5/packages/core/src/graph/builder.ts`
- Create: `v5/packages/core/src/__tests__/graph-builder.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `resolveId`、`extractEdges`、`getTargetAdapter`、`fs.promises.readFile`
- Produces:
```ts
export interface BuildGraphOptions {
  rootDir: string
  srcDir: string
  adapter: TargetAdapter
  entryScripts: string[] // 绝对或相对 rootDir 的 script 路径
  alias?: Record<string, string>
}
export async function buildGraph(opts: BuildGraphOptions): Promise<{
  graph: ModuleGraph
  diagnostics: Diagnostic[]
}>
```

行为：从 `entryScripts` 入队。对每个 id：读文件、`extractEdges`、`resolveId`。external 边写入 `edges` 且 `external: true`，不入队。未解析 → diagnostic `RESOLVE_MISS`，不入队。环：A→B→A 两边都在，visited 避免死循环。使用数组队列（shift），禁止递归 `await process(child)`。

- [ ] **Step 1: Write the failing test**

夹具目录：

```
app.js -> require('./pages/index')
pages/index.js -> require('./util')
pages/util.js -> require('./index')  // 环
pages/index.js 同时 import 'plugin://x/y'
```

断言：3 个非 external 节点；存在 ring 的两条边；存在 `plugin://x/y` 且 `external: true`；`graph.entries` 含 app.js。

再写一个「缺失文件」：`require('./nope')` → diagnostics 含 `RESOLVE_MISS`。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

`builder.ts` 只用队列。`Module.hash` 用 node `crypto.createHash('sha256').update(code).digest('hex')`。`kind` 由扩展名对照 `adapter.sourceExts` 反查。

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): build module graph with BFS walk"
```

---

### Task 8: 归属分析

**Files:**
- Create: `v5/packages/core/src/graph/analyze.ts`
- Create: `v5/packages/core/src/__tests__/analyze.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `ModuleGraph`
- Produces:
```ts
export interface PackageInfo {
  root: string // '' = main
  independent?: boolean
}
export function analyzeGraph(
  graph: ModuleGraph,
  packages: PackageInfo[],
  adapter: TargetAdapter,
): { graph: ModuleGraph; diagnostics: Diagnostic[] }
```

归属规则规格 §9.3。主包触及 → main；单分包 → 该 root；多分包且主包未触及 → `shared`。环 → `CYCLE` warning。独立分包与主包有边且 `adapter.independentEdge === 'error'` → `INDEPENDENT_PACKAGE_EDGE`。

判断「被某包触及」：从该包的 entry 节点（`graph.packages` 或参数 `packages` + 节点路径是否位于 `rootDir/pkgRoot`，以及 entries 里属于该包的 script）沿 `affectsOwnership !== false` 且非 external 的边走。

测试用手工构造的 `ModuleGraph`（不要读盘），三个模块：

- `app.js` entry，边到 `shared-lib.js` 与 `main-only.js`
- `pkgA/page.js` entry，边到 `shared-lib.js`
- `pkgB/page.js` entry，边到 `only-b.js`

断言：`main-only` owner main；`shared-lib` owner main（主包触及）；`only-b` owner `pkgB`。

再造主包不引用、A 和 B 都引用 `dup.js` → owner `shared`。

环：A↔B → 有 `CYCLE` warning，函数不抛。

- [ ] **Step 1: Write the failing test**（按上面夹具）
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**（一次多源染色：先标每个节点的触及集合，再写 owner）
- [ ] **Step 4: Run tests** — 全绿
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): analyze package ownership and cycles"
```

---

### Task 9: 假 adapter 快照 + inspect 文本

**Files:**
- Create: `v5/packages/core/src/__tests__/fake-adapter.test.ts`
- Create: `v5/packages/core/src/inspect.ts`
- Create: `v5/packages/core/src/__fixtures__/fake-mini/app.js`
- Create: `v5/packages/core/src/__fixtures__/fake-mini/page.tpl`
- Create: `v5/packages/cli/package.json`
- Create: `v5/packages/cli/src/index.ts`
- Create: `v5/packages/cli/bin/mpb5.js`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `buildGraph`、`analyzeGraph`、`TargetAdapter`
- Produces:
```ts
export function formatGraphInspect(graph: ModuleGraph): string
// 每行：<id相对root>\towner=<owner>\tdeps=<raw→to>
```

假 adapter：`id: 'fake'`，`sourceExts.template: ['.tpl']`，`templateTags: [{ tag: 'inc', attr: 'href', edge: 'template-include' }]`，`emitExt.template: '.out'`，其余可复用 weapp 的 script/json。不要走 `getTargetAdapter('fake')`（那必须仍抛 UNKNOWN_TARGET）；测试里直接把 fake 对象传给 `buildGraph`。

夹具 `app.js`：`require('./page.tpl')` 不合适（js require）。改为 `page.js` + `page.tpl`，`page.js` 空；建图 entry 同时传入 `page.js`，并在测试里对 `page.tpl` 单独 `extractEdges` 断言 `inc` 标签被抽到。再对 `buildGraph` + 把 page.tpl 作为从 page.js 的手工… 

更干净：`page.tpl` 内容 `<inc href="./part.tpl"/>`，`part.tpl` 空。测试：

```ts
const adapter = { ...weappAdapter, id: 'fake',
  sourceExts: { ...weappAdapter.sourceExts, template: ['.tpl'] },
  emitExt: { ...weappAdapter.emitExt, template: '.out' },
  templateTags: [{ tag: 'inc', attr: 'href', edge: 'template-include' }],
}
const edges = extractEdges({ id: '/x.tpl', kind: 'template', adapter, code: '<inc href="./part.tpl"/>' })
expect(edges[0].raw).toBe('./part.tpl')
expect(weappAdapter.templateTags.some((t) => t.tag === 'inc')).toBe(false)
```

这张测试证明抽取跟表走，不读死 `import`/`wxml`。

`formatGraphInspect`：对每个 node 一行，包含相对路径与 owner。

CLI：`mpb5 inspect graph` 若无项目可打印 `usage`；有 `mpbuild.config.js` 时加载并 `buildGraph`（P0：若 entry 是字符串，解析该文件的 `pages`/`router` 过重，**本 Task CLI 只要求**：读取 `process.argv[2]==='inspect' && argv[3]==='graph'`，对 `process.cwd()` 下 `src/app.js` 若存在则建图打印，否则打印 `no src/app.js` 退出码 0。不要在本 Task 做完整 entry.js router。）

- [ ] **Step 1: Write fake-adapter.test.ts 与 formatGraphInspect 测试（手工 graph 两节点）**
- [ ] **Step 2: Run tests — FAIL**
- [ ] **Step 3: Implement inspect.ts + cli bin**
- [ ] **Step 4: 全绿**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: inspect graph and prove extractors follow the adapter table"
```

---

## Spec coverage (P0 only)

| 规格 | Task |
|---|---|
| §4 v5 布局 | 1 |
| §6 类型 / EdgeKinds / TargetAdapter | 2 |
| §22.1 weapp 表 | 2 |
| §16 诊断对象 | 3 |
| §7 配置默认与 LEGACY_CONFIG | 4 |
| §8 resolve / virtual / external | 5 |
| §9.2 抽取 | 6 |
| §5.3 / §9 BFS 建图 | 7 |
| §9.3 analyze | 8 |
| 假 adapter 快照、inspect | 9 |
| P1 emit / P2 watch / P3 金样 | 不在本计划 |
