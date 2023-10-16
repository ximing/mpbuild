# mpbuild 5.0 P7 polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 2.0.0 日常 `mpb dev` / 增量 / 样式资源 / source map / 三个空配置字段补成可验收的最小正确集：dev 打印诊断、已入图 `add` 当 change、copy glob 零层且 extras 不每 tick 删、已入图 npm 文件可 watch、wxss `url()` 入图写出、非 minify 独立 `.map`、`componentRelative` / `ABS_PATH_IN_SUBPROJECT` / `resolve.extensions` 真正生效。leftover `.ts` **只改文档**（Node 22.18+ 会执行它）。不实现完整规格 §13。

**Architecture:** 仍只改 `v5/packages/core` 与 `v5/packages/cli`。`compiler.watch` 先 `run()` 并交出首次 `diagnostics`，tick / 配置 reload 经 `onDiagnostics` 回 CLI；CLI 用现有 `printDiagnostics` 打到 stderr 后保持进程。chokidar `add` 若 `graph.nodes` 已有该 id 则进 `changedIds`。`copy()` 的 `**` 匹配零层目录；generate extras dest 经 `preservePaths` 跳过 unlink。`watchPaths` 加入已入图 npm 的 `sourcePath`；`ignored` 不得丢掉这些文件。style extract 抽 `url()`，以 `asset` 入图并按字节 copy。`transformModule` 在 script 且未 minify 时开 SWC `sourceMaps`，emit 写旁路 `.map` + `sourceMappingURL`。`rewriteCode` 读 `output.componentRelative`；`resolveId` 对子仓库 `/` 报 `ABS_PATH_IN_SUBPROJECT`，并用 `config.resolve.extensions` 做补全。

**Tech Stack:** 现有 v5（TypeScript 5、Node >= 20、pnpm 9、vitest、chokidar、`@swc/core`、`lightningcss`）。不新增 glob / micromatch / xxhash / blake3。不改 `CONFIG_NAMES` 顺序。

**Spec:** `docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md` §8 resolve、§9.2 `url()`、§10 `componentRelative`、§11 source map、§14 watch、§15–16 CLI。范围对照 `.superpowers/sdd/project-review-p6/spec-gaps.md` 与 `quality.md`（只作本阶段缺口；P6 已关闭项不要再开）。

## Global Constraints

- 命令名是 `mpb`。npm 包名是 `@mpbuild/core`、`@mpbuild/cli`，版本锁 `2.0.0`。禁止改成 `5.0.0`，禁止改成 `2.0.0-alpha`。禁止新增或发布 `name: "mpbuild"` 且 version 以 `5.` 开头的包。
- 根 `package.json` 保持 `private: true`、`name: "mpbuild-project"`、`version: "4.2.1"`。不要删根脚本 `cs:release` / `"release": "changeset publish"`。
- 实现目录：`v5/packages/core`、`v5/packages/cli`、根 README / `docs/migration-v5.md`、包 README、路线图。不要改图归属公式 / intern 公式 / plan 碰撞规则。
- **2.0.0 公开 Plugin 契约（P6 已冻结，不要扩大）：** `name` + `load?` + `generate?`。官方插件仍是 `legacyScss()` / `projectConfig()` / `copy()`。不要做完整 PluginContext、`copy({ graph: true })` 入图、tt adapter、workers、serial→parallel、`PACKAGE_SIZE`、`EMPTY_ENTRY`、`DYNAMIC_SPECIFIER`、`npmCompat` 补 minify、rebuild chokidar on reload。
- **P6 已关闭，不要再开：** leftover `.ts` 的 unknown-extension 跳过；`reloadConfig` + `importFresh`；`extraWatchFiles` owner map；`@one` companion add；inspect `loadConfig`；`--minify`；`TRANSFORM_FAIL`；`copy()` extras 精确路径；`componentGenerics`；CI test gate；2.0 Plugin = load+generate。
- **Git 推送不写进 implementer Task。** 禁止在本计划 Task 里 `git push`、打 tag、`npm publish`。force-with-lease 推 master + 打 `v2.0.0` 由编排器在 **P7 合入且测试绿之后** 做。`V1` 已备份 4.x。禁止 `git merge origin/master` / rebase origin Snyk。
- `CONFIG_NAMES` 必须保持 `mpbuild.config.ts` → `.mts` → `.js` → `.mjs`（**.js 仍在 .mjs 前**）。**不要改成 js-first。** Node 22.18+ leftover `.ts` 只更新文档。
- 磁盘缓存目录、sha256 键、`--no-cache` 行为保持 P5。缓存 **仍存变换后的 JS 字符串**（不要改成 JSON envelope，`cache.test.ts` 会往缓存文件前缀 `/*CACHE_HIT*/`）。配置 reload **不** `rm` 缓存目录。
- `example/demo` 不要迁进 `v5/packages/example`。不要改 `gold-demo.test.ts` 的 `demoConfig()` 语义。金样对比已忽略 `.map`。
- 测试环境：`eval "$(fnm env)" && fnm use 22`（默认 shell 是 Node 14）。不要为测试开 `--experimental-strip-types`。
- TDD：先写失败测试并跑红，再写最少实现。提交：`git -c trailer.ifexists=doNothing commit`，禁止 `Co-authored-by`，禁止提及 AI / Grok / Claude / Cursor / Generated。
- 中文注释；标识符英文。
- 日常测试继续跑 **src + vitest**，相对路径 `from '../index'`。需要 dist 的 CLI spawn 测试在用例内部自己调 `pnpm build`。
- 本计划提交已把路线图「当前开工」改成 P7。现有 `readme.test.ts` 的 P6 开工断言会红，直到 Task 7 改测试。不要为此回改路线图。
- 每项都必须改 README 或 `docs/migration-v5.md` 至少一句，并在对应 `readme.test.ts` / `migration.test.ts` 加 token（Task 7 一并锁 token，避免每个 Task 改测试夹具互相打架；Task 1–6 先把句子写进文档，Task 7 把 token 断言补齐）。

### 本计划锁定的接口（后面 Task 必须同名同型）

```ts
export function createCompiler(config: ResolvedConfig, options?: CompilerOptions): {
  run(): Promise<CompilerRunResult>
  analyze(): Promise<Omit<CompilerRunResult, 'dests'>>
  applyWatchTick(args: {
    changedIds: string[]
    deletedIds: string[]
    addedRelPaths: string[]
  }): Promise<CompilerTickResult>
  watch(opts?: {
    onDiagnostics?: (diagnostics: Diagnostic[]) => void
  }): Promise<{ close(): Promise<void>; diagnostics: Diagnostic[] }>
}

export async function emitPlan(input: {
  // ...现有字段不变...
  preservePaths?: Iterable<string> // 精确 dest 路径，增量 unlink 跳过（copy extras）
  componentRelative?: boolean // 默认 true；只影响 json 路径类字段
}): Promise<{ diagnostics: Diagnostic[]; dests: string[] }>

export function rewriteCode(input: {
  moduleId: string
  kind: AbstractKind
  code: string
  placement: Placement
  plan: OutputPlan
  componentRelative?: boolean // 默认 true；仅 json
  outputDir?: string // componentRelative === false 时用来拼 leading /
}): string

export function resolveId(req: ResolveRequest): ResolveResult
export interface ResolveRequest {
  request: string
  importer: string
  kind: AbstractKind
  adapter: TargetAdapter
  srcDir: string
  alias?: Record<string, AliasValue>
  projects?: SubProject[]
  virtualIds?: Set<string>
  platform?: string
  extensions?: TargetAdapter['sourceExts'] // 缺省 = adapter.sourceExts
}

export const EdgeKinds = {
  // 现有键不变
  styleUrl: 'style-url',
} as const

export function transformModule(input: {
  kind: AbstractKind
  sourcePath: string
  code: string
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  css?: { lightningcss: boolean }
  minify?: boolean
}): { code: string; map?: string; diagnostics?: Diagnostic[] }
```

诊断码（本阶段新增或首次真正发出）：

