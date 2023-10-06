# mpbuild 5.0 P6 harden Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 2.0.0 硬化成可 `mpb dev` / 可发 npm 的最小正确集：leftover `.ts` 配置可跳过、watch 不再删 extras 且会 reload 配置与 entry、`extraWatchFiles` 与 `@one` add 进图、`copy()` extras、weapp `componentGenerics` 按规格表入图、CLI `inspect graph` 走真实配置且 `--minify` / `TRANSFORM_FAIL` 可测。不实现完整规格 §13。

**Architecture:** 实现仍只在 `v5/packages/core` 与 `v5/packages/cli`。公开 `Plugin` 锁 `name + load? + generate?`（generate 返回值扩成单文件或数组，供 `copy()` 写 extras）。`loadConfig` 按 `CONFIG_NAMES` 顺序尝试，`.ts`/`.mts` 遇到 `ERR_UNKNOWN_FILE_EXTENSION` 则 warning 并试下一个。`compiler.watch` 的 `onConfigChange` 必须 `reloadConfig`（cache-bust `import`）再 `run()`。`emitPlan` 增量 unlink 跳过 `preserveNames`；`applyWatchTick` 每次再跑 generate。`watchPaths` 并入 `extraWatchFiles`；`graphIdFromAbs` 把 extras 映射回所属节点；`attachAddedCompanions` 对 `@one/` 用 `project.src`。CLI 一律 `loadConfig` + `createCompiler`。

**Tech Stack:** 现有 v5（TypeScript 5、Node >= 20、pnpm 9、vitest、chokidar、`@swc/core`、`lightningcss`）。不新增 glob / xxhash / blake3 / micromatch。`copy()` 用 `node:fs` 精确路径 + 自写 `*`/`**` 匹配。

## Global Constraints

- 命令名是 `mpb`。npm 包名是 `@mpbuild/core`、`@mpbuild/cli`，版本锁 `2.0.0`。禁止改成 `5.0.0`，禁止改成 `2.0.0-alpha`。禁止新增或发布 `name: "mpbuild"` 且 version 以 `5.` 开头的包。
- 根 `package.json` 保持 `private: true`、`name: "mpbuild-project"`、`version: "4.2.1"`。不要删根脚本 `cs:release` / `"release": "changeset publish"`。
- 实现目录：`v5/packages/core`、`v5/packages/cli`、`.github/workflows/`、根 README / `docs/migration-v5.md`、路线图。不要改图归属 / plan 语义 / intern 公式。
- **2.0.0 公开 Plugin 契约（本阶段冻结，不是完整 §13）：** `name` + `load?` + `generate?`。官方插件：`legacyScss()` / `projectConfig()` / **新增 `copy()`**。文档写明这是 2.0 承诺；完整 `PluginContext`（`emitModule` / `resolve` / `transform` / `plan` / `analyze` / `resolveEntries` / `addEntry`）是以后的 minor/major。
- **不要实现：** `resolveEntries`、`emitModule`、plugin `resolve`/`transform`/`plan`/`analyze`、tt adapter、`@mpbuild/target-tt`、json `extends`、rebase / merge origin 那 2 个 Snyk 提交、`copy({ graph: true })` 入图（YAGNI，文档写明未做）。
- **Git 推送不写进 implementer Task。** 禁止在本计划 Task 里 `git push`、打 tag、`npm publish`。force-with-lease 推 master + 打 `v2.0.0` 由编排器在合入后做。`origin/V1` 已是 `c98fabe`（4.x 备份）。禁止 `git merge origin/master`。
- `CONFIG_NAMES` 必须保持 `mpbuild.config.ts` → `.mts` → `.js` → `.mjs`（**.js 仍在 .mjs 前**）。不要改成 js-first。
- 磁盘缓存目录、sha256 键、`--no-cache` 行为保持 P5。配置 reload **不** `rm` 缓存目录。
- `example/demo` 不要迁进 `v5/packages/example`。不要改 `gold-demo.test.ts` 的 `demoConfig()` 语义。
- GitHub Actions 发布文件仍是 `.github/workflows/publish-mpbuild.yml`。Secret 名必须是 `NPM_TOKEN`。不要 npm provenance / `id-token`。
- 测试环境：`eval "$(fnm env)" && fnm use 22`（默认 shell 是 Node 14）。Node 22 默认 `import()` `.ts` 抛 `ERR_UNKNOWN_FILE_EXTENSION`；不要为测试开 `--experimental-strip-types`。
- TDD：先写失败测试并跑红，再写最少实现。提交：`git -c trailer.ifexists=doNothing commit`，禁止 `Co-authored-by`，禁止提及 AI / Grok / Claude / Cursor / Generated。
- 中文注释；标识符英文。
- 日常测试继续跑 **src + vitest**，相对路径 `from '../index'`。需要 dist 的 CLI spawn 测试在用例内部自己调 `pnpm build`。
- 本计划提交已把路线图「当前开工」改成 P6。现有 `readme.test.ts` 的 P5 开工断言会红，直到 Task 6 改测试。不要为此回改路线图。

### 本计划锁定的接口（后面 Task 必须同名同型）

```ts
export const CONFIG_NAMES = [
  'mpbuild.config.ts',
  'mpbuild.config.mts',
  'mpbuild.config.js',
  'mpbuild.config.mjs',
] as const

export interface ResolvedConfig {
  // ...现有字段不变...
  loadWarnings?: Diagnostic[] // loadConfig 始终赋数组；手写 config 可省略
}

export async function loadConfig(rootDir: string): Promise<ResolvedConfig>
export async function reloadConfig(current: ResolvedConfig): Promise<ResolvedConfig>
// reloadConfig = loadConfig(current.rootDir) + Object.assign(current, next)；返回 current

export function copy(
  patterns: string | string[],
  opts?: { graph?: boolean },
): Plugin

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

export function watchPaths(
  graph: ModuleGraph,
  srcDir: string,
  projects?: SubProject[],
): string[]

export function graphIdFromAbs(
  graph: ModuleGraph,
  absPath: string,
  srcDir: string,
  projects?: SubProject[],
): string

export async function startWatch(input: {
  paths: string[]
  srcDir: string
  graph: ModuleGraph
  projects?: SubProject[]
  reloadFiles?: string[] // 这些绝对路径的 change/add/unlink 走 onConfigChange（含 entry.js）
  onTick: (batch: {
    changedIds: string[]
    deletedIds: string[]
    addedRelPaths: string[]
  }) => Promise<void>
  onConfigChange: () => Promise<void>
}): Promise<{ close(): Promise<void> }>
```

诊断码（本阶段新增，字符串字面量）：

| code | severity | 何时 |
|---|---|---|
| `CONFIG_TS_SKIPPED` | warning | `.ts`/`.mts` 因 unknown extension 被跳过，最终加载了 js/mjs |
| `CONFIG_TS_SKIPPED` | throw `.code` | 只有无法加载的 ts/mts，没有 js/mjs 兜底 |
| `TRANSFORM_FAIL` | error | JS/SWC 解析或变换抛错；JSON.parse 在 transform/extract 抛错 |
| `TRANSFORM_FAIL` | warning | Lightning CSS 失败；仍写出原文 |
| `COPY_GRAPH_UNSUPPORTED` | warning | `copy(..., { graph: true })`；仍按 extras 拷贝 |

裁定（不要再发明另一套）：

