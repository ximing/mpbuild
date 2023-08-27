# mpbuild 5.0 P2 增量 Watch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `mpb dev` 在首次 `run()` 之后按规格 §14 做增量：改文件只重抽边/补节点，用 `topologyChanged` / `planChanged` 决定重跑范围；差量 emit；取消的 dest 删除。

**Architecture:** 把增量从图补丁（`applyGraphChange`）和写出差量（`emitPlan` 的 previousDests）拆开。`createCompiler` 持有上一轮 graph/plan/dest。chokidar 只负责把路径变成 `changed/deleted` 列表。P2 不做 platform/ifdef、projects、金样、磁盘缓存 GC。

**Tech Stack:** 现有 v5 栈 + `chokidar`。Node >= 20。测试用 tmpdir + 直接调 `applyWatchTick`，不依赖真实 debounce 计时（chokidar 冒烟除外）。

## Global Constraints

- 命令名是 `mpb`，禁止再引入 `mpb5`。
- 实现目录仅限 `v5/packages/core` 与 `v5/packages/cli`。
- 公开 kind 必须是 `script | json | template | style | script-module | asset`。抽取 / suite / emit 后缀只读 adapter。
- 建图：全局 visited（最终 id）、队列 BFS、环边入图。禁止 async DFS 递归。
- 图 id 用 posix、相对 `srcDir`。`sourcePath` 绝对。`resolveId.importer` 传 `sourcePath`。
- Watch 重跑范围只用 `topologyChanged` / `planChanged`，禁止「owner 可能变化」口语谓词。
- `output.clean` 只在该 compiler 实例的第一次 emit。Watch **禁止**全量删盘。clean 时保留 `adapter.projectConfigFile`。
- TDD：先红后绿。报告含 RED/GREEN 命令与输出摘要。
- 提交：每 Task 至少一次。禁止 `Co-authored-by` 与 AI/Grok/Claude/Cursor/Generated/assistant。`git -c trailer.ifexists=doNothing commit`，不要 `--trailer`。
- 测试：`eval "$(fnm env)" && fnm use 22` 后 `cd v5 && pnpm --filter @mpbuild/core test -- --run`
- 中文注释；标识符英文。不要读 4.x / `next/`。

---

## File map

```
v5/packages/core/src/compile/emit.ts
v5/packages/core/src/graph/patch.ts
v5/packages/core/src/watch/diff.ts
v5/packages/core/src/watch/tick.ts
v5/packages/core/src/watch/watcher.ts
v5/packages/core/src/compiler.ts
v5/packages/cli/src/index.ts
v5/packages/core/src/__tests__/emit-delta.test.ts
v5/packages/core/src/__tests__/graph-patch.test.ts
v5/packages/core/src/__tests__/watch-tick.test.ts
v5/packages/core/src/__tests__/dev.test.ts
```

---

### Task 1: emit 差量（首次 clean、跳过相同字节、删取消 dest）

**Files:**
- Modify: `v5/packages/core/src/compile/emit.ts`
- Create: `v5/packages/core/src/__tests__/emit-delta.test.ts`
- Modify: `v5/packages/core/src/compiler.ts` — `run()` 第一次 `clean` 按配置；并把本次 dest 记在返回值里供后续 Task 使用（可先只改 emit 签名，compiler 把 `previousDests` 传空）
- Modify: `v5/packages/core/src/index.ts` 若导出类型变化

**Interfaces:**
- Consumes: 现有 `emitPlan`
- Produces:

```ts
export async function emitPlan(input: {
  graph: ModuleGraph
  plan: OutputPlan
  outputDir: string
  clean: boolean
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  previousDests?: Iterable<string>
  preserveNames?: string[] // 默认 [adapter 的 projectConfigFile]；本 Task 由调用方传入 ['project.config.json']
}): Promise<{ diagnostics: Diagnostic[]; dests: string[] }>
```