| code | severity | 何时 |
|---|---|---|
| `ABS_PATH_IN_SUBPROJECT` | error | 子仓库 importer 解析以 `/` 开头的源码路径（非 alias 展开后的磁盘绝对路径） |

裁定（不要再发明另一套）：

- `watch()`：若 `!didEmit` 则先 `run()`；返回值带这次 `diagnostics`；每次 `run` / `applyWatchTick` / 配置 reload 的 `run` 都调用 `onDiagnostics`（若传入）。CLI **不** `process.exit`；打印后 `await new Promise(() => {})` 保持进程。
- chokidar `add`：`extra` → `changedIds`（P6 已有）；否则 **`input.graph.nodes.has(id)` → `deletedIds.delete(id); changedIds.add(id)`**；否则才 `addedRelPaths`。`startWatch` 的 `graph` 必须每次事件现读（compiler 已用 getter）。
- `applyGraphChange`：`addedRelPaths` 里已存在的 id 并入 `changedIds` 再 `processModule`（与 watcher 双保险；unlink+add 同一 tick 才能重读 `meta.code`）。
- copy `**`：`**/` → `(?:.*/)?`（零或多段，含零层），然后剩下的 `**` → `.*`，然后 `*` → `[^/]*`。`src/*.png` 与 `src/**/*.png` 都能打到 `src/tabbar.png`。`walkFiles` 跳过 `outputDir`（以及现有 `node_modules` / `.git`）。
- extras unlink：`emitPlan` 增加 `preservePaths`（精确路径）。compiler / `applyWatchTick` 记住上次 generate extras dest，下次当作 `preservePaths`。`preserveNames` 仍只用于 basename（`project.config.json`）。不要用 basename 保 `tabbar.png`。
- npm watch：`watchPaths` **加入** `node.sourcePath` 含 `node_modules` 的已入图文件；**不要**加它的 `dirname`；`extraWatchFiles` 含 `node_modules` 的仍丢。chokidar `ignored` 改函数：已入图 npm 文件及其祖先目录不 ignore，其余 `node_modules` 仍 ignore。
- `url()`：只收相对路径和 alias；忽略空、`data:`、`http:`/`https:`、`//`、`#`、`url(var(--x))`、以 `/` 开头的 CSS 绝对路径。WXML `<image src>` 仍不做。边 kind = `EdgeKinds.styleUrl`，resolve kind = `asset`。png 按 **字节** copy，禁止 utf8 roundtrip。
- source map：`node.kind === 'script'` 且该 placement 的 minify 为假 → 独立 `.map` + `//# sourceMappingURL=<basename>.map`。minify true 不写。duplicate 每份 placement 各写一份（默认「每份改写」：URL 相对该 dest）。map **不进** transform 缓存字符串。
- `componentRelative === true`（默认）：json 路径类字段 rewrite 相对该 json dest，结果必须以 `./` 或 `../` 开头。`false`：改成 `'/' + posix 相对 outputDir`（给 4.x `/components/...` 一条路）。script 始终 dest-relative + `ensureDotRelative`。
- `resolve.extensions`：loadConfig 已浅合并到 `config.resolve.extensions`。walker / `resolveId` **必须用它**；按 kind **整表覆盖**，不是 concat。
- leftover `.ts`：不改 `CONFIG_NAMES`、不改 skip 谓词。文档写明 Node 22.18+ 会执行 leftover `.ts`。

---

## File map

```
v5/packages/cli/src/index.ts
v5/packages/core/src/compiler.ts
v5/packages/core/src/watch/watcher.ts
v5/packages/core/src/watch/tick.ts
v5/packages/core/src/graph/patch.ts
v5/packages/core/src/graph/walk.ts
v5/packages/core/src/graph/builder.ts
v5/packages/core/src/graph/extract.ts
v5/packages/core/src/plugin/copy.ts
v5/packages/core/src/compile/emit.ts
v5/packages/core/src/compile/transform.ts
v5/packages/core/src/compile/rewrite.ts
v5/packages/core/src/resolve/resolver.ts
v5/packages/core/src/types.ts
v5/packages/core/src/index.ts          (若需再导出，一般不用)
README.md
docs/migration-v5.md
v5/packages/core/README.md
v5/packages/cli/README.md
v5/packages/core/src/__tests__/dev.test.ts
v5/packages/core/src/__tests__/cli-p6.test.ts   (或新建 cli-p7.test.ts)
v5/packages/core/src/__tests__/watch-tick.test.ts
v5/packages/core/src/__tests__/copy.test.ts
v5/packages/core/src/__tests__/emit-delta.test.ts
v5/packages/core/src/__tests__/watch-extra.test.ts  (npm 文件 watch)
v5/packages/core/src/__tests__/extract.test.ts
v5/packages/core/src/__tests__/build.test.ts        (url png dest)
v5/packages/core/src/__tests__/transform.test.ts
v5/packages/core/src/__tests__/rewrite.test.ts
v5/packages/core/src/__tests__/resolve.test.ts
v5/packages/core/src/__tests__/projects.test.ts
v5/packages/core/src/__tests__/readme.test.ts
v5/packages/core/src/__tests__/migration.test.ts
docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md
```

不改：`gold-demo.test.ts` 的 `demoConfig()` / 金样断言语义、intern / analyze / plan 碰撞公式、根 `package.json` 的 name/version/private 与 `cs:*`、P0–P6 计划原文、`CONFIG_NAMES` 顺序、leftover-ts skip 谓词。

当前事实（写计划时已核对，不要假装不存在）：

- CLI `dev` / `--watch` 只 `await createCompiler(config).watch()`，从不 `printDiagnostics`。`watch()` 内部 `run()` 丢弃 `diagnostics`，返回值只有 `close`。
- chokidar `add`：非 extra 一律 `addedRelPaths`。`attachAddedCompanions` 只挂 suite 伴生，不 `processModule` 已有 script。`emitPlan` `sourceOf` 优先 `node.meta.code` → 编辑器 unlink+add dest 发霉。
- `copy()` `matchGlob`：`**` → `.*`，`src/**/*.png` 要求中间有 `/`，打不中 `src/tabbar.png`。`emitPlan` keep 只有 placement dest；copy dest 每 tick unlink 再 generate 写回。
- `watchPaths` 丢所有含 `${sep}node_modules${sep}` 的路径；chokidar `ignored: /node_modules/`。`dev.test.ts` 显式断言 npm 路径被丢。
- `extractStyle` 只抽带引号的 `@import`。`kindFromExt` 对 `.png` 落到 `script`。`sourceOf` 按 utf8 读。
- `transformSync` 不开 `sourceMaps`。emit 不写 `.map`。
- `rewriteCode` 永远 `ensureDotRelative`，不读 `output.componentRelative`。`resolveId` 的 `/` 相对主 `srcDir`。`tryResolve` / `buildGraph` 只传 `adapter.sourceExts`。
- `readme.test.ts` 仍断言路线图「当前开工：P6」。

---

## 编排器发布（禁止写进 implementer Task）

合入 P7 且全量测试绿之后，由编排器（不是 Task 实现者）做：

1. 确认 `origin/V1`（及本地 `V1`）仍是 4.x 备份（写计划时为 `c98fabe`）。
2. **禁止** `git merge origin/master` / rebase origin 那 2 个 Snyk 提交。
3. `git push --force-with-lease origin master`。
4. 在**已推送的 rewrite commit**上 `git tag v2.0.0` 再 `git push origin v2.0.0`。不要给 `V1` 备份 commit 打 `v2.0.0`。
5. 不要本地 `npm publish` / `pnpm publish` / `changeset publish`。

---

### Task 1: `mpb dev` 打印首次与 tick 诊断

**Files:**
- Modify: `v5/packages/cli/src/index.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/__tests__/dev.test.ts`
- Create: `v5/packages/core/src/__tests__/cli-p7.test.ts`
- Modify: `README.md`、`docs/migration-v5.md`、`v5/packages/cli/README.md`