- 跳过 leftover `.ts` **只**认 `ERR_UNKNOWN_FILE_EXTENSION` / `ERR_UNKNOWN_EXTENSION` / 消息 `/unknown file extension/i`。`.ts` 的 SyntaxError **不**跳到 js。
- `loadWarnings` 可选字段，避免改遍所有手写 `ResolvedConfig`。`loadConfig` / `reloadConfig` 必须赋值。`createCompiler.run`/`analyze` 把 `config.loadWarnings ?? []` 接到 diagnostics 前面。
- `import()` cache-bust：`${pathToFileURL(abs).href}?t=${Date.now()}`。`loadConfig` 与 `loadAppEntry` 都走同一 `importFresh`。
- `compiler.watch` 的 `onConfigChange`：**必须** `await reloadConfig(config); await run()`。禁止只 `run()`。
- `config.entry` 为字符串时，把 `resolve(rootDir, entry)` 加进 watch `paths` **且**加进 `reloadFiles`。
- `emitPlan` 对 `previousDests` unlink 时：`keep`（当前 placement dest）或 `basename(prev) ∈ preserveNames` 则跳过。`preserveNames` 仍传 `[adapter.projectConfigFile]`。
- `applyGeneratePlugins` **去掉** `existsSync(dest) continue`；是否覆盖由插件自己决定（`projectConfig` 已有则 return）。`run()` 与 `compiler.applyWatchTick` 每次都跑 generate，dests = emit dests + extras dests。
- generate 返回数组从 Task 5 起支持；Task 2 仍可只处理单文件返回值（`Array.isArray` 兼容写上也不罚）。
- `watchPaths` 加入每个 `node.extraWatchFiles`；路径含 `${sep}node_modules${sep}` 的仍丢。chokidar `ignored: /node_modules/` 保持。
- `graphIdFromAbs` 顺序：sourcePath 精确匹配 → extraWatchFiles 匹配（返回所属节点 id）→ `projectForPath` intern 公式 → `posixRelative(srcDir, abs)`。
- `attachAddedCompanions`：图 id 以 `project.name/` 开头则 `resolve(project.src, rel)`，否则 `resolve(srcDir, id)`。companion 用 `resolve(hit) === resolve(abs)` 比较，禁止 `posixRelative(srcDir, hit) === id`。`applyGraphChange` 把 `projects[].src` 相对 `rootDir` 收成绝对路径。
- `copy(patterns)`：pattern 相对 `rootDir`。无 `*` 当精确路径。源在 `srcDir` 下则 dest = `outputDir + relative(srcDir, abs)`（`src/tabbar.png` → `dist/tabbar.png`）。`graph: true` 不入图。
- `mpb inspect graph`：`loadConfig` + `createCompiler(config).analyze()` + `formatGraphInspect`。禁止再硬编码 `src/app.js`。
- `mpb build --minify`：`config.compile = { ...config.compile, minify: true }`，再 `createCompiler`。
- weapp `jsonPathFields` **替换**现有 `componentGenerics.*` + `name-or-path` 为规格两行 `path-or-true`。改掉 `extract.test.ts` 里「nested default 不抽」的断言。
- `.github/workflows/github-pages.yml`：`jobs.build.if: false`，`name` 含 `disabled: website package removed`。不要删整个 workflow 文件（选这一种写死）。
- `publishConfig.registry` 必须是 `https://registry.npmjs.org`（core 与 cli）。

---

## File map

```
v5/packages/core/src/config/schema.ts
v5/packages/core/src/config/load.ts
v5/packages/core/src/config/entry.ts
v5/packages/core/src/config/import-fresh.ts          (create)
v5/packages/core/src/compiler.ts
v5/packages/core/src/compile/emit.ts
v5/packages/core/src/compile/transform.ts
v5/packages/core/src/watch/watcher.ts
v5/packages/core/src/watch/tick.ts                    (preserveNames 已传；不必改谓词)
v5/packages/core/src/graph/patch.ts
v5/packages/core/src/graph/walk.ts                    (extractEdges try/catch)
v5/packages/core/src/graph/extract.ts                 (path-or-true 注释；逻辑可不动)
v5/packages/core/src/target/weapp.ts
v5/packages/core/src/plugin/copy.ts                   (create)
v5/packages/core/src/types.ts
v5/packages/core/src/index.ts
v5/packages/cli/src/index.ts
v5/packages/core/package.json
v5/packages/cli/package.json
.github/workflows/publish-mpbuild.yml
.github/workflows/github-pages.yml
README.md
docs/migration-v5.md
v5/packages/core/README.md
v5/packages/cli/README.md
v5/packages/core/src/__tests__/config.test.ts
v5/packages/core/src/__tests__/emit-delta.test.ts
v5/packages/core/src/__tests__/watch-reload.test.ts   (create)
v5/packages/core/src/__tests__/watch-generate.test.ts (create)
v5/packages/core/src/__tests__/watch-project.test.ts
v5/packages/core/src/__tests__/watch-extra.test.ts    (create)
v5/packages/core/src/__tests__/graph-patch.test.ts
v5/packages/core/src/__tests__/dev.test.ts
v5/packages/core/src/__tests__/transform.test.ts
v5/packages/core/src/__tests__/cli-p6.test.ts         (create)
v5/packages/core/src/__tests__/copy.test.ts           (create)
v5/packages/core/src/__tests__/extract.test.ts
v5/packages/core/src/__tests__/graph-builder.test.ts
v5/packages/core/src/__tests__/readme.test.ts
v5/packages/core/src/__tests__/migration.test.ts
v5/packages/core/src/__tests__/publish-workflow.test.ts
docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md
```

不改：`gold-demo.test.ts` 的 `demoConfig()` / 金样断言语义、intern / analyze / plan 公式、根 `package.json` 的 name/version/private 与 `cs:*`、P0–P5 计划原文。

当前事实（写计划时已核对，不要假装不存在）：

- `CONFIG_NAMES` 已是 ts/mts/js/mjs。`loadConfig` 取第一个存在的文件就 `import()`，leftover `.ts` 会让生产 `mpb` 直接炸。
- `onConfigChange` 只 `run()`，不 `loadConfig`。`import(pathToFileURL.href)` 无 query，ESM 缓存粘住。`config.entry` 不在 watch paths。
- `emitPlan` 的 `preserveNames` 只用于 `clean: true` 顶层；增量 unlink `previousDests` 不看 basename。`applyWatchTick` 不跑 generate。`lastDests` 在 tick 后丢掉 extras。
- `watchPaths` 不含 `extraWatchFiles`。`graphIdFromAbs` 不匹配 extras。`attachAddedCompanions` 用 `resolve(srcDir, '@one/...')`。
- CLI `inspect graph` 硬编码 `src/app.js` + `weappAdapter`，无视 router/projects/alias。无 `--minify`。`transformStyle` lightning 失败静默原文。`extractEdges` / SWC 抛错会打穿进程。
- 无 `copy()`。`weappAdapter.jsonPathFields` 是 `componentGenerics.*` + `name-or-path`；`extract.test.ts` 断言 `{ default: '/comp/nested' }` **不**抽取。
- `publish-mpbuild.yml` 不跑测试。core/cli `publishConfig` 只有 `access: public`。`github-pages.yml` 仍建已删除的 `packages/website`。
- 路线图「当前开工」在本计划提交时改为 P6。

---

## 编排器发布（禁止写进 implementer Task）

合入 P6 且全量测试绿之后，由编排器（不是 Task 实现者）做：

1. 确认 `origin/V1`（及本地 `V1`）仍是 `c98fabe`（4.x 备份）。
2. **禁止** `git merge origin/master` / rebase origin 那 2 个 Snyk 提交（会把 `packages/mpbuild@4.4.9` 复活进 5.x 树）。
3. `git push --force-with-lease origin master`（histories 已分叉；naive push 会被拒）。
4. 在**已推送的 rewrite commit**上 `git tag v2.0.0` 再 `git push origin v2.0.0`。不要给 `c98fabe` 打 `v2.0.0`。
5. 不要本地 `npm publish` / `pnpm publish` / `changeset publish`。npm org `@mpbuild` 与 repo secret `NPM_TOKEN` 必须事先存在，否则 GHA 会在 publish 步 401——那是编排器/人工门禁，不是本计划代码 Task。

---

### Task 1: leftover `.ts` 跳过并挂 `loadWarnings`

**Files:**
- Modify: `v5/packages/core/src/config/schema.ts`
- Modify: `v5/packages/core/src/config/load.ts`
- Modify: `v5/packages/core/src/compiler.ts`（run/analyze 前置 loadWarnings）
- Modify: `v5/packages/core/src/__tests__/config.test.ts`

**Interfaces:**
- Consumes: 现有 `CONFIG_NAMES`、`loadConfig(rootDir)`、`createCompiler`
- Produces: `ResolvedConfig.loadWarnings?: Diagnostic[]`。成功落到 js/mjs 时 warning `CONFIG_TS_SKIPPED`。只有无法加载的 ts → throw `code: 'CONFIG_TS_SKIPPED'`。

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/config.test.ts` 的 `describe('loadConfig')` 末尾追加：

```ts
  it('skips unloadable leftover .ts and loads js with CONFIG_TS_SKIPPED warning', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.ts'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-ts' } }\n",
    )
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-js' } }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('from-js')
    expect(config.configPath.replace(/\\/g, '/')).toMatch(/mpbuild\.config\.js$/)
    expect(config.loadWarnings?.some((d) => d.code === 'CONFIG_TS_SKIPPED')).toBe(true)
    expect(config.loadWarnings?.some((d) => /mpbuild\.config\.ts/.test(d.message))).toBe(true)
    expect(config.loadWarnings?.every((d) => d.severity === 'warning')).toBe(true)
  })

  it('fails when only an unloadable .ts config exists', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.ts'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-ts' } }\n",
    )
    await expect(loadConfig(root)).rejects.toMatchObject({ code: 'CONFIG_TS_SKIPPED' })
  })