行为：
1. `clean === true`：删除 `outputDir` 下除 `preserveNames`（只比 basename）以外的内容，然后 `mkdir`。禁止 `rm` 整个目录若会丢掉 preserve 文件——先读目录再删其它项。
2. `clean === false`：不删整树。
3. 对每个 placement：transform+rewrite 后，若 dest 已存在且 utf8 字节相同则 **不** `writeFile`（可用 `stat`+`readFile` 比较）。
4. `previousDests` 里有、本次 `plan.placements` 没有的路径：`unlink`（文件不存在忽略）。
5. 返回本次应该存在的 dest 列表（placements 的 destPath）。

- [ ] **Step 1: Write the failing test**

tmpdir 手工 graph+plan 两个 dest。第一次 `clean: true` 且目录里预放 `project.config.json` 与 `junk.js`：junk 消失，project.config.json 仍在。第二次改 plan 只剩一个 dest、`clean: false`、`previousDests` 为第一次的两个：被去掉的 dest 文件消失，留下的若内容没变则 `mtime` 不变（写完后 sleep 10ms 再第二次 emit，断言 mtimeMs 相等）。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL（现实现 `rm` 整树，会删 project.config.json；第二次不会 unlink 取消 dest）

- [ ] **Step 3: Write minimal implementation**

更新 `createCompiler.run`：`emitPlan` 用新返回值（可忽略 dests）。`preserveNames: [config.target.projectConfigFile]`。第一次 run 仍 `clean: config.output.clean`。

- [ ] **Step 4: Run tests** — 全绿（含原 `build.test.ts`）

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): emit delta dests and preserve project config"
```

---

### Task 2: applyGraphChange（增量建图）

**Files:**
- Create: `v5/packages/core/src/graph/patch.ts`
- Create: `v5/packages/core/src/__tests__/graph-patch.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `extractEdges`、`resolveId`、`companionPath`、`buildGraph` 的 intern 规则（posix 相对 srcDir）
- Produces:

```ts
export async function applyGraphChange(opts: {
  graph: ModuleGraph
  srcDir: string
  rootDir: string
  adapter: TargetAdapter
  alias?: Record<string, string>
  changedIds: string[]   // src-relative，文件仍在
  deletedIds: string[]   // src-relative，文件已删
  addedRelPaths: string[] // src-relative，新出现的文件（可能尚未入图）
}): Promise<{ graph: ModuleGraph; diagnostics: Diagnostic[]; topologyChanged: boolean }>
```

行为（对传入 graph **可变**，测试可先 structuredClone 节点 Map）：
1. deletedIds：删节点、删所有 from/to 等于该 id 的边。
2. addedRelPaths：若与某已入图 **script** 同目录、且 `companionPath` 能命中该新文件，则加 suite 边并入队。
3. changedIds：若节点存在，重读 `sourcePath`，更新 `hash` 与 kind；删掉该节点全部 **outgoing** 边；重新 `extractEdges` + `resolveId`（importer = sourcePath）；新 id intern 后入队。
4. 队列 BFS：与 `buildGraph` 相同，只处理未 visited 的新 id（本轮新出现的）。已在图且未标 changed 的节点不要重抽。
5. 从 `graph.entries` 沿非 external 边走，不可达节点删除（及其边）。
6. `topologyChanged`：节点集合、边集合（from,to,kind,raw）、entries、packages、或任一节点的 suite 伴生集合 与进入函数前不同。

- [ ] **Step 1: Write the failing test**

夹具：`app.js` + `app.json` pages index + `pages/index/index.js` require `./lib` + `lib.js`。先 `buildGraph`。

1. 改 `lib.js` 内容：topologyChanged false（边不变），hash 变。
2. `index.js` 改成不再 require lib：lib 节点消失，topologyChanged true。
3. 在 `pages/index/` 新增 `index.wxml`：`addedRelPaths: ['pages/index/index.wxml']`，图中出现该 template 节点与 suite 边。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL（`applyGraphChange` 未导出）

- [ ] **Step 3: Write minimal implementation**

不要复制 `buildGraph` 全文。抽出或并排调用 intern/resolve/extract。禁止递归 `await process(child)`。

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): patch module graph on file changes"
```

---

### Task 3: applyWatchTick（谓词 + 选择性 analyze/plan/emit）

**Files:**
- Create: `v5/packages/core/src/watch/diff.ts`
- Create: `v5/packages/core/src/watch/tick.ts`
- Create: `v5/packages/core/src/__tests__/watch-tick.test.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `applyGraphChange`、`analyzeGraph`、`planGraph`、`emitPlan`、`transformModule` 的 hash
- Produces:

```ts
export function topologyChanged(before: ModuleGraph, after: ModuleGraph): boolean
export function planChanged(input: {
  topologyChanged: boolean
  before: OutputPlan
  after: OutputPlan
}): boolean
// planChanged 在 topologyChanged 为 true 时为 true；
// 否则比较 placements 的 (moduleId, destPath, package) 集合，以及 shared 模块的 placement 包集合。

export async function applyWatchTick(input: {
  config: ResolvedConfig
  graph: ModuleGraph
  plan: OutputPlan
  previousDests: Iterable<string>
  changedIds: string[]
  deletedIds: string[]
  addedRelPaths: string[]
}): Promise<{
  graph: ModuleGraph
  plan: OutputPlan
  diagnostics: Diagnostic[]
  dests: string[]
  topologyChanged: boolean
  planChanged: boolean
}>
```

`applyWatchTick`：
1. `applyGraphChange`
2. 若 `topologyChanged`：`analyzeGraph` + `planGraph`；否则沿用传入 plan（但若 hash 变了仍要 emit 该模块现有 placement）。
3. `planChanged` 按上面函数。
4. `emitPlan({ clean: false, previousDests })`。P2 可以整表 rewrite+emit（差量删除已由 Task 1 保证）。允许只对 hash 变化或 dest 变化的 moduleId 写出——若实现全量 rewrite 但 skip 相同字节，也算合格。
5. 配置未变；本函数不 loadConfig。

`createCompiler` 增加内部状态：`lastGraph/lastPlan/lastDests/didEmit`。`run()` 结束后写入。新增：

```ts
applyWatchTick(args: {
  changedIds: string[]
  deletedIds: string[]
  addedRelPaths: string[]
}): Promise<{ graph, plan, diagnostics, dests, topologyChanged, planChanged }>
```

若尚未 `run()`，先 `run()` 再 tick。

- [ ] **Step 1: Write the failing test**

用与 `build.test.ts` 相同的 `ResolvedConfig` 构造。tmpdir：

```
src/app.js / app.json pages: index
src/pages/index/index.js  require('./lib')
src/pages/index/index.json {}
src/pages/index/lib.js
```

`await compiler.run()` 后：
- 改 `lib.js` 文本，`applyWatchTick({ changedIds:['pages/index/lib.js'], deletedIds:[], addedRelPaths:[] })`：`topologyChanged === false`，`dist/pages/index/lib.js` 含新文本。
- `index.json` 加上 `"usingComponents": { "c": "/components/c/c" }`，并写入 `src/components/c/c.js` + 空 json/wxml/wxss（或至少 js）。`changedIds: ['pages/index/index.json']`, `addedRelPaths: ['components/c/c.js', ...]`：`topologyChanged === true`，`dist/components/c/c.js` 存在。
- 再把 json 的 usingComponents 清空：组件 dest **消失**。

另写一例：两个分包页 `pkgA/a.js`、`pkgB/b.js` 都 require `lib.js`，app.json subPackages。先 run。再加 `pkgC` 页 require 同一 `lib.js`（改 app.json + 新文件）：`lib.js` 在 `dist/pkgC/` 多一份（duplicate）。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

- [ ] **Step 4: Run tests** — 全绿

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): apply watch ticks with topology predicates"
```

---

### Task 4: chokidar + `mpb dev`

**Files:**
- Create: `v5/packages/core/src/watch/watcher.ts`
- Modify: `v5/packages/core/src/compiler.ts` — `watch()`
- Modify: `v5/packages/core/package.json` — 依赖 `chokidar`
- Modify: `v5/pnpm-lock.yaml`（`cd v5 && pnpm install`）
- Modify: `v5/packages/cli/src/index.ts`
- Create: `v5/packages/core/src/__tests__/dev.test.ts`
- Modify: `v5/packages/core/src/index.ts`

**Interfaces:**
- Consumes: `applyWatchTick`、graph.nodes.sourcePath、suite 目录
- Produces:

```ts
export function watchPaths(graph: ModuleGraph, srcDir: string): string[]
// 已入图 sourcePath + 每个 script 的 dirname + srcDir
// 不含 path.sep+'node_modules'+path.sep 的路径