**Interfaces:**
- Consumes: 现有 `createCompiler`、`printDiagnostics`、`run()` / `applyWatchTick` 的 `diagnostics`
- Produces: `watch(opts?: { onDiagnostics?: (diagnostics: Diagnostic[]) => void }): Promise<{ close(): Promise<void>; diagnostics: Diagnostic[] }>`。首次 `run()` 的 diagnostics 必须在返回值里，且若传入 `onDiagnostics` 则立刻回调。每次 tick 与配置 reload 的 `run()` 也回调。

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/dev.test.ts` 的 `describe('createCompiler watch')` 末尾追加：

```ts
  it('watch() returns first-run MISSING_APP_JS and onDiagnostics sees ticks', async () => {
    const rootDir = await fixture({
      'src/pages/p/p.js': 'Page({})\n',
    })
    const codes: string[] = []
    const compiler = createCompiler(configOf(rootDir))
    const handle = await compiler.watch({
      onDiagnostics: (ds) => {
        codes.push(...ds.map((d) => d.code))
      },
    })
    try {
      expect(handle.diagnostics.some((d) => d.code === 'MISSING_APP_JS')).toBe(true)
      expect(codes).toContain('MISSING_APP_JS')
    } finally {
      await handle.close()
    }
  })
```

新建 `v5/packages/core/src/__tests__/cli-p7.test.ts`：

```ts
import { spawn, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cliDir, v5Dir } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-cli-p7-'))
  dirs.push(rootDir)
  await writeFile(join(rootDir, 'package.json'), JSON.stringify({ type: 'module' }))
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('cli p7 dev diagnostics', () => {
  it('mpb dev prints MISSING_APP_JS to stderr and keeps the process', {
    timeout: 60_000,
  }, async () => {
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)

    const root = await fixture({
      'src/pages/p/p.js': 'Page({})\n',
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: [] }, output: { dir: 'dist' } }\n",
    })
    const child = spawn(process.execPath, [join(cliDir, 'bin/mpb.js'), 'dev'], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr?.on('data', (buf) => {
      stderr += String(buf)
    })
    try {
      await vi.waitFor(
        () => {
          expect(stderr).toContain('MISSING_APP_JS')
        },
        { timeout: 15_000 },
      )
      expect(child.exitCode).toBeNull()
    } finally {
      child.kill('SIGTERM')
      await new Promise<void>((resolve) => {
        child.once('exit', () => resolve())
      })
    }
  })
})
```

根 `README.md`「命令」段 `mpb dev` 那一行附近加一句（测试 token 到 Task 7 再锁）：

`mpb dev` 把首次构建和每次 watch tick 的诊断打印到 stderr（与 `mpb build` 相同），打印后保持进程。

`docs/migration-v5.md` §1 命令列表后加同一句。`v5/packages/cli/README.md` 加同一句。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts src/__tests__/cli-p7.test.ts
```

Expected: FAIL。`watch()` 返回值没有 `diagnostics`，或缺 `MISSING_APP_JS`；`mpb dev` 的 stderr 不含 `MISSING_APP_JS`。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/src/compiler.ts`：`createCompiler` 返回类型里的 `watch()` 改为上面锁定的签名。把 `watch` 换成：

```ts
  async function watch(opts?: {
    onDiagnostics?: (diagnostics: Diagnostic[]) => void
  }): Promise<{ close(): Promise<void>; diagnostics: Diagnostic[] }> {
    let firstDiagnostics: Diagnostic[] = []
    if (!didEmit) {
      const first = await run()
      firstDiagnostics = first.diagnostics
      opts?.onDiagnostics?.(firstDiagnostics)
    }
    const srcDir = resolve(config.rootDir, config.src)
    const projects = (config.projects ?? []).map((project) => ({
      ...project,
      src: resolve(config.rootDir, project.src),
    }))
    const reloadFiles = [
      ...CONFIG_NAMES.map((name) => join(config.rootDir, name)),
      config.configPath,
      typeof config.entry === 'string' ? resolve(config.rootDir, config.entry) : '',
    ].filter((file) => Boolean(file))
    const paths = [...watchPaths(lastGraph, srcDir, projects), ...reloadFiles, ...lastWatchFiles]
    const handle = await startWatch({
      paths,
      srcDir,
      get graph() {
        return lastGraph
      },
      projects,
      reloadFiles,
      onTick: async (batch) => {
        const result = await applyWatchTick(batch)
        opts?.onDiagnostics?.(result.diagnostics)
      },
      onConfigChange: async () => {
        await reloadConfig(config)
        const result = await run()
        opts?.onDiagnostics?.(result.diagnostics)
      },
    })
    return { close: handle.close, diagnostics: firstDiagnostics }
  }
```

`v5/packages/cli/src/index.ts` 的 dev 分支改成：

```ts
  if (argv[2] === 'dev' || argv[2] === '--watch' || (argv[2] === 'build' && argv.includes('--watch'))) {
    const config = await loadOrReport(process.cwd())
    if (!config) {
      return
    }
    await createCompiler(config).watch({ onDiagnostics: printDiagnostics })
    await new Promise<void>(() => {})
    return
  }
```

不要 `process.exit`。不要为 error 结束进程。`printDiagnostics` 已是 `console.error`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts src/__tests__/cli-p7.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/cli/src/index.ts v5/packages/core/src/compiler.ts v5/packages/core/src/__tests__/dev.test.ts v5/packages/core/src/__tests__/cli-p7.test.ts README.md docs/migration-v5.md v5/packages/cli/README.md
git -c trailer.ifexists=doNothing commit -m "fix: print mpb dev diagnostics and keep process"
```

---

### Task 2: 已入图 id 的 chokidar add = change

**Files:**
- Modify: `v5/packages/core/src/watch/watcher.ts`
- Modify: `v5/packages/core/src/graph/patch.ts`
- Modify: `v5/packages/core/src/__tests__/dev.test.ts`
- Modify: `README.md`、`docs/migration-v5.md`

**Interfaces:**
- Consumes: `startWatch` 的 `input.graph`（现读）、`applyGraphChange` 的 `addedRelPaths` / `changedIds`
- Produces: 已入图 id 的 `add` 进入 `changedIds` 并 `processModule`；unlink+write 同路径后 dest 内容更新

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/dev.test.ts` 追加（沿用文件里已有的 `fixture` / `configOf` / `writeRel`）：

```ts
  it('unlink then write of an in-graph file updates dest content', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': "require('./lib')\n",
      'src/pages/index/lib.js': 'module.exports = 1\n',
    })
    const compiler = createCompiler(configOf(rootDir))
    const handle = await compiler.watch()
    try {
      const src = join(rootDir, 'src/pages/index/lib.js')
      const dest = join(rootDir, 'dist/pages/index/lib.js')
      expect(await readFile(dest, 'utf8')).toContain('1')
      await rm(src)
      await writeFile(src, "module.exports = 'after-atomic-save'\n")
      await vi.waitFor(
        async () => {
          expect(await readFile(dest, 'utf8')).toContain('after-atomic-save')
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }
  })
```

文件顶部 import 补 `rm`（已从 `node:fs/promises` 引入则复用）。`vi` 已从 vitest 引入。

根 README watch 相关段加一句：

已入图文件的 chokidar `add` 当作内容变更（编辑器 unlink 再 add 会更新 dest）。

`docs/migration-v5.md` 对照表或 § 末加同一句。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts
```

Expected: FAIL。dest 仍是旧 `module.exports = 1`（`addedRelPaths` 只走 companion，`meta.code` 不重读）。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/src/watch/watcher.ts` 的 `add` 处理改成：

```ts
  watcher.on('add', (filePath) => {
    if (shouldReload(filePath, input.reloadFiles)) {
      configChanged = true
    } else {
      const { id, extra } = classify(filePath)
      if (extra) {
        changedIds.add(id)
      } else if (input.graph.nodes.has(id)) {
        deletedIds.delete(id)
        changedIds.add(id)
      } else {
        deletedIds.delete(id)
        addedRelPaths.add(id)
      }
    }
    schedule()
  })