```

`tempDir()` 已写 `"type": "module"` 的 `package.json`，保持不动。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/config.test.ts
```

Expected: FAIL。同时有 `.ts` + `.js` 时 `loadConfig` 因 `ERR_UNKNOWN_FILE_EXTENSION` 抛错，或（若 Node 碰巧能加载 .ts）`output.dir` 为 `from-ts`。只有 `.ts` 时错误码不是 `CONFIG_TS_SKIPPED`。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/src/config/schema.ts` 顶部增加 `import type { Diagnostic } from '../diagnostic/index.js'`。在 `ResolvedConfig` 已有的 `plugins?: Plugin[]` **后面**加一行（不要重复 plugins 字段）：

```ts
  /** loadConfig 跳过 leftover .ts 时的 warning；手写 config 可省略 */
  loadWarnings?: Diagnostic[]
```

`v5/packages/core/src/config/load.ts` 把 `loadConfig` 换成：

```ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { diagnostic, type Diagnostic } from '../diagnostic/index.js'
import { getTargetAdapter } from '../target/index.js'
import type { Plugin, TargetAdapter } from '../types.js'
import { loadAppEntry } from './entry.js'
import { userConfigSchema, type AliasValue, type ResolvedConfig } from './schema.js'

export const CONFIG_NAMES = [
  'mpbuild.config.ts',
  'mpbuild.config.mts',
  'mpbuild.config.js',
  'mpbuild.config.mjs',
] as const

export function defineConfig<T>(config: T): T {
  return config
}

function resolveTarget(target: string | TargetAdapter): TargetAdapter {
  return typeof target === 'string' ? getTargetAdapter(target) : target
}

function isTsConfigPath(file: string): boolean {
  return file.endsWith('.ts') || file.endsWith('.mts')
}

/** leftover .ts 且生产 Node 不能 import 时跳过；SyntaxError 不跳。 */
function isUnknownConfigExtension(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  if (code === 'ERR_UNKNOWN_FILE_EXTENSION' || code === 'ERR_UNKNOWN_EXTENSION') {
    return true
  }
  const message = err instanceof Error ? err.message : String(err)
  return /unknown file extension/i.test(message)
}

export async function loadConfig(rootDir: string): Promise<ResolvedConfig> {
  const existing = CONFIG_NAMES.map((name) => join(rootDir, name)).filter((file) => existsSync(file))
  if (existing.length === 0) {
    if (existsSync(join(rootDir, 'mpb.config.js'))) {
      throw Object.assign(new Error('LEGACY_CONFIG: use mpbuild.config.js instead of mpb.config.js'), {
        code: 'LEGACY_CONFIG',
      })
    }
    throw Object.assign(new Error(`CONFIG_NOT_FOUND: no mpbuild.config in ${rootDir}`), {
      code: 'CONFIG_NOT_FOUND',
    })
  }

  const loadWarnings: Diagnostic[] = []
  let imported: { default?: unknown } | undefined
  let configPath: string | undefined
  for (const file of existing) {
    try {
      imported = (await import(pathToFileURL(file).href)) as { default?: unknown }
      configPath = file
      break
    } catch (err) {
      if (isTsConfigPath(file) && isUnknownConfigExtension(err)) {
        loadWarnings.push(
          diagnostic({
            code: 'CONFIG_TS_SKIPPED',
            severity: 'warning',
            message: `CONFIG_TS_SKIPPED: cannot import ${file}; trying next mpbuild.config.*`,
            file,
          }),
        )
        continue
      }
      throw err
    }
  }
  if (!imported || !configPath) {
    throw Object.assign(
      new Error(`CONFIG_TS_SKIPPED: cannot load TypeScript config and no js/mjs fallback in ${rootDir}`),
      { code: 'CONFIG_TS_SKIPPED' },
    )
  }

  const parsed = userConfigSchema.parse(imported.default ?? imported)
  const target = resolveTarget(parsed.target)
  const appEntry = await loadAppEntry(rootDir, parsed.entry)

  return {
    rootDir,
    src: parsed.src,
    target,
    platform: parsed.platform,
    entry: parsed.entry,
    output: parsed.output,
    resolve: {
      alias: parsed.resolve.alias as Record<string, AliasValue>,
      extensions: { ...target.sourceExts, ...parsed.resolve.extensions },
    },
    compile: parsed.compile,
    subPackage: parsed.subPackage,
    projects: parsed.projects,
    ifdef: parsed.ifdef,
    appEntry,
    configPath,
    plugins: Array.isArray(parsed.plugins) ? (parsed.plugins as Plugin[]) : undefined,
    loadWarnings,
  }
}
```

`v5/packages/core/src/compiler.ts` 的 `run()` / `analyze()` 把 diagnostics 改成前面接上 `config.loadWarnings ?? []`：

```ts
    diagnostics: [...(config.loadWarnings ?? []), ...built.diagnostics, ...emitted.diagnostics],
```

analyze 同理（无 emitted）。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/config.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/config/schema.ts v5/packages/core/src/config/load.ts v5/packages/core/src/compiler.ts v5/packages/core/src/__tests__/config.test.ts
git -c trailer.ifexists=doNothing commit -m "fix: skip leftover ts config when Node cannot import it"
```

---

### Task 2: watch extras 保留 + 配置/entry reload

**Files:**
- Create: `v5/packages/core/src/config/import-fresh.ts`
- Modify: `v5/packages/core/src/config/load.ts`
- Modify: `v5/packages/core/src/config/entry.ts`
- Modify: `v5/packages/core/src/compile/emit.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/watch/watcher.ts`
- Modify: `v5/packages/core/src/index.ts`
- Modify: `v5/packages/core/src/types.ts`（generate ctx 可先加 `rootDir`/`srcDir`/`addWatchFile`/`warn`，Task 5 再用）
- Modify: `v5/packages/core/src/__tests__/config.test.ts`
- Modify: `v5/packages/core/src/__tests__/emit-delta.test.ts`
- Create: `v5/packages/core/src/__tests__/watch-generate.test.ts`
- Create: `v5/packages/core/src/__tests__/watch-reload.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `loadConfig` / `loadWarnings`；现有 `emitPlan` / `projectConfig` / `startWatch` / `createCompiler`
- Produces: `reloadConfig`；`importFresh`；`startWatch.reloadFiles`；unlink 尊重 `preserveNames`；`applyWatchTick` 再跑 generate。

- [ ] **Step 1: Write the failing test**

把 `v5/packages/core/src/__tests__/config.test.ts` 顶部 import 改成 `import { defineConfig, loadConfig, reloadConfig } from '../index'`，并追加：

```ts
describe('reloadConfig', () => {
  it('cache-busts ESM import so a rewritten config is visible', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default { pages: ["pages/a/a"] }\n')
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'first' } }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('first')
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'second' } }\n",
    )
    await reloadConfig(config)
    expect(config.output.dir).toBe('second')
  })
})
```

在 `v5/packages/core/src/__tests__/emit-delta.test.ts` 的 `describe('emitPlan delta')` 追加：

```ts
  it('does not unlink preserveNames extras when they are not placements', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-emit-keep-'))
    dirs.push(rootDir)
    const outputDir = join(rootDir, 'dist')
    const srcA = join(rootDir, 'a.js')
    await writeFile(srcA, 'module.exports = 1\n')
    await mkdir(outputDir, { recursive: true })
    const extra = join(outputDir, 'project.config.json')
    await writeFile(extra, '{"appid":"keep-tick"}\n')
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
    })
    expect(existsSync(extra)).toBe(true)
    expect(await readFile(extra, 'utf8')).toBe('{"appid":"keep-tick"}\n')
  })
```

创建 `v5/packages/core/src/__tests__/watch-generate.test.ts`：

```ts
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCompiler, projectConfig, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-gen-'))
  dirs.push(rootDir)
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
    projects: [],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: { pages: [] },
    configPath: '',
    plugins: [projectConfig({ projectname: 'keep-extras', appId: 'touristappid' })],
  }
}