export function createCompiler(config: ResolvedConfig): {
  run(): Promise<{ graph: ModuleGraph; plan: OutputPlan; diagnostics: Diagnostic[] }>
  applyWatchTick(...): ...
  watch(): Promise<{ close(): Promise<void> }>
}
```

`watch()`：若未 run 则 `run()`。`chokidar.watch(watchPaths(...), { ignoreInitial: true, ignored: /node_modules/ })`。debounce **80ms**（`setTimeout` 合并事件）。`add` → addedRelPaths；`unlink` → deletedIds；`change` → changedIds。路径转 src-relative。收到 `mpbuild.config.js/ts/mts` 变化则 `run()` 且清空 lastDests 以外的 transform 状态（P2 无磁盘缓存则只需再 run，`clean: false`）。

CLI：`argv[2]==='dev'` 或 `argv[2]==='--watch'` 或 `argv[2]==='build' && argv.includes('--watch')` → `createCompiler(loadConfig).watch()`。进程保持：`await` 一个永不 resolve 的 Promise，直到 `close`（测试里调用 close）。usage 改为 `usage: mpb <inspect graph|build|dev>`。禁止 `process.exit`。

- [ ] **Step 1: Write the failing test**

`watchPaths`：手工两节点 graph，断言含 sourcePath 与 srcDir，不含 `.../node_modules/x.js` 即便把它塞进 sourcePath。

`watch()`：tmpdir 写迷你 app，`compiler.watch()`，改 `lib.js`，`vi.waitFor` 最多 2s 断言 dist 更新，然后 `close()`。

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Write minimal implementation + pnpm install in v5/**

- [ ] **Step 4: Run tests** — 全绿。CLI smoke：`node v5/packages/cli/bin/mpb.js` 打印含 `dev`。

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add mpb dev with chokidar watch"
```

---

### Task 5: 叶子 template 无新边（志向场景的可测子集）

**Files:**
- Modify: `v5/packages/core/src/__tests__/watch-tick.test.ts`（追加，不要删旧用例）

**Interfaces:**
- Consumes: Task 3 `applyWatchTick`
- Produces: 覆盖规格 14.2「无新边的叶子 template」：只改 `index.wxml` 文本，`topologyChanged === false`，其它 dest mtime 不变，该 wxml dest 内容更新。

- [ ] **Step 1: Write the failing test**（若 Task 3 已偶然覆盖则本 Task 仍要这条显式断言）

夹具含 index.wxml。run 后改 wxml 文本，tick `changedIds: ['pages/index/index.wxml']`。断言 topologyChanged false、planChanged false、wxml dest 新内容、`index.js` dest mtime 不变。

- [ ] **Step 2: Run test to verify it fails**（若已绿，在报告写明已覆盖并补强断言）

- [ ] **Step 3: 若失败，修 tick/emit skip**

- [ ] **Step 4: 全绿**

- [ ] **Step 5: Commit**

```bash
git commit -m "test(core): lock leaf template watch without retopology"
```

---

## Self-review

- §14.1 监听集：Task 4 `watchPaths`（src、suite 目录、sourcePath；排除 node_modules）。extras/copy/projects 无 P2 实现，不听。
- §14.2 状态机：Task 2 补边/回收；Task 3 谓词；Task 1 删 dest。
- §14.3 磁盘缓存：P2 用「相同字节不 touch」+ hash 判断代替磁盘缓存。`--no-cache` / xxhash 目录留给以后，本计划不装磁盘缓存（避免空壳）。
- `mpb dev`：Task 4。
- 增量正确性：json 新组件、第三分包 shared、删引用 dest 消失、suite 补 template → Task 3；叶子 template → Task 5。
- 不做：platform/ifdef、金样、`mpb analyze`。