```

`v5/packages/core/src/graph/patch.ts` 在 `removeDeleted` 之后、`attachAddedCompanions` 之前把已存在的 added 并进 changed：

```ts
  removeDeleted(walk, deletedIds)

  const posixAdded = addedRelPaths.map((rel) => rel.split(/[\\/]/).join('/'))
  const changed = [...changedIds]
  const added: string[] = []
  for (const id of posixAdded) {
    if (walk.nodes.has(id)) {
      if (!changed.includes(id)) {
        changed.push(id)
      }
    } else {
      added.push(id)
    }
  }

  const existed = new Set(walk.nodes.keys())
  for (const id of existed) {
    walk.visited.add(id)
  }

  attachAddedCompanions(walk, added)

  for (const id of changed) {
    if (!existed.has(id) || !walk.nodes.has(id)) {
      continue
    }
    dropOutgoing(walk, id)
    await processModule(walk, id)
    removeFromQueue(walk, id)
  }
```

`processModule` 会重读磁盘并覆盖 `meta.code`。不要改 intern 公式。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts src/__tests__/watch-tick.test.ts src/__tests__/graph-patch.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/watch/watcher.ts v5/packages/core/src/graph/patch.ts v5/packages/core/src/__tests__/dev.test.ts README.md docs/migration-v5.md
git -c trailer.ifexists=doNothing commit -m "fix: treat in-graph watch add as content change"
```

---

### Task 3: copy glob 零层匹配 + extras dest 不每 tick 删

**Files:**
- Modify: `v5/packages/core/src/plugin/copy.ts`
- Modify: `v5/packages/core/src/compile/emit.ts`
- Modify: `v5/packages/core/src/watch/tick.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/__tests__/copy.test.ts`
- Modify: `v5/packages/core/src/__tests__/emit-delta.test.ts`
- Modify: `README.md`、`docs/migration-v5.md`

**Interfaces:**
- Consumes: 现有 `copy()` extras generate、`emitPlan` unlink、`applyWatchTick` + compiler generate
- Produces: `matchGlob` 使 `**` 匹配零层；`emitPlan({ preservePaths })` 跳过精确 extras dest；compiler 记住上次 extras dests

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/copy.test.ts` 的 `describe('copy()')` 追加：

```ts
  it('copy(src/**/*.png) hits src/tabbar.png and keeps dest after applyWatchTick', async () => {
    const png = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4])
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({})\n',
      'src/tabbar.png': png,
    })
    const compiler = createCompiler(configOf(rootDir, [copy('src/**/*.png')]))
    await compiler.run()
    const dest = join(rootDir, 'dist/tabbar.png')
    expect(existsSync(dest)).toBe(true)
    expect(Buffer.from(await readFile(dest)).equals(png)).toBe(true)

    await writeFile(join(rootDir, 'src/pages/p/p.js'), 'Page({ x: 1 })\n')
    await compiler.applyWatchTick({
      changedIds: ['pages/p/p.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(existsSync(dest)).toBe(true)
    expect(Buffer.from(await readFile(dest)).equals(png)).toBe(true)
  })
```

在 `v5/packages/core/src/__tests__/emit-delta.test.ts` 追加：

```ts
  it('skips unlink for preservePaths extras that are not placements', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-emit-copy-'))
    dirs.push(rootDir)
    const outputDir = join(rootDir, 'dist')
    const srcA = join(rootDir, 'a.js')
    await writeFile(srcA, 'module.exports = 1\n')
    await mkdir(outputDir, { recursive: true })
    const extra = join(outputDir, 'tabbar.png')
    await writeFile(extra, Buffer.from([1, 2, 3, 4]))
    const destA = join(outputDir, 'a.js')
    const graph: ModuleGraph = {
      entries: ['a.js'],
      nodes: new Map([['a.js', mod('a.js', srcA)]]),
      edges: [],
      packages: [],
    }
    const js = { target: 'es2018', module: 'commonjs' } as const
    await emitPlan({
      graph,
      plan: { placements: [{ moduleId: 'a.js', destPath: destA, package: 'main' }], rewrites: [] },
      outputDir,
      clean: false,
      js,
      previousDests: [destA, extra],
      preserveNames: ['project.config.json'],
      preservePaths: [extra],
    })
    expect(existsSync(extra)).toBe(true)
    expect(Buffer.from(await readFile(extra))).toEqual(Buffer.from([1, 2, 3, 4]))
  })
```

根 README `copy(` 示例附近加：

`copy('src/**/*.png')` 能匹配 `src/tabbar.png`（`**` 含零层目录）；copy 产物在 watch tick 中保留，不会每拍删掉。

`docs/migration-v5.md` Copy 行或 §6 加同一意思。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/copy.test.ts src/__tests__/emit-delta.test.ts
```

Expected: FAIL。`src/**/*.png` 打不中 `src/tabbar.png`；`preservePaths` 不存在故 extra png 被 unlink。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/src/plugin/copy.ts` 的 `matchGlob` 换成：

```ts
function matchGlob(rel: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*')
  return new RegExp(`^${escaped}$`).test(rel)
}
```

`expandPattern` / `walkFiles` 增加跳过 `outputDir`：把 `outputDir` 传入 `expandPattern(rootDir, pattern, outputDir)`。`walkFiles` 遇到 `resolve(abs) === resolve(outputDir)` 或 `abs` 以 `outputDir + sep` 开头的目录则 `continue`。

`v5/packages/core/src/compile/emit.ts` 的 `emitPlan` input 增加 `preservePaths?: Iterable<string>`。unlink 循环：

```ts
  const keep = new Set(dests)
  const preserve = new Set((input.preserveNames ?? []).map((name) => basename(name)))
  const preservePaths = new Set(input.preservePaths ?? [])
  for (const prev of input.previousDests ?? []) {
    if (keep.has(prev) || preserve.has(basename(prev)) || preservePaths.has(prev)) {
      continue
    }
    try {
      await unlink(prev)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err
      }
    }
  }
```

`v5/packages/core/src/compiler.ts`：增加 `let lastExtraDests: string[] = []`。`run()` 里 `emitPlan` 传 `preservePaths: lastExtraDests`；generate 之后 `lastExtraDests = extras.dests`。`applyWatchTick` 同样把 `preservePaths: lastExtraDests` 传给 `applyWatchTickOnce`，generate 后再赋值 `lastExtraDests`。

`v5/packages/core/src/watch/tick.ts` 的 input 增加 `preservePaths?: Iterable<string>`，原样传给 `emitPlan`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/copy.test.ts src/__tests__/emit-delta.test.ts src/__tests__/watch-generate.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/plugin/copy.ts v5/packages/core/src/compile/emit.ts v5/packages/core/src/watch/tick.ts v5/packages/core/src/compiler.ts v5/packages/core/src/__tests__/copy.test.ts v5/packages/core/src/__tests__/emit-delta.test.ts README.md docs/migration-v5.md
git -c trailer.ifexists=doNothing commit -m "fix: copy glob zero-dir match and keep extras dests"
```

---

### Task 4: 已入图 npm 文件要 watch

**Files:**
- Modify: `v5/packages/core/src/watch/watcher.ts`
- Modify: `v5/packages/core/src/__tests__/dev.test.ts`
- Create: `v5/packages/core/src/__tests__/watch-npm.test.ts`
- Modify: `README.md`、`docs/migration-v5.md`

**Interfaces:**
- Consumes: `watchPaths` / `startWatch` / `createCompiler.watch`
- Produces: 已入图且 `sourcePath` 含 `node_modules` 的**该文件**出现在 watch 集；改它之后 dest 更新。仍不整棵 watch `node_modules`

- [ ] **Step 1: Write the failing test**

把 `dev.test.ts` 里现有用例 `includes sourcePath and srcDir, drops node_modules even when in the graph` **改名并改断言**（这是 P6 过时锁；本 Task 翻转「sourcePath 在图里」这一条，extraWatchFiles 仍丢）：