describe('watch generate extras', () => {
  it('keeps project.config.json after applyWatchTick changes a js file', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({ x: 1 })\n',
    })
    const compiler = createCompiler(configOf(rootDir))
    await compiler.run()
    const extra = join(rootDir, 'dist/project.config.json')
    expect(existsSync(extra)).toBe(true)

    await writeFile(join(rootDir, 'src/pages/p/p.js'), 'Page({ x: 2 })\n')
    await compiler.applyWatchTick({
      changedIds: ['pages/p/p.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(existsSync(extra)).toBe(true)
  })
})
```

创建 `v5/packages/core/src/__tests__/watch-reload.test.ts`：

```ts
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCompiler,
  loadConfig,
  reloadConfig,
  startWatch,
} from '../index'
import type { ModuleGraph } from '../index'
import { coreDir } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-reload-'))
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

const emptyGraph: ModuleGraph = { entries: [], nodes: new Map(), edges: [], packages: [] }

describe('watch config/entry reload', () => {
  it('startWatch treats entry.js as onConfigChange via reloadFiles', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'entry.js': 'export default { pages: ["pages/a/a"] }\n',
    })
    const entryAbs = join(rootDir, 'entry.js')
    let reloads = 0
    const handle = await startWatch({
      paths: [entryAbs],
      srcDir: join(rootDir, 'src'),
      graph: emptyGraph,
      reloadFiles: [entryAbs],
      onTick: async () => {},
      onConfigChange: async () => {
        reloads += 1
      },
    })
    try {
      await writeFile(entryAbs, 'export default { pages: ["pages/b/b"] }\n')
      await vi.waitFor(
        () => {
          expect(reloads).toBeGreaterThan(0)
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }
  })

  it('reloadConfig then run picks up a new router page', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/pages/a/a.js': 'Page({})\n',
      'src/pages/b/b.js': 'Page({})\n',
      'entry.js':
        "export default { router: [{ root: '', pages: { 'pages/a/a': '/pages/a/a' } }] }\n",
      'mpbuild.config.js':
        "export default { src: 'src', entry: './entry.js', output: { dir: 'dist' } }\n",
    })
    const config = await loadConfig(rootDir)
    const compiler = createCompiler(config)
    await compiler.run()
    expect(existsSync(join(rootDir, 'dist/pages/a/a.js'))).toBe(true)
    expect(existsSync(join(rootDir, 'dist/pages/b/b.js'))).toBe(false)

    await writeFile(
      join(rootDir, 'entry.js'),
      "export default { router: [{ root: '', pages: { 'pages/a/a': '/pages/a/a', 'pages/b/b': '/pages/b/b' } }] }\n",
    )
    await reloadConfig(config)
    await compiler.run()
    expect(existsSync(join(rootDir, 'dist/pages/b/b.js'))).toBe(true)
  })

  it('compiler.watch onConfigChange calls reloadConfig', () => {
    const src = readFileSync(join(coreDir, 'src/compiler.ts'), 'utf8')
    expect(src).toContain('reloadConfig')
    expect(src).toContain('onConfigChange')
    const watchFn = src.slice(src.indexOf('async function watch'))
    const onCfg = watchFn.slice(watchFn.indexOf('onConfigChange'))
    expect(onCfg).toContain('reloadConfig')
    expect(onCfg).toContain('run()')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/config.test.ts src/__tests__/emit-delta.test.ts src/__tests__/watch-generate.test.ts src/__tests__/watch-reload.test.ts
```

Expected: FAIL。`reloadConfig` 未导出；第二次 `loadConfig` 仍见 `first`；unlink 删掉 `project.config.json`；tick 后 extras 消失；`startWatch` 不认 `reloadFiles`；`compiler.ts` 的 `onConfigChange` 没有 `reloadConfig`。

- [ ] **Step 3: Write minimal implementation**

创建 `v5/packages/core/src/config/import-fresh.ts`：

```ts
import { pathToFileURL } from 'node:url'

/** ESM import 带 cache-bust，供 loadConfig / loadAppEntry / reloadConfig。 */
export async function importFresh(absPath: string): Promise<unknown> {
  return import(`${pathToFileURL(absPath).href}?t=${Date.now()}`)
}
```

`load.ts`：把 `import(pathToFileURL(file).href)` 换成 `importFresh(file)`。追加：

```ts
/** 原地刷新 current（compiler 闭包的同一对象）。 */
export async function reloadConfig(current: ResolvedConfig): Promise<ResolvedConfig> {
  const next = await loadConfig(current.rootDir)
  Object.assign(current, next)
  return current
}
```

`entry.ts`：`import(pathToFileURL(abs).href)` 换成 `importFresh(abs)`（从 `./import-fresh.js` 引）。

`index.ts` 增加：

```ts
export { defineConfig, loadConfig, reloadConfig, CONFIG_NAMES } from './config/load.js'
```

（删掉原来只导出 `defineConfig, loadConfig, CONFIG_NAMES` 的那一行。）

`emit.ts` unlink 循环换成：

```ts
  const keep = new Set(dests)
  const preserve = new Set((input.preserveNames ?? []).map((name) => basename(name)))
  for (const prev of input.previousDests ?? []) {
    if (keep.has(prev) || preserve.has(basename(prev))) {
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

`watcher.ts`：`startWatch` 增加 `reloadFiles?: string[]`。

```ts
function shouldReload(filePath: string, reloadFiles: string[] | undefined): boolean {
  if (CONFIG_NAME_SET.has(basename(filePath))) {
    return true
  }
  if (!reloadFiles?.length) {
    return false
  }
  const abs = resolve(filePath)
  return reloadFiles.some((file) => resolve(file) === abs)
}
```

`add`/`unlink`/`change` 里用 `shouldReload(filePath, input.reloadFiles)` 代替只 `isConfigFile`。

`compiler.ts` 的 `watch()`：

```ts
    const reloadFiles = [
      ...CONFIG_NAMES.map((name) => join(config.rootDir, name)),
      config.configPath,
      typeof config.entry === 'string' ? resolve(config.rootDir, config.entry) : '',
    ].filter((file) => Boolean(file))
    const paths = [
      ...watchPaths(lastGraph, srcDir, projects),
      ...reloadFiles,
    ]
    return startWatch({
      paths,
      srcDir,
      get graph() {
        return lastGraph
      },
      projects,
      reloadFiles,
      onTick: async (batch) => {
        await applyWatchTick(batch)
      },
      onConfigChange: async () => {
        await reloadConfig(config)
        await run()
      },
    })
```

`applyGeneratePlugins`：去掉 `existsSync(result.destPath) continue`。写入所有返回文件。给 ctx 传 `rootDir: config.rootDir`、`srcDir: resolve(config.rootDir, config.src)`（`applyGeneratePlugins` 参数补上 rootDir/srcDir）。

单文件返回先按现有处理；顺手写成：

```ts
    const files = result == null ? [] : Array.isArray(result) ? result : [result]
    for (const file of files) {
      await mkdir(dirname(file.destPath), { recursive: true })
      await writeFile(file.destPath, file.content)
      dests.push(file.destPath)
    }
```

`run()` 已在 emit 后 generate。`compiler.applyWatchTick` 在 `applyWatchTickOnce` 之后同样调用 generate，并把 extras dests concat 进 `result.dests` 再 `remember`。

`types.ts` 的 `PluginGenerateContext` 按锁定接口补字段（可全部 optional）。`Plugin.generate` 返回值并上数组（Task 5 需要；本 Task 先改类型不罚）。

从 `compiler.ts` import `reloadConfig`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/config.test.ts src/__tests__/emit-delta.test.ts src/__tests__/watch-generate.test.ts src/__tests__/watch-reload.test.ts src/__tests__/watch-tick.test.ts src/__tests__/dev.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/config/import-fresh.ts v5/packages/core/src/config/load.ts v5/packages/core/src/config/entry.ts v5/packages/core/src/compile/emit.ts v5/packages/core/src/compiler.ts v5/packages/core/src/watch/watcher.ts v5/packages/core/src/index.ts v5/packages/core/src/types.ts v5/packages/core/src/__tests__/config.test.ts v5/packages/core/src/__tests__/emit-delta.test.ts v5/packages/core/src/__tests__/watch-generate.test.ts v5/packages/core/src/__tests__/watch-reload.test.ts
git -c trailer.ifexists=doNothing commit -m "fix: keep generate extras and reload config on watch"
```

---

### Task 3: extraWatchFiles + `@one` suite add

**Files:**
- Modify: `v5/packages/core/src/watch/watcher.ts`
- Modify: `v5/packages/core/src/graph/patch.ts`
- Modify: `v5/packages/core/src/__tests__/dev.test.ts`
- Create: `v5/packages/core/src/__tests__/watch-extra.test.ts`
- Modify: `v5/packages/core/src/__tests__/watch-project.test.ts`
- Modify: `v5/packages/core/src/__tests__/graph-patch.test.ts`（可选；主测试放 watch-project）

**Interfaces:**
- Consumes: P5 的 `graphIdFromAbs` / `watchPaths` / `attachAddedCompanions` / `intern` 公式
- Produces: extraWatchFiles 进 watchPaths 且映射回所属节点 id；`@one/pages/.../index.wxml` add 后 suite 入图。

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/dev.test.ts` 的 `describe('watchPaths')` 追加：

```ts
  it('includes extraWatchFiles outside node_modules', () => {
    const srcDir = join('/proj', 'src')
    const appPath = join(srcDir, 'app.js')
    const mixinPath = join(srcDir, 'wxss', 'mixin.wxss')
    const npmExtra = join(srcDir, 'node_modules', 'pkg', 'mix.js')
    const graph: ModuleGraph = {
      entries: ['app.js'],
      nodes: new Map([
        [
          'app.js',
          {
            ...mod('app.js', appPath),
            extraWatchFiles: [mixinPath, npmExtra],
          },
        ],
      ]),
      edges: [],
      packages: [],
    }
    const paths = watchPaths(graph, srcDir)
    expect(paths).toContain(mixinPath)
    expect(paths.some((p) => p.includes(`${sep}node_modules${sep}`))).toBe(false)
  })
```

创建 `v5/packages/core/src/__tests__/watch-extra.test.ts`：

```ts
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { graphIdFromAbs, weappAdapter } from '../index'
import type { Module, ModuleGraph } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-extra-watch-'))
  dirs.push(rootDir)
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

describe('graphIdFromAbs extraWatchFiles', () => {
  it('maps a mixin extraWatchFile back to the owning style node', async () => {
    const rootDir = await fixture({
      'src/pages/index/index.wxss': '.a{}\n',
      'src/wxss/mixin.wxss': '.m{}\n',
    })
    const srcDir = join(rootDir, 'src')
    const styleAbs = join(srcDir, 'pages/index/index.wxss')
    const mixinAbs = join(srcDir, 'wxss/mixin.wxss')
    const graph: ModuleGraph = {
      entries: [],
      nodes: new Map([
        [
          'pages/index/index.wxss',
          {
            id: 'pages/index/index.wxss',
            kind: 'style',
            sourcePath: styleAbs,
            owner: 'main',
            hash: '',
            extraWatchFiles: [mixinAbs],
            meta: {},
          } satisfies Module,
        ],
      ]),
      edges: [],
      packages: [],
    }
    expect(graphIdFromAbs(graph, mixinAbs, srcDir, [])).toBe('pages/index/index.wxss')
    expect(weappAdapter.id).toBe('weapp')
  })
})
```

在 `v5/packages/core/src/__tests__/watch-project.test.ts` 追加（`createCompiler @one watch` describe 内或新 describe）：

```ts
describe('createCompiler @one add companion', () => {
  it('attaches a new wxml under @one after applyWatchTick add', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': 'Page({})\n',
      'src/pages/index/index.json': JSON.stringify({
        usingComponents: { test: '@one/pages/test/index' },
      }),
      'projects/one/pages/test/index.js': 'Component({})\n',
      'projects/one/pages/test/index.json': JSON.stringify({ component: true }),
    })
    const oneSrc = join(rootDir, 'projects', 'one')
    const compiler = createCompiler(configOf(rootDir, oneSrc))
    const first = await compiler.run()
    expect(first.graph.nodes.has('@one/pages/test/index.js')).toBe(true)
    expect(first.graph.nodes.has('@one/pages/test/index.wxml')).toBe(false)

    await writeFile(join(oneSrc, 'pages/test/index.wxml'), '<view/>\n')
    const tick = await compiler.applyWatchTick({
      changedIds: [],
      deletedIds: [],
      addedRelPaths: ['@one/pages/test/index.wxml'],
    })
    expect(tick.graph.nodes.has('@one/pages/test/index.wxml')).toBe(true)
    expect(tick.graph.nodes.get('@one/pages/test/index.wxml')?.kind).toBe('template')
    expect(tick.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: '@one/pages/test/index.js',
          to: '@one/pages/test/index.wxml',
        }),
      ]),
    )
  })
})
```

该文件已有 `configOf` / `fixture` / `weappAdapter` import。补 `EdgeKinds` 不必强求。`configOf` 已设 `alias: { '@one': oneSrc }` 与 `projects`。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts src/__tests__/watch-extra.test.ts src/__tests__/watch-project.test.ts
```

Expected: FAIL。`watchPaths` 不含 mixin；`graphIdFromAbs(mixin)` 变成 `wxss/mixin.wxss` 而不是 style id；`@one/.../index.wxml` 不入图。

- [ ] **Step 3: Write minimal implementation**

`watchPaths` 在节点循环里追加：

```ts
    for (const extra of node.extraWatchFiles ?? []) {
      if (extra && !hasNodeModules(extra)) {
        paths.add(extra)
      }
    }
```

`graphIdFromAbs` 在 sourcePath 匹配之后、`projectForPath` 之前：

```ts
  for (const node of graph.nodes.values()) {
    for (const extra of node.extraWatchFiles ?? []) {
      if (extra && resolve(extra) === abs) {
        return node.id
      }
    }
  }
```

`patch.ts`：`applyGraphChange` 里把 projects 收成绝对路径：

```ts
  const projects = (opts.projects ?? []).map((project) => ({
    ...project,
    src: resolve(opts.rootDir, project.src),
  }))
```

walk 使用这个 `projects`，不要再用 opts 里可能相对的 src。

`attachAddedCompanions` 整函数换成：

```ts
function absFromGraphId(walk: GraphWalk, id: string): string {
  const project = walk.projects?.find(
    (item) => id === item.name || id.startsWith(`${item.name}/`),
  )
  if (project) {
    const rel = id.slice(project.name.length).replace(/^\//, '')
    return resolve(project.src, ...rel.split('/').filter(Boolean))
  }
  return resolve(walk.srcDir, ...id.split('/'))
}

function attachAddedCompanions(walk: GraphWalk, addedRelPaths: string[]): void {
  const { adapter } = walk
  for (const rel of addedRelPaths) {
    const id = rel.split(/[\\/]/).join('/')
    const abs = absFromGraphId(walk, id)
    const addedDir = dirname(abs)
    for (const node of [...walk.nodes.values()]) {
      if (node.kind !== 'script' || dirname(node.sourcePath) !== addedDir) {
        continue
      }
      for (const slot of Object.keys(adapter.suite) as Array<keyof TargetAdapter['suite']>) {
        if (slot === 'script') {
          continue
        }
        const companionKind = adapter.suite[slot]
        if (companionKind === 'script') {
          continue
        }
        if (walk.skipAppJsonPages && node.pageType === 'app' && companionKind === 'json') {
          continue
        }
        const hit = companionPath(node.sourcePath, companionKind, adapter, walk.platform)
        if (!hit || resolve(hit) !== resolve(abs)) {
          continue
        }
        const kind = suiteEdgeKind(node, walk.edges)
        const to = posixJoin(posixDirname(node.id), basename(hit))
        const exists = walk.edges.some(
          (edge) => edge.from === node.id && edge.to === to && edge.kind === kind,
        )
        if (!exists) {
          addSuiteEdge(walk, node, hit, kind)
        } else {
          enqueue(walk, to)
        }
        break
      }
    }
  }
}
```

从 `node:path` 保证已 import `resolve`（`patch.ts` 现有 `resolve`）。

不要改 `intern()`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/dev.test.ts src/__tests__/watch-extra.test.ts src/__tests__/watch-project.test.ts src/__tests__/graph-patch.test.ts src/__tests__/watch-tick.test.ts
```

Expected: PASS。src 树 suite add 回归仍然绿。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/watch/watcher.ts v5/packages/core/src/graph/patch.ts v5/packages/core/src/__tests__/dev.test.ts v5/packages/core/src/__tests__/watch-extra.test.ts v5/packages/core/src/__tests__/watch-project.test.ts
git -c trailer.ifexists=doNothing commit -m "fix: watch extraWatchFiles and attach @one suite adds"
```

---

### Task 4: CLI inspect / `--minify` / `TRANSFORM_FAIL`

**Files:**
- Modify: `v5/packages/cli/src/index.ts`
- Modify: `v5/packages/core/src/compile/transform.ts`
- Modify: `v5/packages/core/src/compile/emit.ts`
- Modify: `v5/packages/core/src/graph/walk.ts`
- Modify: `v5/packages/core/src/__tests__/transform.test.ts`
- Create: `v5/packages/core/src/__tests__/cli-p6.test.ts`

**Interfaces:**
- Consumes: `loadConfig`、`createCompiler.analyze`/`run`、`formatGraphInspect`、`transformModule`、`extractEdges`
- Produces: inspect 走配置；`--minify` 覆盖；JS 失败 diagnostic `TRANSFORM_FAIL` error 且进程不 uncaught；Lightning 失败 `TRANSFORM_FAIL` warning。

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/transform.test.ts` 追加：

```ts
  it('records TRANSFORM_FAIL warning when lightningcss rejects style', () => {
    const result = transformModule({
      kind: 'style',
      sourcePath: '/a.wxss',
      code: '.a { color: }',
      js,
    })
    expect(result.code).toContain('.a')
    expect(result.diagnostics?.some((d) => d.code === 'TRANSFORM_FAIL' && d.severity === 'warning')).toBe(
      true,
    )
  })

  it('throws or returns TRANSFORM_FAIL error diagnostics for invalid js', () => {
    expect(() =>
      transformModule({
        kind: 'script',
        sourcePath: '/a.js',
        code: 'const x = {',
        js,
      }),
    ).toThrow()
  })
```

（JS 用例锁的是 SWC 仍会抛；CLI/compiler 层接住。不要在 `transformModule` 里吞 JS 错误。）

创建 `v5/packages/core/src/__tests__/cli-p6.test.ts`：

```ts
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cliDir, v5Dir } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-cli-p6-'))
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

function mpb(cwd: string, args: string[]) {
  const bin = join(cliDir, 'bin/mpb.js')
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  })
}

describe('cli p6', () => {
  it('inspect graph uses loadConfig router and --minify shrinks js; bad js exits 1 with TRANSFORM_FAIL', {
    timeout: 60_000,
  }, async () => {
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)

    const inspectRoot = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/disk/index'] }),
      'src/pages/disk/index.js': 'Page({})\n',
      'src/pages/from-router/index.js': 'Page({})\n',
      'entry.js':
        "export default { router: [{ root: '', pages: { 'pages/from-router/index': '/pages/from-router/index' } }] }\n",
      'mpbuild.config.js':
        "export default { src: 'src', entry: './entry.js', output: { dir: 'dist' } }\n",
    })
    const inspected = mpb(inspectRoot, ['inspect', 'graph'])
    expect(inspected.status, `${inspected.stdout}\n${inspected.stderr}`).toBe(0)
    expect(inspected.stdout).toContain('pages/from-router/index.js')
    expect(inspected.stdout).toContain('owner=')
    expect(inspected.stdout).not.toContain('no src/app.js')

    const minifyRoot = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({ hello: "world", keep: 1 })\n',
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: [] }, output: { dir: 'dist' }, compile: { minify: false } }\n",
    })
    const plain = mpb(minifyRoot, ['build'])
    expect(plain.status, `${plain.stdout}\n${plain.stderr}`).toBe(0)
    const before = await readFile(join(minifyRoot, 'dist/pages/p/p.js'), 'utf8')
    const minified = mpb(minifyRoot, ['build', '--minify'])
    expect(minified.status, `${minified.stdout}\n${minified.stderr}`).toBe(0)
    const after = await readFile(join(minifyRoot, 'dist/pages/p/p.js'), 'utf8')
    expect(after.length).toBeLessThan(before.length)

    const badRoot = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'const x = {\n',
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: [] }, output: { dir: 'dist' } }\n",
    })
    const bad = mpb(badRoot, ['build'])
    expect(bad.status).toBe(1)
    expect(`${bad.stderr}\n${bad.stdout}`).toContain('TRANSFORM_FAIL')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/transform.test.ts src/__tests__/cli-p6.test.ts
```

Expected: FAIL。`transformModule` 无 `diagnostics`；inspect 打不出 `from-router`；`--minify` 体积不变；坏 JS 可能 status≠1 或 stderr 无 `TRANSFORM_FAIL`（uncaught stack）。

- [ ] **Step 3: Write minimal implementation**

`transform.ts`：`transformModule` 返回 `{ code: string; diagnostics?: Diagnostic[] }`。`transformStyle` 的 `catch`：

```ts
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      code: input.code,
      diagnostics: [
        {
          code: 'TRANSFORM_FAIL',
          severity: 'warning',
          message: `TRANSFORM_FAIL: ${message}`,
          file: input.sourcePath,
        },
      ],
    }
  }
```

其它分支 `diagnostics: []` 或不设。JS 路径继续让 SWC 抛。

`emit.ts` 在调用 `transformModule` / `npmCompat` 处：

```ts
    let code: string | undefined
    // cache read 不变
    if (code === undefined) {
      try {
        const transformed = useNpmCompat
          ? npmCompat({ kind: node.kind, sourcePath: node.sourcePath, code: source, js: input.js })
          : transformModule({
              kind: node.kind,
              sourcePath: node.sourcePath,
              code: source,
              js: input.js,
              css: input.css,
              minify: minifyFlag,
            })
        code = transformed.code
        if ('diagnostics' in transformed && transformed.diagnostics) {
          diagnostics.push(...transformed.diagnostics)
        }
        if (input.cacheDir && key) {
          await writeTransformCache(input.cacheDir, key, code)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        diagnostics.push({
          code: 'TRANSFORM_FAIL',
          severity: 'error',
          message: `TRANSFORM_FAIL: ${message}`,
          file: node.sourcePath,
        })
        continue
      }
    }
```

`walk.ts` `processModule` 抽边：

```ts
  let extractedList
  try {
    extractedList = extractEdges({
      id,
      kind: node.kind,
      code,
      adapter: walk.adapter,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    walk.diagnostics.push(
      diagnostic({
        code: 'TRANSFORM_FAIL',
        severity: 'error',
        message: `TRANSFORM_FAIL: ${message}`,
        file: node.sourcePath || id,
      }),
    )
    return
  }
  for (const extracted of extractedList) {
    // 原循环体
  }
```

`v5/packages/cli/src/index.ts`：

`inspect graph` 整段换成：

```ts
  if (argv[2] === 'inspect' && argv[3] === 'graph') {
    const config = await loadOrReport(process.cwd())
    if (!config) {
      return
    }
    const { graph, diagnostics } = await createCompiler(config).analyze()
    printDiagnostics(diagnostics)
    console.log(formatGraphInspect(graph))
    if (diagnostics.some(isError)) {
      process.exitCode = 1
    }
    return
  }
```

删掉 `buildGraph` / `analyzeGraph` / `weappAdapter` / `existsSync` 若不再使用。

`build` 分支：

```ts
    if (argv.includes('--minify')) {
      config.compile = { ...config.compile, minify: true }
    }
    const { diagnostics } = await createCompiler(config, {
      cache: !argv.includes('--no-cache'),
    }).run()
```

`printDiagnostics` 已打 `d.code`。坏 JS 走 core diagnostics → exit 1。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/transform.test.ts src/__tests__/cli-p6.test.ts src/__tests__/cli-release.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/cli/src/index.ts v5/packages/core/src/compile/transform.ts v5/packages/core/src/compile/emit.ts v5/packages/core/src/graph/walk.ts v5/packages/core/src/__tests__/transform.test.ts v5/packages/core/src/__tests__/cli-p6.test.ts
git -c trailer.ifexists=doNothing commit -m "fix: inspect real graph, --minify, TRANSFORM_FAIL diagnostics"
```

---

### Task 5: `copy()` extras + `componentGenerics` 规格表

**Files:**
- Create: `v5/packages/core/src/plugin/copy.ts`
- Create: `v5/packages/core/src/__tests__/copy.test.ts`
- Modify: `v5/packages/core/src/index.ts`
- Modify: `v5/packages/core/src/compiler.ts`（generate ctx 传 rootDir/srcDir/addWatchFile；数组返回 Task 2 已写则跳过）
- Modify: `v5/packages/core/src/target/weapp.ts`
- Modify: `v5/packages/core/src/graph/extract.ts`（注释改成 path-or-true；`true` 仍不当路径）
- Modify: `v5/packages/core/src/__tests__/extract.test.ts`
- Modify: `v5/packages/core/src/__tests__/graph-builder.test.ts`

**Interfaces:**
- Consumes: Task 2 的 generate extras 路径、锁定的 `copy()` / `PluginGenerateContext`
- Produces: `copy(patterns, opts?)` 默认 `graph: false` 拷到 outputDir、进 lastDests、`addWatchFile` 源路径。weapp 表挂上 `componentGenerics.*.default` 与 `componentGenerics.*`，`value: 'path-or-true'`。

- [ ] **Step 1: Write the failing test**

创建 `v5/packages/core/src/__tests__/copy.test.ts`：

```ts
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { copy, createCompiler, weappAdapter } from '../index'
import type { ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string | Buffer>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-copy-'))
  dirs.push(rootDir)
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

function configOf(rootDir: string, plugins: ResolvedConfig['plugins']): ResolvedConfig {
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
    projects: [],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: { pages: [] },
    configPath: '',
    plugins,
  }
}

describe('copy()', () => {
  it('copies src/tabbar.png into dist and keeps it after a watch tick', async () => {
    const png = Buffer.from([137, 80, 78, 71, 1, 2, 3, 4])
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
      'src/pages/p/p.js': 'Page({})\n',
      'src/tabbar.png': png,
    })
    const compiler = createCompiler(configOf(rootDir, [copy('src/tabbar.png')]))
    const result = await compiler.run()
    const dest = join(rootDir, 'dist/tabbar.png')
    expect(existsSync(dest)).toBe(true)
    expect(Buffer.from(await readFile(dest)).equals(png)).toBe(true)
    expect(result.dests.some((file) => file.replace(/\\/g, '/').endsWith('tabbar.png'))).toBe(true)

    await writeFile(join(rootDir, 'src/pages/p/p.js'), 'Page({ x: 1 })\n')
    await compiler.applyWatchTick({
      changedIds: ['pages/p/p.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(existsSync(dest)).toBe(true)
  })
})
```

把 `v5/packages/core/src/__tests__/extract.test.ts` 里 `extracts string componentGenerics leaves and skips true / objects` **整段换成**：

```ts
  it('extracts componentGenerics string paths and *.default, skips true', () => {
    const edges = extractEdges({
      id: '/p.json',
      kind: 'json',
      adapter: weappAdapter,
      code: JSON.stringify({
        componentGenerics: {
          item: '/comp/item',
          slot: true,
          nested: { default: '/comp/nested' },
        },
      }),
    })
    const raws = edges.map((e) => e.raw).sort()
    expect(raws).toEqual(['/comp/item', '/comp/nested'])
    expect(edges.every((e) => e.kind === EdgeKinds.usingComponent)).toBe(true)
  })
```

在 `v5/packages/core/src/__tests__/graph-builder.test.ts` 追加：

```ts
  it('puts componentGenerics default path into the graph', async () => {
    const { rootDir, srcDir } = await fixture({
      'app.js': 'App({})\n',
      'app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'pages/index/index.js': 'Page({})\n',
      'pages/index/index.json': JSON.stringify({
        componentGenerics: {
          item: { default: '/components/generic-item/index' },
        },
      }),
      'components/generic-item/index.js': 'Component({})\n',
      'components/generic-item/index.json': JSON.stringify({ component: true }),
    })
    const { graph } = await buildGraph({
      rootDir,
      srcDir,
      adapter: weappAdapter,
      entryScripts: [join(srcDir, 'app.js')],
    })
    expect(graph.nodes.has('components/generic-item/index.js')).toBe(true)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'pages/index/index.json',
          raw: '/components/generic-item/index',
        }),
      ]),
    )
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/copy.test.ts src/__tests__/extract.test.ts src/__tests__/graph-builder.test.ts
```

Expected: FAIL。`copy` 未导出；nested default 仍不在 edges；generic-item 不入图。

- [ ] **Step 3: Write minimal implementation**

创建 `v5/packages/core/src/plugin/copy.ts`：

```ts
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { diagnostic } from '../diagnostic/index.js'
import type { Plugin } from '../types.js'

/** extras 拷贝。graph:true 本阶段不入图，只 warning。 */
export function copy(patterns: string | string[], opts?: { graph?: boolean }): Plugin {
  const list = Array.isArray(patterns) ? patterns : [patterns]
  return {
    name: 'copy',
    async generate(_file, ctx) {
      if (opts?.graph === true) {
        ctx.warn?.(
          diagnostic({
            code: 'COPY_GRAPH_UNSUPPORTED',
            severity: 'warning',
            message: 'COPY_GRAPH_UNSUPPORTED: copy({ graph: true }) is not implemented; using extras',
          }),
        )
      }
      const outputDir = ctx.outputDir
      const rootDir = ctx.rootDir
      const srcDir = ctx.srcDir
      if (!outputDir || !rootDir || !srcDir) {
        return
      }
      const files: Array<{ destPath: string; content: Buffer }> = []
      for (const pattern of list) {
        for (const abs of await expandPattern(rootDir, pattern)) {
          const destPath = destFor(abs, rootDir, srcDir, outputDir)
          const content = await readFile(abs)
          ctx.addWatchFile?.(abs)
          files.push({ destPath, content })
        }
      }
      return files
    },
  }
}

function destFor(abs: string, rootDir: string, srcDir: string, outputDir: string): string {
  const fromSrc = relative(srcDir, abs)
  if (!fromSrc.startsWith('..') && !isAbsolute(fromSrc)) {
    return join(outputDir, fromSrc)
  }
  return join(outputDir, relative(rootDir, abs))
}

async function expandPattern(rootDir: string, pattern: string): Promise<string[]> {
  const normalized = pattern.replace(/\\/g, '/')
  if (!normalized.includes('*')) {
    const abs = resolve(rootDir, normalized)
    return existsSync(abs) ? [abs] : []
  }
  const out: string[] = []
  await walkFiles(rootDir, async (abs) => {
    const rel = relative(rootDir, abs).split(sep).join('/')
    if (matchGlob(rel, normalized)) {
      out.push(abs)
    }
  })
  return out
}

async function walkFiles(dir: string, visit: (abs: string) => Promise<void>): Promise<void> {
  let entries
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const name of entries) {
    const abs = join(dir, name)
    let st
    try {
      st = await stat(abs)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') {
        continue
      }
      await walkFiles(abs, visit)
    } else if (st.isFile()) {
      await visit(abs)
    }
  }
}

function matchGlob(rel: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*')
  return new RegExp(`^${escaped}$`).test(rel)
}
```

`index.ts`：

```ts
export { copy } from './plugin/copy.js'
```

`compiler.ts` 的 generate ctx 必须包含 `rootDir`、`srcDir`、`addWatchFile`、`warn`（warn 推进当前 diagnostics）。`run()` / `applyWatchTick` 的 dests 含 copy 输出。watch paths 并上 generate 收集的 watchFiles（Task 2 若已加 `lastWatchFiles` 则接上；否则本 Task 在 `watch()` 的 paths 里 concat）。

`weapp.ts`：

```ts
  jsonPathFields: [
    { path: 'usingComponents.*', edge: EdgeKinds.usingComponent, value: 'path' },
    { path: 'componentGenerics.*.default', edge: EdgeKinds.usingComponent, value: 'path-or-true' },
    { path: 'componentGenerics.*', edge: EdgeKinds.usingComponent, value: 'path-or-true' },
  ],
```

`extract.ts` 注释改为「path-or-true：字符串当路径，布尔 true 不当路径」。`isJsonPathLeaf`：

```ts
function isJsonPathLeaf(
  node: unknown,
  value: 'path' | 'path-or-true' | 'name-or-path',
): node is string {
  if (node === true && value === 'path-or-true') {
    return false
  }
  if (typeof node !== 'string' || node === '') {
    return false
  }
  return value === 'path' || value === 'path-or-true' || value === 'name-or-path'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/copy.test.ts src/__tests__/extract.test.ts src/__tests__/graph-builder.test.ts src/__tests__/watch-generate.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/plugin/copy.ts v5/packages/core/src/index.ts v5/packages/core/src/compiler.ts v5/packages/core/src/target/weapp.ts v5/packages/core/src/graph/extract.ts v5/packages/core/src/types.ts v5/packages/core/src/__tests__/copy.test.ts v5/packages/core/src/__tests__/extract.test.ts v5/packages/core/src/__tests__/graph-builder.test.ts
git -c trailer.ifexists=doNothing commit -m "feat: add copy extras plugin and componentGenerics json paths"
```

---

### Task 6: CI 测试门禁 + 发布文档 + 2.0 Plugin 说明

**Files:**
- Modify: `.github/workflows/publish-mpbuild.yml`
- Modify: `.github/workflows/github-pages.yml`
- Modify: `v5/packages/core/package.json`
- Modify: `v5/packages/cli/package.json`
- Modify: `README.md`
- Modify: `docs/migration-v5.md`
- Modify: `v5/packages/core/README.md`
- Modify: `v5/packages/cli/README.md`
- Modify: `v5/packages/core/src/__tests__/readme.test.ts`
- Modify: `v5/packages/core/src/__tests__/migration.test.ts`
- Modify: `v5/packages/core/src/__tests__/publish-workflow.test.ts`

**Interfaces:**
- Consumes: P5 workflow / 文档 token 测试
- Produces: publish 前跑 core 测试；registry 钉死 npmjs；pages job 禁用；文档写清 2.0 Plugin / leftover ts / 禁止 merge Snyk。

- [ ] **Step 1: Write the failing test**

把 `v5/packages/core/src/__tests__/readme.test.ts` 的「marks P5 as current work…」整段换成：

```ts
  it('marks P6 as current work without editing P0-P3 acceptance lines', () => {
    const roadmap = readFileSync(
      join(repoRoot, 'docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md'),
      'utf8',
    )
    expect(roadmap).toMatch(/当前开工：P6/)
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

同一文件「documents @mpbuild/cli…」里追加（保留原有断言）：

```ts
    expect(readme).toContain('--minify')
    expect(readme).toContain('copy(')
    expect(readme).toContain('legacyScss')
    expect(readme).toContain('projectConfig')
    expect(readme).toContain('CONFIG_TS_SKIPPED')
    expect(readme).toContain('v2.0.0')
    expect(readme).toContain('force-with-lease')
    expect(readme).toContain('Snyk')
    expect(readme).toContain('load')
    expect(readme).toContain('generate')
```

`migration.test.ts` 的 `required` 数组追加：

```ts
      'copy(',
      '--minify',
      'CONFIG_TS_SKIPPED',
      'graph: true',
      'Snyk',
      'v2.0.0',
```

`publish-workflow.test.ts` 在现有 workflow 断言后追加：

```ts
    expect(yml).toContain('pnpm --filter @mpbuild/core test -- --run')
    expect(yml).toContain('timeout-minutes')

    const pages = readFileSync(join(repoRoot, '.github/workflows/github-pages.yml'), 'utf8')
    expect(pages).toMatch(/if:\s*false/)
    expect(pages).toContain('disabled: website package removed')

    expect((corePkg.publishConfig as Record<string, string>).registry).toBe(
      'https://registry.npmjs.org',
    )
    expect((cliPkg.publishConfig as Record<string, string>).registry).toBe(
      'https://registry.npmjs.org',
    )
```

`corePkg` / `cliPkg` 已在该测试里 `readJson`。pages 的 `readFileSync` 需保证文件顶部已 import `readFileSync`（已有）。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/readme.test.ts src/__tests__/migration.test.ts src/__tests__/publish-workflow.test.ts
```

Expected: FAIL。README/migration 缺新 token；workflow 无 test 步；pages 无 `if: false`；package.json 无 registry。

- [ ] **Step 3: Write minimal implementation**

`.github/workflows/publish-mpbuild.yml` 的 `jobs.publish` 增加 `timeout-minutes: 20`。在 `pnpm build` 之后、Check tag 之前插入：

```yaml
      - run: pnpm --filter @mpbuild/core test -- --run
```

`v5/packages/core/package.json` 与 `v5/packages/cli/package.json`：

```json
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  },
```

`.github/workflows/github-pages.yml` 的 job：

```yaml
jobs:
  build:
    if: false
    name: disabled: website package removed
    runs-on: ubuntu-latest
```

保留原 steps，不要删文件。

根 `README.md`：

- 「命令」块加 `mpb build --minify`。
- 「配置」段把「否则会先加载它们并失败」改成：生产 bin 不能加载 `.ts` / `.mts` 时会 **跳过并诊断 `CONFIG_TS_SKIPPED`**，继续尝试 `.js` / `.mjs`；若只有无法加载的 `.ts` 则失败。不要同时留下会误导的 `.ts` 仍建议删掉。
- 示例 `plugins` 加上 `copy('src/tabbar.png')`，import 加上 `copy`。
- 新增一小节 **插件（2.0.0 承诺）**：公开 `Plugin` 只有 `name` + `load?` + `generate?`。官方插件 `legacyScss()` / `projectConfig()` / `copy()`。`copy({ graph: true })` 未实现。完整 PluginContext 是以后的版本。
- 「发布」段写清：tag 必须是 `v2.0.0`；secret `NPM_TOKEN`；用 `git push --force-with-lease origin master` 推 rewrite，**不要 merge origin 的 Snyk / 4.x `packages/mpbuild`**；`V1` 已备份 4.x。

`docs/migration-v5.md`：

- §1 命令列表加 `--minify`。
- §2 leftover `.ts` 改为跳过 + `CONFIG_TS_SKIPPED`（与 README 同义）。
- §6 删除「也不要调用不存在的 `copy()`」；改成 `copy(patterns)` 默认 extras，`graph: true` 未做。重申 2.0 Plugin 只有 load/generate。
- 对照表 Copy 行改成 `copy()` extras（默认 `graph: false`）。
- 「首发明确不做」保留完整 PluginContext / tt / json extends；**不要**再把 `copy()` 列进不做。加一句：不要把 origin 上那 2 个 Snyk 提交 merge 进 5.x；发布 tag 是 `v2.0.0`。

`v5/packages/core/README.md` import 示例加上 `copy`。`v5/packages/cli/README.md` 命令加 `--minify`，并一句 inspect graph 走 `mpbuild.config.*`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/readme.test.ts src/__tests__/migration.test.ts src/__tests__/publish-workflow.test.ts
```

Expected: PASS。然后再跑：

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run
```

Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/publish-mpbuild.yml .github/workflows/github-pages.yml v5/packages/core/package.json v5/packages/cli/package.json README.md docs/migration-v5.md v5/packages/core/README.md v5/packages/cli/README.md v5/packages/core/src/__tests__/readme.test.ts v5/packages/core/src/__tests__/migration.test.ts v5/packages/core/src/__tests__/publish-workflow.test.ts
git -c trailer.ifexists=doNothing commit -m "docs: lock 2.0 plugin surface and publish test gate"
```

---

## Self-review

**1. Spec coverage（本阶段用户锁定的 1～9，不是整份 §13）：**

| 项 | Task |
|---|---|
| leftover `.ts` skip + warning | 1 |
| watch extras 不被删 + generate on tick | 2 |
| onConfigChange reload + entry watch | 2 |
| extraWatchFiles + `@one` add | 3 |
| inspect graph / `--minify` / TRANSFORM_FAIL / lightning warning | 4 |
| `copy()` extras | 5 |
| componentGenerics 规格表 | 5 |
| publish 跑测试 / registry / pages no-op / 文档 | 6 |
| 2.0 Plugin = load/generate；copy/projectConfig/legacyScss 官方 | 5+6 |
| 不实现完整 PluginContext / tt / json extends / Snyk rebase / graph:true | Constraints + 编排器节 |

**2. Placeholder scan:** 无 TBD/TODO/implement later。每个 Task 有完整测试代码与 FAIL/GREEN 命令。

**3. Type consistency:** `reloadConfig` / `copy` / `loadWarnings` / `reloadFiles` / `CONFIG_TS_SKIPPED` / `TRANSFORM_FAIL` / `COPY_GRAPH_UNSUPPORTED` 前后 Task 同名。