```ts
  it('includes in-graph npm sourcePath files but not extraWatchFiles under node_modules', () => {
    const srcDir = join('/proj', 'src')
    const appPath = join(srcDir, 'app.js')
    const npmPath = join(srcDir, 'node_modules', 'x.js')
    const npmExtra = join(srcDir, 'node_modules', 'pkg', 'mix.js')
    const projectSrc = join('/proj', 'projects', 'one')
    const graph: ModuleGraph = {
      entries: ['app.js'],
      nodes: new Map([
        ['app.js', mod('app.js', appPath)],
        ['node_modules/x.js', mod('node_modules/x.js', npmPath)],
        [
          'lib.js',
          {
            ...mod('lib.js', join(srcDir, 'lib.js')),
            extraWatchFiles: [npmExtra],
          },
        ],
      ]),
      edges: [],
      packages: [],
    }

    const paths = watchPaths(graph, srcDir, [{ name: '@one', src: projectSrc, alias: {} }])
    expect(paths).toContain(appPath)
    expect(paths).toContain(srcDir)
    expect(paths).toContain(projectSrc)
    expect(paths).toContain(npmPath)
    expect(paths).not.toContain(npmExtra)
    expect(paths).not.toContain(dirname(npmPath))
  })
```

需要 `import { dirname } from 'node:path'`（文件已从 `path` 取 `join`/`sep`，补 `dirname`）。

新建 `v5/packages/core/src/__tests__/watch-npm.test.ts`：

```ts
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCompiler, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-npm-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

function configOf(rootDir: string): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    entry: { pages: [] },
    output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
    resolve: { alias: {}, extensions: weappAdapter.sourceExts },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    configPath: '',
  }
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('watch in-graph npm files', () => {
  it('updates dest after an in-graph npm module changes', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': "require('leftpad')\n",
      'node_modules/leftpad/package.json': JSON.stringify({ name: 'leftpad', main: 'index.js' }),
      'node_modules/leftpad/index.js': "module.exports = 'v1'\n",
    })
    const compiler = createCompiler(configOf(rootDir))
    const handle = await compiler.watch()
    try {
      const dest = join(rootDir, 'dist/npm/leftpad/index.js')
      expect(existsSync(dest)).toBe(true)
      expect(await readFile(dest, 'utf8')).toContain('v1')
      await writeFile(join(rootDir, 'node_modules/leftpad/index.js'), "module.exports = 'v2-npm-watch'\n")
      await vi.waitFor(
        async () => {
          expect(await readFile(dest, 'utf8')).toContain('v2-npm-watch')
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }
  })
})
```

README 加：已入图的 npm 文件会单独加入 watch，不会整棵监听 `node_modules`。

migration 加同一句。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts src/__tests__/watch-npm.test.ts
```

Expected: FAIL。`watchPaths` 不含 npm `sourcePath`；改 `node_modules/leftpad/index.js` dest 不更新。

- [ ] **Step 3: Write minimal implementation**

`watchPaths`：

```ts
  for (const node of graph.nodes.values()) {
    if (!node.sourcePath) {
      continue
    }
    if (hasNodeModules(node.sourcePath)) {
      paths.add(node.sourcePath)
      continue
    }
    paths.add(node.sourcePath)
    if (node.kind === 'script') {
      paths.add(dirname(node.sourcePath))
    }
    for (const extra of node.extraWatchFiles ?? []) {
      if (extra && !hasNodeModules(extra)) {
        paths.add(extra)
      }
    }
  }
```

`startWatch` 里 `ignored` 换成函数。先收集 keep：

```ts
  const keepNpm = new Set(
    input.paths.filter((p) => p.includes(NODE_MODULES_SEG) || p.includes('/node_modules/')).map((p) => resolve(p)),
  )
  const watcher = chokidar.watch(input.paths, {
    ignoreInitial: true,
    ignored: (filePath: string) => {
      const abs = resolve(filePath)
      if (keepNpm.has(abs)) {
        return false
      }
      for (const keep of keepNpm) {
        if (keep === abs || keep.startsWith(`${abs}${sep}`)) {
          return false
        }
      }
      return /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(filePath)
    },
  })
```

祖先目录必须不 ignore，否则 chokidar 加不上文件。不要 watch 整棵 `node_modules` 目录（`watchPaths` 不加它）。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts src/__tests__/watch-npm.test.ts src/__tests__/watch-extra.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/watch/watcher.ts v5/packages/core/src/__tests__/dev.test.ts v5/packages/core/src/__tests__/watch-npm.test.ts README.md docs/migration-v5.md
git -c trailer.ifexists=doNothing commit -m "fix: watch in-graph npm files without the whole tree"
```

---

### Task 5: wxss/css `url()` 入图并 copy/emit

**Files:**
- Modify: `v5/packages/core/src/types.ts`（`EdgeKinds.styleUrl`）
- Modify: `v5/packages/core/src/graph/extract.ts`
- Modify: `v5/packages/core/src/graph/walk.ts`
- Modify: `v5/packages/core/src/compile/emit.ts`
- Modify: `v5/packages/core/src/compile/rewrite.ts`
- Modify: `v5/packages/core/src/__tests__/extract.test.ts`
- Modify: `v5/packages/core/src/__tests__/build.test.ts`
- Modify: `README.md`、`docs/migration-v5.md`

**Interfaces:**
- Consumes: `extractEdges` style、`tryResolve` / `intern` / `emitPlan` / `rewriteCode`
- Produces: `background:url('./x.png')` 后 dist 有该 png；忽略 `data:` / 空 / 绝对 URL / `#` / `var(`

- [ ] **Step 1: Write the failing test**

`v5/packages/core/src/__tests__/extract.test.ts` 追加：

```ts
  it('extracts style url() relative paths and skips data/empty/absolute/hash/var', () => {
    const edges = extractEdges({
      id: '/a.wxss',
      kind: 'style',
      adapter: weappAdapter,
      code: [
        ".a{background:url('./x.png')}",
        ".b{background:url(\"./y.png\")}",
        '.c{background:url(data:image/png;base64,aaa)}',
        '.d{background:url()}',
        '.e{background:url(https://ex/z.png)}',
        '.f{background:url(#icon)}',
        '.g{background:url(var(--x))}',
        '@import "./mix.wxss";',
      ].join('\n'),
    })
    const raws = edges.map((e) => e.raw).sort()
    expect(raws).toEqual(['./mix.wxss', './x.png', './y.png'].sort())
    expect(edges.find((e) => e.raw === './x.png')?.kind).toBe(EdgeKinds.styleUrl)
  })
```

`v5/packages/core/src/__tests__/build.test.ts` 追加：

```ts
  it('copies url() assets next to rewritten wxss', async () => {
    const png = Buffer.from([137, 80, 78, 71, 9, 8, 7, 6])
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({})\n',
      'src/pages/p/p.wxss': ".a{background:url('./x.png')}",
    })
    await writeFile(join(rootDir, 'src/pages/p/x.png'), png)
    const { diagnostics } = await createCompiler(configOf(rootDir)).run()
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    const dest = join(rootDir, 'dist/pages/p/x.png')
    expect(existsSync(dest)).toBe(true)
    expect(Buffer.from(await readFile(dest)).equals(png)).toBe(true)
    const wxss = await readFile(join(rootDir, 'dist/pages/p/p.wxss'), 'utf8')
    expect(wxss).toMatch(/url\(\s*['"]?\.\/x\.png['"]?\s*\)/)
  })
```

`fixture` 当前是 `Record<string, string>`，png 用 `writeFile` 在用例里写 Buffer（如上）。`readFile` 已从 `fs/promises` 引入。

README：wxss/css 里的 `url('./x.png')` 会入图并写出到 dist；忽略 `data:`、空、绝对 URL。WXML `<image src>` 仍不抽。

migration 加同一句。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/extract.test.ts src/__tests__/build.test.ts
```

Expected: FAIL。`extractStyle` 没有 `./x.png`；dist 没有 png。

- [ ] **Step 3: Write minimal implementation**

`types.ts` 的 `EdgeKinds` 增加 `styleUrl: 'style-url'`。

`extract.ts` 的 `extractStyle` 在 `@import` 循环之后抽 `url()`：

```ts
  const urlRe = /url\(\s*(?:'([^']*)'|"([^"]*)"|([^'")\s]+))\s*\)/gi
  while ((match = urlRe.exec(code)) !== null) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? '').trim()
    if (shouldSkipStyleUrl(raw)) {
      continue
    }
    if (edges.some((edge) => edge.raw === raw)) {
      continue
    }
    edges.push({ raw, kind: EdgeKinds.styleUrl })
  }
```

```ts
function shouldSkipStyleUrl(raw: string): boolean {
  if (!raw) {
    return true
  }
  if (/^(data:|https?:|plugin:|wxfile:|#)/i.test(raw)) {
    return true
  }
  if (raw.startsWith('//') || raw.startsWith('/') || /^var\(/i.test(raw)) {
    return true
  }
  return false
}
```

需要从 `../types.js` 把 `EdgeKinds` 的新键用于 extract（已 import）。

`walk.ts` `targetKindFromEdge`：

```ts
    case EdgeKinds.styleUrl:
      return 'asset'
```

`processModule` 里 intern 之后：

```ts
    const resolveKind = targetKindFromEdge(extracted.kind)
    const to = result.external
      ? result.id
      : intern(
          walk,
          result.id,
          extracted.kind === EdgeKinds.usingComponent ? 'component' : undefined,
          result.extraWatchFiles,
        )
    if (!result.external && resolveKind === 'asset') {
      const created = walk.nodes.get(to)
      if (created) {
        created.kind = 'asset'
      }
    }
```

`processModule` 读盘之前：若 `node.kind === 'asset'`，按字节 hash 后 `return`（不 extract、不 utf8）：

```ts
  if (node.kind === 'asset') {
    if (!isVirtualNode(node) && node.sourcePath) {
      const buf = await readFile(node.sourcePath)
      node.hash = createHash('sha256').update(buf).digest('hex')
    }
    return
  }
  if (!isVirtualNode(node)) {
    node.kind = kindFromExt(node.sourcePath, walk.adapter)
  }
```

注意：现有代码是无条件 `node.kind = kindFromExt(...)`。必须 **先** 尊重已标成 `asset` 的节点，否则 png 又变 script。把 kindFromExt 挪到 asset 早退之后。

`emitPlan` 在读 `sourceOf` 之前：

```ts
    if (node.kind === 'asset') {
      if (!node.sourcePath) {
        continue
      }
      const bytes = await readFile(node.sourcePath)
      await mkdir(dirname(placement.destPath), { recursive: true })
      await writeFile(placement.destPath, bytes)
      continue
    }
```

`plan.ts` 的 `emitExt('asset')` 已返回 `''` 并 `replaceExt` 在 ext 为空时保留原扩展名。不要改 intern 公式。

`rewrite.ts` 的 `rewriteStyle` 在 `@import` 替换之外增加 `url(` 替换：

```ts
    out = out.replace(
      new RegExp(`(url\\(\\s*)(["']?)${escaped}\\2(\\s*\\))`, 'g'),
      (_m, prefix: string, quote: string, suffix: string) => `${prefix}${quote}${dest}${quote}${suffix}`,
    )
```

`resolveId`：`kind === 'asset'` 时与 template/style 一样，无 `./` 前缀也相对 importer 补全（`toCandidate` 之后的那段 `if (kind === 'template' || kind === 'style')` 加上 `|| kind === 'asset'`）。`./x.png` 走 `toCandidate` 的 `.` 分支即可。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/extract.test.ts src/__tests__/build.test.ts src/__tests__/rewrite.test.ts src/__tests__/gold-demo.test.ts
```

Expected: PASS（金样无 `url(`，不应变红）。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/types.ts v5/packages/core/src/graph/extract.ts v5/packages/core/src/graph/walk.ts v5/packages/core/src/compile/emit.ts v5/packages/core/src/compile/rewrite.ts v5/packages/core/src/resolve/resolver.ts v5/packages/core/src/__tests__/extract.test.ts v5/packages/core/src/__tests__/build.test.ts README.md docs/migration-v5.md
git -c trailer.ifexists=doNothing commit -m "feat: intern and emit css url() assets"
```

---

### Task 6: 非 minify 的 script 写独立 `.map`

**Files:**
- Modify: `v5/packages/core/src/compile/transform.ts`
- Modify: `v5/packages/core/src/compile/emit.ts`
- Modify: `v5/packages/core/src/__tests__/build.test.ts`
- Modify: `v5/packages/core/src/__tests__/transform.test.ts`
- Modify: `README.md`、`docs/migration-v5.md`

**Interfaces:**
- Consumes: `transformModule` / `emitPlan` / `minifyOf`
- Produces: `compile.minify` 为假时 script dest 旁有 `.map`，JS 含 `sourceMappingURL`。minify true 不写。缓存仍存 JS 字符串

- [ ] **Step 1: Write the failing test**

`transform.test.ts` 追加：

```ts
  it('returns a source map for script when not minifying', () => {
    const { code, map } = transformModule({
      kind: 'script',
      sourcePath: '/x.js',
      code: 'export const n = 1\n',
      js: { target: 'es2018', module: 'commonjs' },
      minify: false,
    })
    expect(code).toContain('exports')
    expect(typeof map).toBe('string')
    expect(map).toContain('"version"')
  })

  it('does not return a source map when minify is true', () => {
    const { map } = transformModule({
      kind: 'script',
      sourcePath: '/x.js',
      code: 'export const n = 1\n',
      js: { target: 'es2018', module: 'commonjs' },
      minify: true,
    })
    expect(map).toBeUndefined()
  })
```

`build.test.ts` 追加：

```ts
  it('writes an independent .map next to unminified js', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({ hello: 1 })\n',
    })
    await createCompiler(configOf(rootDir)).run()
    const js = join(rootDir, 'dist/pages/p/p.js')
    const map = `${js}.map`
    expect(existsSync(map)).toBe(true)
    expect(await readFile(js, 'utf8')).toContain('sourceMappingURL=p.js.map')
    const minifyCfg = configOf(rootDir)
    minifyCfg.compile = { ...minifyCfg.compile, minify: true }
    await createCompiler(minifyCfg).run()
    expect(await readFile(js, 'utf8')).not.toContain('sourceMappingURL')
  })
```

第二次 `run()` 是新 compiler，`output.clean` 默认 true 会清 dist。不要依赖「旧 .map 还在」。断言 minify 后 JS 无 `sourceMappingURL` 即可；若实现选择删旧 map 更好，但不作为本测试硬性。

README：`compile.minify` 为假时 script 默认写出独立 `.map` 和 `sourceMappingURL`。

migration 加同一句。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/transform.test.ts src/__tests__/build.test.ts
```

Expected: FAIL。`map` 为 undefined；dist 无 `.map`。

- [ ] **Step 3: Write minimal implementation**

`transform.ts`：`transformModule` 返回 `{ code, map?, diagnostics? }`。`transformScript` 改为返回 `{ code, map? }`：

```ts
  const result = transformSync(input.code, {
    filename: input.sourcePath,
    jsc: {
      parser: isTs
        ? { syntax: 'typescript', tsx: jsx }
        : { syntax: 'ecmascript', jsx },
      target: input.kind === 'script-module' ? 'es2015' : input.js.target,
    },
    module: {
      type: input.js.module === 'es6' ? 'es6' : 'commonjs',
    },
    minify,
    sourceMaps: input.kind === 'script' && !minify,
  })
  return input.kind === 'script' && !minify && result.map
    ? { code: result.code, map: result.map }
    : { code: result.code }
```

`transformModule` 的 script 分支 `return transformScript(...)`（带 map）。style/json 仍无 map。

`npmCompat` 现直接 `return transformModule(input)`，会带上 map。`emitPlan` 的 npmCompat 路径同样写 map。

`emit.ts`：缓存 **只存 `code` 字符串**（保持 `writeTransformCache(cacheDir, key, code)`）。在 rewrite 之后：

```ts
    let map: string | undefined
    // 在 cache miss 的 transform 结果上取 transformed.map
```

把 cache miss 分支的 `transformed` 留在外层：

```ts
    let map: string | undefined
    if (code === undefined) {
      try {
        const transformed = useNpmCompat ? npmCompat({...}) : transformModule({...})
        code = transformed.code
        map = transformed.map
        ...
      } catch ...
    }
    const rewritten = rewriteCode({...})
    let out = rewritten
    const writeMap = node.kind === 'script' && !minifyFlag && typeof map === 'string'
    const mapPath = `${placement.destPath}.map`
    if (writeMap) {
      out = `${rewritten}\n//# sourceMappingURL=${basename(mapPath)}\n`
    }
    await mkdir(dirname(placement.destPath), { recursive: true })
    if (!(await sameUtf8(placement.destPath, out))) {
      await writeFile(placement.destPath, out)
    }
    if (writeMap) {
      await writeFile(mapPath, map)
      dests.push(mapPath)
    }
```

`dests` 初始是 placement dests。把 mapPath push 进去，下次 tick keep 住它们，避免当垃圾 unlink。

cache hit 时没有 map：不追加 `sourceMappingURL`、不写 map（旧 map 若已在 previousDests/dests 则 keep）。第一次构建（测试场景）是 miss，会写 map。不要改 cache 文件格式。

`sameUtf8` 的 `continue` 不要在写 map 之前整 placement `continue`；把「跳过 JS 写」和「写 map」拆开，如上。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/transform.test.ts src/__tests__/build.test.ts src/__tests__/cache.test.ts src/__tests__/gold-demo.test.ts
```

Expected: PASS。金样忽略 `.map`。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/compile/transform.ts v5/packages/core/src/compile/emit.ts v5/packages/core/src/plugin/npm-compat.ts v5/packages/core/src/__tests__/transform.test.ts v5/packages/core/src/__tests__/build.test.ts README.md docs/migration-v5.md
git -c trailer.ifexists=doNothing commit -m "feat: emit independent js source maps when not minifying"
```

若 `npm-compat.ts` 返回类型随 `transformModule` 自然兼容，可以不改文件；不要为它补 minify。

---

### Task 7: `componentRelative` / `ABS_PATH_IN_SUBPROJECT` / `resolve.extensions` + leftover `.ts` 文档

**Files:**
- Modify: `v5/packages/core/src/compile/rewrite.ts`
- Modify: `v5/packages/core/src/compile/emit.ts`
- Modify: `v5/packages/core/src/watch/tick.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/resolve/resolver.ts`
- Modify: `v5/packages/core/src/graph/walk.ts`
- Modify: `v5/packages/core/src/graph/builder.ts`
- Modify: `v5/packages/core/src/graph/patch.ts`
- Modify: `v5/packages/core/src/__tests__/rewrite.test.ts`
- Modify: `v5/packages/core/src/__tests__/resolve.test.ts`
- Modify: `v5/packages/core/src/__tests__/projects.test.ts`
- Modify: `v5/packages/core/src/__tests__/build.test.ts`（extensions 走 compiler）
- Modify: `v5/packages/core/src/__tests__/readme.test.ts`
- Modify: `v5/packages/core/src/__tests__/migration.test.ts`
- Modify: `README.md`、`docs/migration-v5.md`、`v5/packages/core/README.md`

**Interfaces:**
- Consumes: `ResolvedConfig.output.componentRelative`、`config.resolve.extensions`、`projectForPath`
- Produces: true 时 json 路径以 `./` 或 `../` 开头；子仓库 `/` → `ABS_PATH_IN_SUBPROJECT`；`resolve.extensions` 覆盖该 kind 的 `sourceExts`。leftover `.ts` **只文档**

- [ ] **Step 1: Write the failing test**

`rewrite.test.ts` 把现有 `writes dest-relative specifier at json rewritePath when componentRelative` 的断言加强为：

```ts
    const value = JSON.parse(code).usingComponents.x as string
    expect(value.startsWith('./') || value.startsWith('../')).toBe(true)
    expect(value).toBe('../../components/comp.js')
```

（若该用例已是这个值，再追加 `false` 用例。）

追加：

```ts
  it('rewrites json paths from outputDir with a leading slash when componentRelative is false', () => {
    const jsonPlacement: Placement = {
      moduleId: 'pages/index/index.json',
      destPath: 'dist/pages/index/index.json',
      package: 'main',
    }
    const comp: Placement = {
      moduleId: 'components/comp.js',
      destPath: 'dist/components/comp.js',
      package: 'main',
    }
    const plan = planOf([jsonPlacement, comp], [
      {
        from: 'pages/index/index.json',
        raw: '/components/comp',
        destSpecifier: 'components/comp.js',
        placementPackage: 'main',
        rewritePath: '/usingComponents/x',
      },
    ])
    const code = rewriteCode({
      moduleId: 'pages/index/index.json',
      kind: 'json',
      code: `{"usingComponents":{"x":"/components/comp"}}`,
      placement: jsonPlacement,
      plan,
      componentRelative: false,
      outputDir: 'dist',
    })
    expect(JSON.parse(code).usingComponents.x).toBe('/components/comp.js')
  })
```

`resolve.test.ts` 追加：

```ts
  it('throws ABS_PATH_IN_SUBPROJECT for / from a subproject importer', async () => {
    const { root, srcDir, base } = await fixture()
    const projectSrc = join(root, 'projects', 'one')
    await mkdir(join(projectSrc, 'pages'), { recursive: true })
    await writeFile(join(srcDir, 'b.js'), 'export default 2\n')
    const importer = join(projectSrc, 'pages', 'x.js')
    await writeFile(importer, '')
    expect(() =>
      resolveId({
        ...base,
        importer,
        request: '/b',
        projects: [{ name: '@one', src: projectSrc, alias: {} }],
      }),
    ).toThrow(/ABS_PATH_IN_SUBPROJECT/)
  })

  it('uses resolve.extensions instead of adapter.sourceExts when provided', async () => {
    const { srcDir, base } = await fixture()
    await writeFile(join(srcDir, 'b.mjs'), 'export default 2\n')
    expect(
      resolveId({
        ...base,
        request: './b',
        extensions: {
          ...weappAdapter.sourceExts,
          script: ['.mjs'],
        },
      }),
    ).toEqual({ id: join(srcDir, 'b.mjs') })
  })
```

`projects.test.ts` 追加（走 `buildGraph`，证明 walker 发出诊断而不是静默相对主 src）：

```ts
  it('diagnoses ABS_PATH_IN_SUBPROJECT when a subproject file imports /', async () => {
    const { rootDir, srcDir } = await fixture({
      'src/app.js': `require('@one/pages/x')\n`,
      'src/abs.js': `module.exports = 1\n`,
      'projects/one/pages/x.js': `require('/abs')\n`,
    })
    const projectSrc = join(rootDir, 'projects', 'one')
    const { diagnostics } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join('src', 'app.js')],
      alias: { '@one': projectSrc },
      projects: [{ name: '@one', src: projectSrc, alias: {} }],
    })
    expect(diagnostics.some((d) => d.code === 'ABS_PATH_IN_SUBPROJECT')).toBe(true)
  })
```

`build.test.ts` 追加 extensions 经 compiler：

```ts
  it('resolves extra script extensions from config.resolve.extensions', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': "require('./lib')\n",
      'src/pages/p/lib.mjs': 'export const n = 1\n',
    })
    const cfg = configOf(rootDir)
    cfg.resolve = {
      alias: {},
      extensions: { ...weappAdapter.sourceExts, script: ['.mjs', '.js'] },
    }
    const { diagnostics } = await createCompiler(cfg).run()
    expect(diagnostics.filter((d) => d.code === 'RESOLVE_MISS')).toEqual([])
    expect(existsSync(join(rootDir, 'dist/pages/p/lib.js'))).toBe(true)
  })
```

`readme.test.ts`：把 `marks P6 as current work` 改成 P7：

```ts
  it('marks P7 as current work without editing P0-P3 acceptance lines', () => {
    const roadmap = readFileSync(
      join(repoRoot, 'docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md'),
      'utf8',
    )
    expect(roadmap).toMatch(/当前开工：P7/)
    expect(roadmap).toContain('2026-08-20-mpbuild-v5-p7-polish.md')
    expect(roadmap).toContain('2026-08-20-mpbuild-v5-p6-harden.md')
    expect(roadmap).toContain('2026-08-20-mpbuild-v5-p5-ship.md')
    expect(roadmap).toContain('2026-08-19-mpbuild-v5-p4-release.md')
    expect(roadmap).toContain('`mpb inspect graph` 打出节点/边；假 adapter 快照通过')
    expect(roadmap).toContain(
      '`mpb build` 打出页面四件套；`plugin://` 不失败；命令为 `mpb`；4.x 包删除',
    )
    expect(roadmap).toContain('Watch 状态机 + `mpb dev` + 增量正确性用例')
    expect(roadmap).toContain('`example/demo` 语义对比 CI')
  })
```

同一文件的 root README 用例追加 token（必须都在 README 正文出现）：

```ts
    expect(readme).toContain('打印后保持进程')
    expect(readme).toContain('unlink')
    expect(readme).toContain('src/**/*.png')
    expect(readme).toContain('零层')
    expect(readme).toContain('已入图')
    expect(readme).toContain('node_modules')
    expect(readme).toContain("url('./x.png')")
    expect(readme).toContain('sourceMappingURL')
    expect(readme).toContain('componentRelative')
    expect(readme).toContain('ABS_PATH_IN_SUBPROJECT')
    expect(readme).toContain('resolve.extensions')
    expect(readme).toContain('22.18')
```

`migration.test.ts` 的 `required` 数组追加：`'打印后保持进程'`、`'src/**/*.png'`、`'url('`、`'sourceMappingURL'`、`'ABS_PATH_IN_SUBPROJECT'`、`'resolve.extensions'`、`'22.18'`。已有 `ABS_PATH_IN_SUBPROJECT` 则不要重复。已有「子仓库内不要用以 `/` 开头」——本 Task 要让这句话变成真的。

**leftover `.ts` 文档句（不要改 `load.ts` / `CONFIG_NAMES`）：**

README 配置加载段加：Node 22.18+ 会对 leftover `mpbuild.config.ts` 做 type-strip **并执行它**（顺序仍是 ts → mts → js → mjs，不改成 js-first）。生产请删 leftover `.ts`，或保证它就是你要的配置。

`docs/migration-v5.md` §2 同样加这一句。`CONFIG_NAMES` 顺序测试保持原断言。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/rewrite.test.ts src/__tests__/resolve.test.ts src/__tests__/projects.test.ts src/__tests__/build.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts
```

Expected: FAIL。`/b` 从子仓库仍解析到主 src；`./b` 不吃 `.mjs`；README 缺 22.18 / P7 token；`componentRelative: false` 仍是 `./` 相对路径。

- [ ] **Step 3: Write minimal implementation**

`resolver.ts` `toCandidate`：

```ts
  if (!fromAlias && specifier.startsWith('/')) {
    if (projectForPath(importer, projects)) {
      throw Object.assign(
        new Error(`ABS_PATH_IN_SUBPROJECT: ${importer} must not use src-root path ${specifier}`),
        { code: 'ABS_PATH_IN_SUBPROJECT' },
      )
    }
    return resolve(srcDir, specifier.slice(1))
  }
```

`completeSource` 用的 exts：

```ts
  const exts = req.extensions?.[kind] ?? adapter.sourceExts[kind] ?? []
```

把 `extensions` 从 `ResolveRequest` 解构出来。

`walk.ts` `GraphWalk` 增加 `extensions?: TargetAdapter['sourceExts']`。`tryResolve` 传 `extensions: walk.extensions`。catch：

```ts
    const code =
      err && typeof err === 'object' && 'code' in err && (err as { code: unknown }).code === 'ABS_PATH_IN_SUBPROJECT'
        ? 'ABS_PATH_IN_SUBPROJECT'
        : 'RESOLVE_MISS'
    walk.diagnostics.push(
      diagnostic({
        code,
        severity: 'error',
        message,
        file: req.importer,
      }),
    )
```

`builder.ts` `BuildGraphOptions` 增加 `extensions?: TargetAdapter['sourceExts']`，写入 `walk.extensions`。`compiler.ts` `buildGraph({ ..., extensions: config.resolve.extensions, ...})`。

`patch.ts` `applyGraphChange` opts 增加 `extensions`，写入 walk。`tick.ts` 从 `config.resolve.extensions` 传入。

`rewrite.ts` `destSpecifierOf` 增加参数 `componentRelative` / `outputDir`。json 走：

```ts
  const rel = posixRelative(posix.dirname(asPosix(placement.destPath)), asPosix(toDest))
  if (componentRelative !== false) {
    return ensureDotRelative(rel)
  }
  const fromRoot = posixRelative(asPosix(outputDir ?? ''), asPosix(toDest))
  return `/${fromRoot.replace(/^\//, '')}`
```

script/template/style **忽略**该开关，仍 `ensureDotRelative`。`rewriteCode` 把这两个字段传进 `rewriteJson` → `destSpecifierOf`。

`asPosix` = `value.replace(/\\/g, '/')`。

`emitPlan` 增加 `componentRelative?: boolean`，`rewriteCode({ ..., componentRelative: input.componentRelative, outputDir: input.outputDir })`。`compiler.run` / `tick.ts` 传 `config.output.componentRelative`。

文档按 Step 1 的句子写入 README / migration / core README（extensions 一句即可）。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/rewrite.test.ts src/__tests__/resolve.test.ts src/__tests__/projects.test.ts src/__tests__/build.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts src/__tests__/config.test.ts
```

Expected: PASS。然后再：

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run
```

Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/compile/rewrite.ts v5/packages/core/src/compile/emit.ts v5/packages/core/src/watch/tick.ts v5/packages/core/src/compiler.ts v5/packages/core/src/resolve/resolver.ts v5/packages/core/src/graph/walk.ts v5/packages/core/src/graph/builder.ts v5/packages/core/src/graph/patch.ts v5/packages/core/src/__tests__/rewrite.test.ts v5/packages/core/src/__tests__/resolve.test.ts v5/packages/core/src/__tests__/projects.test.ts v5/packages/core/src/__tests__/build.test.ts v5/packages/core/src/__tests__/readme.test.ts v5/packages/core/src/__tests__/migration.test.ts README.md docs/migration-v5.md v5/packages/core/README.md
git -c trailer.ifexists=doNothing commit -m "feat: honor componentRelative, ABS_PATH_IN_SUBPROJECT, resolve.extensions"
```

---

## Self-review

**1. Spec coverage（本阶段用户锁定的 1～8，不是整份 §13）：**

| 用户项 | Task |
|---|---|
| 1 `mpb dev` 打印诊断 / 保持进程 | Task 1 |
| 2 已入图 add = change；unlink+write dest 更新 | Task 2 |
| 3 copy `**` 零层 + extras 不每 tick 删 | Task 3 |
| 4 已入图 npm 文件 watch，不整棵 node_modules | Task 4 |
| 5 wxss/css `url()` | Task 5 |
| 6 非 minify 独立 `.map` | Task 6 |
| 7 `componentRelative` / `ABS_PATH_IN_SUBPROJECT` / `resolve.extensions` | Task 7 |
| 8 leftover `.ts` 只文档、保持 ts-first | Task 7 |

P6 已关闭项未重开。未做：完整 PluginContext、tt、workers、parallel pipeline、`PACKAGE_SIZE`、`EMPTY_ENTRY`、`DYNAMIC_SPECIFIER`、npmCompat minify、chokidar 在 reload 后重建。

**2. Placeholder scan:** 无 TBD / “implement later” / “similar to Task N”。每个 Task 含完整失败测试、实现要点、fnm 22 命令、`git -c trailer.ifexists=doNothing commit`。

**3. Type consistency:** `watch({ onDiagnostics })` 返回 `{ close, diagnostics }`；`preservePaths` 精确路径；`EdgeKinds.styleUrl`；`transformModule` 可选 `map`；`ResolveRequest.extensions`；`rewriteCode.componentRelative` 默认 true。

**4. 文档：** Task 1–6 先写句子；Task 7 把 README/migration token 与路线图 P7 开工断言一次锁死，避免中途 `readme.test.ts` 红到最后。
