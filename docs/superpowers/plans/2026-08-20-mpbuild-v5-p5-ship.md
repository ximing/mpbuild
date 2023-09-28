# mpbuild 5.0 P5 ship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布前清单落地：`mpbuild.config.mjs` 可加载；watch 把子仓库文件映射成图 id `@one/...`；磁盘 transform 缓存 + `mpb build --no-cache`；`example/demo` 能 `mpb build` 并对金样；用 GitHub Actions 在 `v*` tag 上发布 `@mpbuild/core` / `@mpbuild/cli`。禁止本地 `npm publish`。

**Architecture:** 实现仍只在 `v5/packages/core` 与 `v5/packages/cli`。loadConfig / watcher 共用 `CONFIG_NAMES`（`.js` 仍在 `.mjs` 前）。`graphIdFromAbs` 先按 `sourcePath` 精确匹配节点 id，否则用与 `intern()` 相同的子仓库公式。`emitPlan` 在 rewrite 之前对 script / script-module / style 读写 `{rootDir}/node_modules/.cache/mpbuild`（sha256 内容寻址）。CLI 只在 `mpb build` 认 `--no-cache`。demo 配置改成 ESM `.mjs`，从 in-repo `core/dist` import 官方插件。发包只走 `.github/workflows/publish-mpbuild.yml`。

**Tech Stack:** 现有 v5（TypeScript 5、Node >= 20、pnpm 9、vitest、chokidar、`@swc/core`、`lightningcss`）。哈希用 Node `crypto.createHash('sha256')`。不新增 xxhash / blake3。CI：`actions/checkout@v4`、`pnpm/action-setup@v4`、`actions/setup-node@v4`（Node 22）。

## Global Constraints

- 命令名是 `mpb`。npm 包名是 `@mpbuild/core`、`@mpbuild/cli`，版本锁 `2.0.0`。禁止改成 `5.0.0`。禁止新增或发布 `name: "mpbuild"` 且 version 以 `5.` 开头的包。
- 根 `package.json` 保持 `private: true`、`name: "mpbuild-project"`、`version: "4.2.1"`。禁止把它改成可发布的 `mpbuild@5.0.0`。
- 实现目录：`v5/packages/core`、`v5/packages/cli`、`example/demo/mpbuild.config.*`、`.github/workflows/`、根 README / `docs/migration-v5.md` 的必要句子、路线图。不要改图归属 / plan 语义。
- **不要**把 `example/demo` 迁进 `v5/packages/example`。
- **不要**实现 `copy()`、完整 PluginContext（`emitModule` / `resolve` / `transform` / `plan` 等规格 §13 未落地钩子）、tt adapter、`@mpbuild/target-tt`。
- **不要**恢复 4.x 包。不要把用户导向 `https://ximing.github.io/mpbuild/` 当 5.x 主文档。
- **不本地发包。** 禁止在任何新脚本里默认执行 `npm publish` / `changeset publish`。只允许 CI 在 tag 上 `pnpm publish`。根 `package.json` 的 `cs:release` / `"release": "changeset publish"` 是 4.x 遗留——**不要删**。
- GitHub Actions 文件必须是 `.github/workflows/publish-mpbuild.yml`。Secret 名必须是 `NPM_TOKEN`。不要把 token 写进仓库。不要 npm provenance / `id-token`。
- `pack:check` 仍是 dry-run。core / cli 加 `"prepublishOnly": "pnpm build"`。
- `loadConfig` 的 `CONFIG_NAMES` 必须是 `mpbuild.config.ts` → `.mts` → `.js` → `.mjs`（**.js 仍在 .mjs 前**）。watcher 与 `compiler.watch()` 监听列表同步加 `.mjs`。
- Watch `@one/`：实现 `graphIdFromAbs(graph, absPath, srcDir, projects)`；`startWatch` 必须拿到 `graph` + `projects`；`watchPaths` 必须包含每个 `projects[].src`（仍排除 node_modules）。
- 磁盘缓存目录 `{rootDir}/node_modules/.cache/mpbuild`。哈希 **Node `crypto.createHash('sha256')`**，不新增 xxhash/blake3。键至少：`module.hash`、`compile.js`/`css`/`minify`、`platform`、`ifdef.tokens`、`@mpbuild/core` version、`@swc/core` 与 `lightningcss` 的 package version。transform **不得**把 dest/owner 编进缓存。`output.clean` 不清缓存。GC：超过 4096 个文件时按 mtime 删最旧直到 ≤4096。`--no-cache`：`mpb build --no-cache` 与 `createCompiler(config, { cache: false })`。
- `example/demo/mpbuild.config.js` **替换为** `example/demo/mpbuild.config.mjs`（删除 `.js`）。现有 `gold-demo.test.ts` **继续自己构造 ResolvedConfig**，不要改其语义。
- **YAGNI / 不做：** `copy()`、完整 PluginContext、tt adapter、改图归属/plan 语义、把 demo 迁进 `v5/packages/example`、rebase/合 origin 那 2 个 Snyk 提交、真正把包发到 npm、改根包名为 `mpbuild@5`、CLI `--minify`（规格 §15 有，本阶段不做）。
- Git origin：本分支从本地 master `726c0b2` 拉出，**不要**在本计划里 rebase origin。发布工作流进仓库即可；用户稍后自己处理 ahead/behind 再 push tag。
- 测试环境：`eval "$(fnm env)" && fnm use 22`（默认 shell 是 Node 14）。
- TDD：先写失败测试并跑红，再写最少实现。提交：`git -c trailer.ifexists=doNothing commit`，禁止 `Co-authored-by`，禁止提及 AI / Grok / Claude / Cursor / Generated。
- 中文注释；标识符英文。
- 日常测试继续跑 **src + vitest**，相对路径 `from '../index'`。需要 dist 的验收测试在用例内部自己调 `pnpm build`。
- 本计划提交已把路线图「当前开工」改成 P5。现有 `readme.test.ts` 的 P4 开工断言会红，直到 Task 1 改测试。不要为此回改路线图。

### 本计划锁定的接口（后面 Task 必须同名同型）

```ts
export const CONFIG_NAMES = [
  'mpbuild.config.ts',
  'mpbuild.config.mts',
  'mpbuild.config.js',
  'mpbuild.config.mjs',
] as const

export function graphIdFromAbs(
  graph: ModuleGraph,
  absPath: string,
  srcDir: string,
  projects?: SubProject[],
): string

export function watchPaths(
  graph: ModuleGraph,
  srcDir: string,
  projects?: SubProject[],
): string[]

export async function startWatch(input: {
  paths: string[]
  srcDir: string
  graph: ModuleGraph
  projects?: SubProject[]
  onTick: (batch: {
    changedIds: string[]
    deletedIds: string[]
    addedRelPaths: string[]
  }) => Promise<void>
  onConfigChange: () => Promise<void>
}): Promise<{ close(): Promise<void> }>

export type CompilerOptions = { cache?: boolean } // 省略或 cache!==false → 开缓存

export function createCompiler(
  config: ResolvedConfig,
  options?: CompilerOptions,
): {
  run(): Promise<CompilerRunResult>
  analyze(): Promise<Omit<CompilerRunResult, 'dests'>>
  applyWatchTick(args: {
    changedIds: string[]
    deletedIds: string[]
    addedRelPaths: string[]
  }): Promise<CompilerTickResult>
  watch(): Promise<{ close(): Promise<void> }>
}

export const TRANSFORM_CACHE_MAX_FILES = 4096
export function transformCacheDir(rootDir: string): string
export function transformCacheKey(input: {
  hash: string
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  css: { lightningcss: boolean }
  minify: boolean | Record<string, boolean>
  platform?: string
  ifdefTokens: Record<string, boolean | string>
  coreVersion: string
  swcVersion: string
  lightningcssVersion: string
  kind: AbstractKind
  ext: string
  npmCompat: boolean
}): string
export function gcTransformCache(cacheDir: string, maxFiles?: number): Promise<void>
```

裁定（不要再发明另一套）：

- 缓存键额外包含 `kind`、`extname(sourcePath)`、`npmCompat`（SWC 解析依赖扩展名；npmCompat 走另一条 SWC）。**禁止** dest / owner / specifier。
- 不做插件 `cacheKey`：现有 `legacyScss()` 在 load 阶段，已经进 `module.hash`。
- 只对 `script` / `script-module` / `style` 写磁盘缓存（跳过 SWC/Lightning 的那些 kind）。json / template / asset 不写缓存。
- 配置 reload **不** `rm` 缓存目录；键变则 miss。
- `startWatch` 的 `graph`：`compiler.watch()` 用 getter 读 `lastGraph`（`applyGraphChange` 原地改 nodes；全量 `run()` 后 getter 仍能拿到新图）。
- `attachAddedCompanions` 仍按 `resolve(srcDir, id)` 拼路径。本阶段验收是 **已入图 `@one/` 文件的 change**，不修子仓库 add companion。
- `workflow_dispatch` 若 `github.ref` 不是 `refs/tags/v*`，校验步骤失败。不要加 input。
- `emitPlan` 增加可选 `minify` / `cacheDir` / `platform` / `ifdefTokens`。省略 `minify` 时行为与现在一样（false）。默认 `compile.minify` 仍是 false，金样不变。

---

## File map

```
v5/packages/core/src/config/load.ts
v5/packages/core/src/watch/watcher.ts
v5/packages/core/src/compiler.ts
v5/packages/core/src/index.ts
v5/packages/core/src/compile/cache.ts          (create)
v5/packages/core/src/compile/emit.ts
v5/packages/core/src/watch/tick.ts
v5/packages/core/src/__tests__/config.test.ts
v5/packages/core/src/__tests__/readme.test.ts
v5/packages/core/src/__tests__/dev.test.ts
v5/packages/core/src/__tests__/watch-project.test.ts  (create)
v5/packages/core/src/__tests__/cache.test.ts          (create)
v5/packages/core/src/__tests__/gold-demo.test.ts      (只追加 describe，不改 demoConfig)
v5/packages/core/src/__tests__/publish-workflow.test.ts (create)
v5/packages/core/src/__tests__/publish.test.ts        (prepublishOnly 断言)
v5/packages/core/package.json
v5/packages/cli/package.json
v5/packages/cli/src/index.ts
v5/packages/cli/README.md
example/demo/mpbuild.config.js                 (delete)
example/demo/mpbuild.config.mjs                (create)
.github/workflows/publish-mpbuild.yml          (create)
README.md
docs/migration-v5.md
docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md
```

不改：`gold-demo.test.ts` 的 `demoConfig()` / 金样断言语义、图 intern / analyze / plan、根 `package.json` 的 name/version/private 与 `cs:*` 脚本、P0–P3 计划原文。

当前事实（写计划时已核对，不要假装不存在）：

- `CONFIG_NAMES` = `ts` / `mts` / `js`，无 `.mjs`。根 README 已写「或 mpbuild.config.mjs」，但 loadConfig 不会读它；若同时有 `.js` 会抢先。
- `startWatch` 用 `posixRelative(srcDir, abs)` 当 id。子仓库文件变成 `../projects/one/...`，图 id 是 `@one/...`。`watchPaths(graph, srcDir)` 不含 `projects[].src`。
- `intern()`：`projectForPath` 命中 → `posixJoin(project.name, posixRelative(project.src, absPath))`，否则 `npmGraphId`（本阶段 `graphIdFromAbs` 的 fallback **不用** npm 公式，按锁定：否则 `posixRelative(srcDir, abs)`）。
- `emitPlan` 调 `transformModule` / `npmCompat`，不传 `minify`，无磁盘缓存。`createCompiler(config)` 单参数。
- CLI `mpb build` 不认 `--no-cache`。`bin/mpb.js` 已是纯 Node `import('../dist/index.js')`。
- `example/demo/mpbuild.config.js` 是 CJS，注释写「CLI 用 tsx 加载」，不挂 `legacyScss` / `projectConfig`。`gold-demo.test.ts` 自己构造 `ResolvedConfig`。
- core/cli `package.json` 无 `prepublishOnly`。无 `.github/workflows/publish-mpbuild.yml`。根脚本 `"release": "changeset publish"` 仍在。
- 路线图「当前开工」在本计划提交时改为 P5。

---

### Task 1: `mpbuild.config.mjs` 进入 loadConfig + watcher

**Files:**
- Modify: `v5/packages/core/src/config/load.ts`
- Modify: `v5/packages/core/src/watch/watcher.ts`
- Modify: `v5/packages/core/src/compiler.ts`（watch 路径列表）
- Modify: `v5/packages/core/src/index.ts`（导出 `CONFIG_NAMES`）
- Modify: `v5/packages/core/src/__tests__/config.test.ts`
- Modify: `v5/packages/core/src/__tests__/readme.test.ts`
- Modify: `README.md`
- Modify: `docs/migration-v5.md`
- Modify: `v5/packages/cli/README.md`

**Interfaces:**
- Consumes: 现有 `loadConfig(rootDir)`、`startWatch`、`createCompiler(config).watch()`
- Produces: 导出 `CONFIG_NAMES`（顺序 `ts → mts → js → mjs`）。三处监听/加载名单同源。

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/config.test.ts` 的 `describe('loadConfig')` 末尾追加：

```ts
  it('loads mpbuild.config.mjs when no ts/mts/js exists', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.mjs'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'out-mjs' } }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('out-mjs')
    expect(config.configPath.replace(/\\/g, '/')).toMatch(/mpbuild\.config\.mjs$/)
  })

  it('prefers mpbuild.config.js over mpbuild.config.mjs', async () => {
    const root = await tempDir()
    await writeFile(join(root, 'entry.js'), 'export default {}\n')
    await writeFile(
      join(root, 'mpbuild.config.js'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-js' } }\n",
    )
    await writeFile(
      join(root, 'mpbuild.config.mjs'),
      "export default { src: 'src', entry: './entry.js', output: { dir: 'from-mjs' } }\n",
    )
    const config = await loadConfig(root)
    expect(config.output.dir).toBe('from-js')
  })
```

把 `v5/packages/core/src/__tests__/readme.test.ts` **整文件**换成：

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONFIG_NAMES } from '../index'
import { cliDir, coreDir, repoRoot } from './repo'

describe('root README', () => {
  it('documents @mpbuild/cli, mpb, Node >=20, and migration link', () => {
    const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8')
    expect(readme).toContain('@mpbuild/cli')
    expect(readme).toContain('`mpb`')
    expect(readme).toMatch(/Node\.js/)
    expect(readme).toContain('>=20')
    expect(readme).toContain('docs/migration-v5.md')
    expect(readme).toContain('ALL-CONTRIBUTORS-BADGE:START')
    expect(readme).toContain('ALL-CONTRIBUTORS-BADGE:END')
    expect(readme).toContain('ALL-CONTRIBUTORS-LIST:START')
    expect(readme).toContain('ALL-CONTRIBUTORS-LIST:END')
    expect(readme).not.toMatch(/maintained%20with-lerna/)
    expect(readme).not.toContain('https://ximing.github.io/mpbuild/')
    expect(readme).not.toContain('https://mpbuild.gitee.io/')
    expect(readme).toContain('mpbuild.config.ts')
    expect(readme).toContain('type": "module"')
    expect(readme).toContain('mpbuild.config.mjs')
    expect(readme).toContain('不要同时留下')
    expect(readme).toContain(
      'mpbuild.config.ts` → `mpbuild.config.mts` → `mpbuild.config.js` → `mpbuild.config.mjs',
    )
  })

  it('ships npm README files for core and cli', () => {
    const coreReadme = readFileSync(join(coreDir, 'README.md'), 'utf8')
    const cliReadme = readFileSync(join(cliDir, 'README.md'), 'utf8')
    expect(coreReadme).toContain('@mpbuild/core')
    expect(coreReadme).toContain('createCompiler')
    expect(cliReadme).toContain('@mpbuild/cli')
    expect(cliReadme).toContain('`mpb`')
    expect(cliReadme).toContain('Node.js')
    expect(cliReadme).toContain('mpbuild.config.mjs')
  })

  it('marks P5 as current work without editing P0-P3 acceptance lines', () => {
    const roadmap = readFileSync(
      join(repoRoot, 'docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md'),
      'utf8',
    )
    expect(roadmap).toMatch(/当前开工：P5/)
    expect(roadmap).toContain('2026-08-20-mpbuild-v5-p5-ship.md')
    expect(roadmap).toContain('2026-08-19-mpbuild-v5-p4-release.md')
    expect(roadmap).toContain('`mpb inspect graph` 打出节点/边；假 adapter 快照通过')
    expect(roadmap).toContain(
      '`mpb build` 打出页面四件套；`plugin://` 不失败；命令为 `mpb`；4.x 包删除',
    )
    expect(roadmap).toContain('Watch 状态机 + `mpb dev` + 增量正确性用例')
    expect(roadmap).toContain('`example/demo` 语义对比 CI')
  })

  it('locks CONFIG_NAMES order with js before mjs', () => {
    expect(CONFIG_NAMES).toEqual([
      'mpbuild.config.ts',
      'mpbuild.config.mts',
      'mpbuild.config.js',
      'mpbuild.config.mjs',
    ])
    const watcher = readFileSync(join(coreDir, 'src/watch/watcher.ts'), 'utf8')
    const compiler = readFileSync(join(coreDir, 'src/compiler.ts'), 'utf8')
    expect(watcher).toContain('CONFIG_NAMES')
    expect(compiler).toContain('CONFIG_NAMES')
    expect(watcher).toContain('mpbuild.config.mjs')
  })
})
```

把 `migration.test.ts` 的 required 数组 **追加** `'mpbuild.config.mjs'`（保留原有 token，不要删「不要同时留下」）：

在 `v5/packages/core/src/__tests__/migration.test.ts` 的 `required` 里现有 `'mpbuild.config.ts'` 后面加一行 `'mpbuild.config.mjs'`。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/config.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts
```

Expected: FAIL。`loadConfig` 在只有 `.mjs` 时抛 `CONFIG_NOT_FOUND`；`CONFIG_NAMES` 尚未导出或仍是 3 项；README 加载顺序字符串还停在 `.js` 结尾。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/src/config/load.ts` 把 `CONFIG_NAMES` 改成导出：

```ts
export const CONFIG_NAMES = [
  'mpbuild.config.ts',
  'mpbuild.config.mts',
  'mpbuild.config.js',
  'mpbuild.config.mjs',
] as const
```

`v5/packages/core/src/index.ts` 增加：

```ts
export { defineConfig, loadConfig, CONFIG_NAMES } from './config/load.js'
```

（删掉原来只导出 `defineConfig, loadConfig` 的那一行，避免重复。）

`v5/packages/core/src/watch/watcher.ts`：删掉本地 `CONFIG_NAMES` Set，改为：

```ts
import { CONFIG_NAMES } from '../config/load.js'

const CONFIG_NAME_SET = new Set<string>(CONFIG_NAMES)

function isConfigFile(filePath: string): boolean {
  return CONFIG_NAME_SET.has(basename(filePath))
}
```

`v5/packages/core/src/compiler.ts`：增加 `import { CONFIG_NAMES } from './config/load.js'`。把 `watch()` 里硬编码的三个 `mpbuild.config.*` 换成：

```ts
    const paths = [
      ...watchPaths(lastGraph, srcDir),
      ...CONFIG_NAMES.map((name) => join(config.rootDir, name)),
    ]
```

根 `README.md`「## 配置」第一段改成：

```markdown
项目根使用 `mpbuild.config.ts` / `mpbuild.config.mts` / `mpbuild.config.js` / `mpbuild.config.mjs`（`export default` 或 `module.exports`）。加载顺序：`mpbuild.config.ts` → `mpbuild.config.mts` → `mpbuild.config.js` → `mpbuild.config.mjs`（**.js 在 .mjs 前**，已有 `.js` 项目行为不变）。生产 bin 不能加载 `.ts` / `.mts`；生产请用 `.js` 或 `.mjs`。生产环境不要同时留下 `mpbuild.config.ts` / `.mts`，否则会先加载它们并失败，请删掉或只留 `.js` / `.mjs`。
```

保留后面「该示例需要 `package.json` 的 `"type": "module"`，或把文件命名为 `mpbuild.config.mjs`」那句。

`docs/migration-v5.md` §2 第一句改成同样的加载顺序（必须出现 `mpbuild.config.ts` → `mts` → `js` → `mjs` 这一串，且含 `mpbuild.config.mjs`）。生产配置一句改成「请把发布配置写成 `mpbuild.config.js` 或 `mpbuild.config.mjs`」。

`v5/packages/cli/README.md` 配置那行改成：

```markdown
配置文件：`mpbuild.config.js` 或 `mpbuild.config.mjs`（生产请用 JS）。详见仓库 `docs/migration-v5.md`。
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/config.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/config/load.ts v5/packages/core/src/watch/watcher.ts v5/packages/core/src/compiler.ts v5/packages/core/src/index.ts v5/packages/core/src/__tests__/config.test.ts v5/packages/core/src/__tests__/readme.test.ts v5/packages/core/src/__tests__/migration.test.ts README.md docs/migration-v5.md v5/packages/cli/README.md
git -c trailer.ifexists=doNothing commit -m "feat: load mpbuild.config.mjs after js"
```

---

### Task 2: `graphIdFromAbs` + watchPaths 含 `projects.src`

**Files:**
- Modify: `v5/packages/core/src/watch/watcher.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/index.ts`
- Modify: `v5/packages/core/src/__tests__/dev.test.ts`
- Create: `v5/packages/core/src/__tests__/watch-project.test.ts`

**Interfaces:**
- Consumes: `intern()` 公式（`projectForPath` + `posixJoin(project.name, posixRelative(project.src, abs))`）、现有 `watchPaths` / `startWatch` / `applyWatchTick`
- Produces: `graphIdFromAbs`；`watchPaths(graph, srcDir, projects?)`；`startWatch` 增加 `graph` + `projects`。`compiler.watch()` 必须传入二者（`graph` 用 getter 读 `lastGraph`）。

- [ ] **Step 1: Write the failing test**

把 `v5/packages/core/src/__tests__/dev.test.ts` 的 `watchPaths` 用例改成（原断言保留，并加 projects）：

```ts
describe('watchPaths', () => {
  it('includes sourcePath and srcDir, drops node_modules even when in the graph', () => {
    const srcDir = join('/proj', 'src')
    const appPath = join(srcDir, 'app.js')
    const npmPath = join(srcDir, 'node_modules', 'x.js')
    const projectSrc = join('/proj', 'projects', 'one')
    const graph: ModuleGraph = {
      entries: ['app.js'],
      nodes: new Map([
        ['app.js', mod('app.js', appPath)],
        ['node_modules/x.js', mod('node_modules/x.js', npmPath)],
      ]),
      edges: [],
      packages: [],
    }

    const paths = watchPaths(graph, srcDir, [{ name: '@one', src: projectSrc, alias: {} }])
    expect(paths).toContain(appPath)
    expect(paths).toContain(srcDir)
    expect(paths).toContain(projectSrc)
    expect(paths).not.toContain(npmPath)
    expect(paths.some((p) => p.includes(`${sep}node_modules${sep}`))).toBe(false)
  })
})
```

创建 `v5/packages/core/src/__tests__/watch-project.test.ts`：

```ts
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCompiler,
  graphIdFromAbs,
  startWatch,
  watchPaths,
  weappAdapter,
} from '../index'
import type { Module, ModuleGraph, ResolvedConfig } from '../index'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-watch-one-'))
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

function configOf(rootDir: string, oneSrc: string): ResolvedConfig {
  return {
    rootDir,
    src: 'src',
    target: weappAdapter,
    entry: { pages: [] },
    output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
    resolve: {
      alias: { '@one': oneSrc },
      extensions: weappAdapter.sourceExts,
    },
    compile: {
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
    },
    subPackage: { shared: 'duplicate' },
    projects: [{ name: '@one', src: oneSrc, alias: {} }],
    ifdef: { tokens: {}, blockcode: true },
    appEntry: { pages: [] },
    configPath: '',
  }
}

describe('graphIdFromAbs', () => {
  it('returns @one id from sourcePath, not ../projects/one', async () => {
    const rootDir = await fixture({
      'src/app.js': "require('@one/utils/b')\n",
      'projects/one/utils/b.js': 'module.exports = 1\n',
    })
    const srcDir = join(rootDir, 'src')
    const oneSrc = join(rootDir, 'projects', 'one')
    const abs = join(oneSrc, 'utils', 'b.js')
    const graph: ModuleGraph = {
      entries: ['app.js'],
      nodes: new Map([
        [
          '@one/utils/b.js',
          {
            id: '@one/utils/b.js',
            kind: 'script',
            sourcePath: abs,
            owner: 'main',
            hash: '',
            meta: {},
          } satisfies Module,
        ],
      ]),
      edges: [],
      packages: [],
    }
    const projects = [{ name: '@one', src: oneSrc, alias: {} }]
    expect(graphIdFromAbs(graph, abs, srcDir, projects)).toBe('@one/utils/b.js')
    expect(graphIdFromAbs(graph, abs, srcDir, projects)).not.toContain('../')
  })

  it('falls back to intern formula when sourcePath is missing', async () => {
    const rootDir = await fixture({
      'src/app.js': 'App({})\n',
      'projects/one/utils/b.js': 'module.exports = 1\n',
    })
    const srcDir = join(rootDir, 'src')
    const oneSrc = join(rootDir, 'projects', 'one')
    const abs = join(oneSrc, 'utils', 'b.js')
    const empty: ModuleGraph = { entries: [], nodes: new Map(), edges: [], packages: [] }
    expect(
      graphIdFromAbs(empty, abs, srcDir, [{ name: '@one', src: oneSrc, alias: {} }]),
    ).toBe('@one/utils/b.js')
    expect(graphIdFromAbs(empty, join(srcDir, 'app.js'), srcDir, [])).toBe('app.js')
  })
})

describe('createCompiler @one watch', () => {
  it('applyWatchTick and chokidar change update dist/@one', async () => {
    const rootDir = await fixture({
      'src/app.js': "require('@one/utils/b')\n",
      'src/app.json': JSON.stringify({ pages: ['pages/index/index'] }),
      'src/pages/index/index.js': 'Page({})\n',
      'projects/one/utils/b.js': 'module.exports = 1\n',
    })
    const oneSrc = join(rootDir, 'projects', 'one')
    const compiler = createCompiler(configOf(rootDir, oneSrc))
    await compiler.run()
    const dest = join(rootDir, 'dist/@one/utils/b.js')
    expect(existsSync(dest)).toBe(true)

    await writeFile(join(oneSrc, 'utils', 'b.js'), "module.exports = 'from-one-v2'\n")
    const tick = await compiler.applyWatchTick({
      changedIds: ['@one/utils/b.js'],
      deletedIds: [],
      addedRelPaths: [],
    })
    expect(await readFile(dest, 'utf8')).toContain('from-one-v2')

    const srcDir = join(rootDir, 'src')
    const seen: string[] = []
    const handle = await startWatch({
      paths: watchPaths(tick.graph, srcDir, [{ name: '@one', src: oneSrc, alias: {} }]),
      srcDir,
      graph: tick.graph,
      projects: [{ name: '@one', src: oneSrc, alias: {} }],
      onTick: async (batch) => {
        seen.push(...batch.changedIds)
      },
      onConfigChange: async () => {},
    })
    try {
      await writeFile(join(oneSrc, 'utils', 'b.js'), "module.exports = 'from-one-v3'\n")
      await vi.waitFor(
        () => {
          expect(seen).toContain('@one/utils/b.js')
        },
        { timeout: 4000 },
      )
    } finally {
      await handle.close()
    }

    const live = await compiler.watch()
    try {
      await writeFile(join(oneSrc, 'utils', 'b.js'), "module.exports = 'from-one-v4'\n")
      await vi.waitFor(
        async () => {
          expect(await readFile(dest, 'utf8')).toContain('from-one-v4')
        },
        { timeout: 4000 },
      )
    } finally {
      await live.close()
    }
  })
})
```

不要给 `applyWatchTick` 加 `changedIds` 返回字段。change 的 id 断言走 `startWatch` 的 `seen`；`applyWatchTick` / `compiler.watch()` 断言 dist 更新。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/watch-project.test.ts src/__tests__/dev.test.ts
```

Expected: FAIL。`graphIdFromAbs` / `startWatch` 未从 `../index` 导出；`watchPaths` 不含 `projectSrc`。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/src/watch/watcher.ts` 全文件换成：

```ts
import { basename, dirname, resolve, sep } from 'node:path'
import chokidar from 'chokidar'
import type { SubProject } from '../config/schema.js'
import { posixJoin, posixRelative } from '../graph/walk.js'
import { projectForPath } from '../resolve/resolver.js'
import type { ModuleGraph } from '../types.js'
import { CONFIG_NAMES } from '../config/load.js'

const NODE_MODULES_SEG = `${sep}node_modules${sep}`
const CONFIG_NAME_SET = new Set<string>(CONFIG_NAMES)
const DEBOUNCE_MS = 80

/** 已入图 sourcePath + 每个 script 的 dirname + srcDir + projects[].src；去掉含 node_modules 段的路径。 */
export function watchPaths(
  graph: ModuleGraph,
  srcDir: string,
  projects?: SubProject[],
): string[] {
  const paths = new Set<string>()
  if (!hasNodeModules(srcDir)) {
    paths.add(srcDir)
  }
  for (const project of projects ?? []) {
    if (project.src && !hasNodeModules(project.src)) {
      paths.add(project.src)
    }
  }
  for (const node of graph.nodes.values()) {
    if (!node.sourcePath || hasNodeModules(node.sourcePath)) {
      continue
    }
    paths.add(node.sourcePath)
    if (node.kind === 'script') {
      paths.add(dirname(node.sourcePath))
    }
  }
  return [...paths]
}

function hasNodeModules(filePath: string): boolean {
  return filePath.includes(NODE_MODULES_SEG)
}

function isConfigFile(filePath: string): boolean {
  return CONFIG_NAME_SET.has(basename(filePath))
}

/** 先按 sourcePath 精确匹配节点 id；否则 intern 子仓库公式，否则相对 srcDir。 */
export function graphIdFromAbs(
  graph: ModuleGraph,
  absPath: string,
  srcDir: string,
  projects?: SubProject[],
): string {
  const abs = resolve(absPath)
  for (const node of graph.nodes.values()) {
    if (node.sourcePath && resolve(node.sourcePath) === abs) {
      return node.id
    }
  }
  const project = projectForPath(abs, projects)
  if (project) {
    return posixJoin(project.name, posixRelative(project.src, abs))
  }
  return posixRelative(srcDir, abs)
}

/** chokidar 监听 paths，80ms debounce 后按事件类型回调。id 走 graphIdFromAbs。 */
export async function startWatch(input: {
  paths: string[]
  srcDir: string
  graph: ModuleGraph
  projects?: SubProject[]
  onTick: (batch: { changedIds: string[]; deletedIds: string[]; addedRelPaths: string[] }) => Promise<void>
  onConfigChange: () => Promise<void>
}): Promise<{ close(): Promise<void> }> {
  const watcher = chokidar.watch(input.paths, {
    ignoreInitial: true,
    ignored: /node_modules/,
  })

  const addedRelPaths = new Set<string>()
  const deletedIds = new Set<string>()
  const changedIds = new Set<string>()
  let configChanged = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let closed = false

  const toId = (absPath: string): string =>
    graphIdFromAbs(input.graph, absPath, input.srcDir, input.projects)

  const flush = async (): Promise<void> => {
    if (closed || running) {
      return
    }
    running = true
    try {
      while (!closed) {
        const reload = configChanged
        const batch = {
          addedRelPaths: [...addedRelPaths],
          deletedIds: [...deletedIds],
          changedIds: [...changedIds],
        }
        addedRelPaths.clear()
        deletedIds.clear()
        changedIds.clear()
        configChanged = false
        if (reload) {
          await input.onConfigChange()
        } else if (batch.addedRelPaths.length || batch.deletedIds.length || batch.changedIds.length) {
          await input.onTick(batch)
        }
        if (closed || configChanged || addedRelPaths.size || deletedIds.size || changedIds.size) {
          continue
        }
        break
      }
    } finally {
      running = false
    }
  }

  const schedule = (): void => {
    if (closed) {
      return
    }
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, DEBOUNCE_MS)
  }

  watcher.on('add', (filePath) => {
    if (isConfigFile(filePath)) {
      configChanged = true
    } else {
      const id = toId(filePath)
      deletedIds.delete(id)
      addedRelPaths.add(id)
    }
    schedule()
  })
  watcher.on('unlink', (filePath) => {
    if (isConfigFile(filePath)) {
      configChanged = true
    } else {
      const id = toId(filePath)
      addedRelPaths.delete(id)
      changedIds.delete(id)
      deletedIds.add(id)
    }
    schedule()
  })
  watcher.on('change', (filePath) => {
    if (isConfigFile(filePath)) {
      configChanged = true
    } else {
      changedIds.add(toId(filePath))
    }
    schedule()
  })

  await new Promise<void>((resolveReady, reject) => {
    watcher.once('ready', () => resolveReady())
    watcher.once('error', reject)
  })

  return {
    async close() {
      closed = true
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      await watcher.close()
    },
  }
}
```

`v5/packages/core/src/compiler.ts` 的 `watch()` 换成（保留 `run()` 等其余函数）：

```ts
  async function watch(): Promise<{ close(): Promise<void> }> {
    if (!didEmit) {
      await run()
    }
    const srcDir = resolve(config.rootDir, config.src)
    const projects = (config.projects ?? []).map((project) => ({
      ...project,
      src: resolve(config.rootDir, project.src),
    }))
    const paths = [
      ...watchPaths(lastGraph, srcDir, projects),
      ...CONFIG_NAMES.map((name) => join(config.rootDir, name)),
    ]
    if (config.configPath) {
      paths.push(config.configPath)
    }
    return startWatch({
      paths,
      srcDir,
      get graph() {
        return lastGraph
      },
      projects,
      onTick: async (batch) => {
        await applyWatchTick(batch)
      },
      onConfigChange: async () => {
        await run()
      },
    })
  }
```

`v5/packages/core/src/index.ts` 把 watch 导出改成：

```ts
export { watchPaths, graphIdFromAbs, startWatch } from './watch/watcher.js'
```

不要改 `intern()`、`applyGraphChange`、plan / analyze。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/watch-project.test.ts src/__tests__/dev.test.ts src/__tests__/watch-tick.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/watch/watcher.ts v5/packages/core/src/compiler.ts v5/packages/core/src/index.ts v5/packages/core/src/__tests__/dev.test.ts v5/packages/core/src/__tests__/watch-project.test.ts
git -c trailer.ifexists=doNothing commit -m "fix: map watch events to @one graph ids"
```

---

### Task 3: 磁盘 transform 缓存 + `--no-cache`

**Files:**
- Create: `v5/packages/core/src/compile/cache.ts`
- Create: `v5/packages/core/src/__tests__/cache.test.ts`
- Modify: `v5/packages/core/src/compile/emit.ts`
- Modify: `v5/packages/core/src/compiler.ts`
- Modify: `v5/packages/core/src/watch/tick.ts`
- Modify: `v5/packages/core/src/index.ts`
- Modify: `v5/packages/cli/src/index.ts`
- Modify: `README.md`（加 `mpb build --no-cache`）
- Modify: `docs/migration-v5.md`（一句 `--no-cache`）
- Modify: `v5/packages/core/src/__tests__/readme.test.ts`（token `--no-cache`）

**Interfaces:**
- Consumes: 现有 `transformModule` / `npmCompat` / `createCompiler(config)` / CLI `argv[2] === 'build'`
- Produces: `createCompiler(config, { cache?: boolean })`；`transformCacheDir` / `transformCacheKey` / `gcTransformCache` / `TRANSFORM_CACHE_MAX_FILES`；`mpb build --no-cache` 传 `{ cache: false }`。`emitPlan` 增加可选 `cacheDir` / `minify` / `platform` / `ifdefTokens`。

- [ ] **Step 1: Write the failing test**

创建 `v5/packages/core/src/__tests__/cache.test.ts`：

```ts
import { existsSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TRANSFORM_CACHE_MAX_FILES,
  createCompiler,
  gcTransformCache,
  transformCacheDir,
  transformCacheKey,
  weappAdapter,
} from '../index'
import type { ResolvedConfig } from '../index'
import { cliDir, coreDir, readJson, v5Dir } from './repo'

const dirs: string[] = []

async function fixture(files: Record<string, string>) {
  const rootDir = await mkdtemp(join(tmpdir(), 'mpbuild-cache-'))
  dirs.push(rootDir)
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(rootDir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
  return rootDir
}

function configOf(rootDir: string, extra: Partial<ResolvedConfig> = {}): ResolvedConfig {
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
    ...extra,
  }
}

function mini(files: Record<string, string> = {}): Record<string, string> {
  return {
    'src/app.js': 'App({})\n',
    'src/app.json': JSON.stringify({ pages: ['pages/p/p'] }),
    'src/pages/p/p.js': 'Page({ x: 1 })\n',
    ...files,
  }
}

function cacheFiles(rootDir: string): string[] {
  const dir = transformCacheDir(rootDir)
  if (!existsSync(dir)) {
    return []
  }
  return readdirSync(dir).filter((name) => !name.startsWith('.'))
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('transform cache', () => {
  it('locks sha256, cache dir, max files, and omits dest/owner from the key', () => {
    expect(TRANSFORM_CACHE_MAX_FILES).toBe(4096)
    expect(transformCacheDir('/app')).toBe(join('/app', 'node_modules', '.cache', 'mpbuild'))
    const corePkg = readJson(join(coreDir, 'package.json'))
    const deps = corePkg.dependencies as Record<string, string>
    expect(deps.xxhash).toBeUndefined()
    expect(deps.blake3).toBeUndefined()
    expect(deps['hash-wasm']).toBeUndefined()
    const a = transformCacheKey({
      hash: 'aaa',
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
      platform: 'wx',
      ifdefTokens: {},
      coreVersion: '2.0.0',
      swcVersion: '1',
      lightningcssVersion: '1',
      kind: 'script',
      ext: '.js',
      npmCompat: false,
    })
    const b = transformCacheKey({
      hash: 'bbb',
      js: { target: 'es2018', module: 'commonjs' },
      css: { lightningcss: true },
      minify: false,
      platform: 'wx',
      ifdefTokens: {},
      coreVersion: '2.0.0',
      swcVersion: '1',
      lightningcssVersion: '1',
      kind: 'script',
      ext: '.js',
      npmCompat: false,
    })
    expect(a).toMatch(/^[a-f0-9]{64}$/)
    expect(a).not.toBe(b)
    expect(a).not.toContain('dist')
    expect(a).not.toContain('owner')
  })

  it('second build reads cache files; hash change misses; no-cache skips io', async () => {
    const rootDir = await fixture(mini())
    const dest = join(rootDir, 'dist/pages/p/p.js')
    await createCompiler(configOf(rootDir)).run()
    const first = cacheFiles(rootDir)
    expect(first.length).toBeGreaterThan(0)
    const cacheDir = transformCacheDir(rootDir)
    for (const name of first) {
      const file = join(cacheDir, name)
      writeFileSync(file, `/*CACHE_HIT*/\n${readFileSync(file, 'utf8')}`)
    }

    await createCompiler(configOf(rootDir)).run()
    expect(await readFile(dest, 'utf8')).toContain('CACHE_HIT')

    await writeFile(join(rootDir, 'src/pages/p/p.js'), 'Page({ x: 2 })\n')
    await createCompiler(configOf(rootDir)).run()
    expect(await readFile(dest, 'utf8')).toContain('x: 2')
    expect(await readFile(dest, 'utf8')).not.toContain('CACHE_HIT')
    expect(cacheFiles(rootDir).length).toBeGreaterThan(first.length)

    const isolated = await fixture(mini())
    await createCompiler(configOf(isolated), { cache: false }).run()
    expect(cacheFiles(isolated)).toEqual([])
    expect(existsSync(join(isolated, 'dist/pages/p/p.js'))).toBe(true)

    for (const name of cacheFiles(rootDir)) {
      const file = join(cacheDir, name)
      writeFileSync(file, `/*CACHE_HIT*/\n${readFileSync(file, 'utf8')}`)
    }
    await createCompiler(configOf(rootDir), { cache: false }).run()
    expect(await readFile(dest, 'utf8')).not.toContain('CACHE_HIT')
  })

  it('output.clean does not delete the transform cache', async () => {
    const rootDir = await fixture(mini())
    await createCompiler(configOf(rootDir)).run()
    const names = cacheFiles(rootDir)
    expect(names.length).toBeGreaterThan(0)
    await createCompiler(configOf(rootDir)).run()
    expect(cacheFiles(rootDir).length).toBeGreaterThan(0)
    for (const name of names) {
      expect(existsSync(join(transformCacheDir(rootDir), name))).toBe(true)
    }
  })

  it('gc drops oldest files down to maxFiles', async () => {
    const rootDir = await fixture({})
    const dir = transformCacheDir(rootDir)
    await mkdir(dir, { recursive: true })
    const now = Date.now() / 1000
    for (const [i, name] of ['a', 'b', 'c', 'd'].entries()) {
      const file = join(dir, name)
      writeFileSync(file, name)
      utimesSync(file, now + i, now + i)
    }
    await gcTransformCache(dir, 2)
    const left = readdirSync(dir).sort()
    expect(left).toEqual(['c', 'd'])
  })
})

describe('mpb build --no-cache', () => {
  it('does not write cache files', { timeout: 60_000 }, async () => {
    const rootDir = await fixture({
      ...mini(),
      'package.json': JSON.stringify({ type: 'module' }),
      'mpbuild.config.js':
        "export default { src: 'src', entry: { pages: ['pages/p/p'] } }\n",
    })
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
    const result = spawnSync(process.execPath, [join(cliDir, 'bin/mpb.js'), 'build', '--no-cache'], {
      cwd: rootDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
    })
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    expect(cacheFiles(rootDir)).toEqual([])
    expect(existsSync(join(rootDir, 'dist/pages/p/p.js'))).toBe(true)
  })
})
```

`v5/packages/core/src/__tests__/readme.test.ts` 的根 README 用例追加：

```ts
    expect(readme).toContain('--no-cache')
```

`docs/migration-v5.md` 的命令列表（`mpb build` 那段）必须能被 migration 测试扫到 `--no-cache`：在 `migration.test.ts` 的 `required` 数组追加 `'--no-cache'`。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/cache.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts
```

Expected: FAIL。`TRANSFORM_CACHE_MAX_FILES` / `transformCacheDir` 未导出。

- [ ] **Step 3: Write minimal implementation**

创建 `v5/packages/core/src/compile/cache.ts`：

```ts
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AbstractKind } from '../types.js'

export const TRANSFORM_CACHE_MAX_FILES = 4096

const require = createRequire(import.meta.url)
const corePkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'),
) as { version: string }

export function compilerDepVersions(): {
  coreVersion: string
  swcVersion: string
  lightningcssVersion: string
} {
  return {
    coreVersion: corePkg.version,
    swcVersion: (require('@swc/core/package.json') as { version: string }).version,
    lightningcssVersion: (require('lightningcss/package.json') as { version: string }).version,
  }
}

export function transformCacheDir(rootDir: string): string {
  return join(rootDir, 'node_modules', '.cache', 'mpbuild')
}

export function transformCacheKey(input: {
  hash: string
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  css: { lightningcss: boolean }
  minify: boolean | Record<string, boolean>
  platform?: string
  ifdefTokens: Record<string, boolean | string>
  coreVersion: string
  swcVersion: string
  lightningcssVersion: string
  kind: AbstractKind
  ext: string
  npmCompat: boolean
}): string {
  const payload = JSON.stringify({
    hash: input.hash,
    js: input.js,
    css: input.css,
    minify: input.minify,
    platform: input.platform ?? '',
    ifdefTokens: input.ifdefTokens,
    coreVersion: input.coreVersion,
    swcVersion: input.swcVersion,
    lightningcssVersion: input.lightningcssVersion,
    kind: input.kind,
    ext: input.ext,
    npmCompat: input.npmCompat,
  })
  return createHash('sha256').update(payload).digest('hex')
}

export async function readTransformCache(cacheDir: string, key: string): Promise<string | undefined> {
  try {
    return await readFile(join(cacheDir, key), 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw err
  }
}

export async function writeTransformCache(
  cacheDir: string,
  key: string,
  code: string,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(join(cacheDir, key), code)
  await gcTransformCache(cacheDir, TRANSFORM_CACHE_MAX_FILES)
}

export async function gcTransformCache(
  cacheDir: string,
  maxFiles: number = TRANSFORM_CACHE_MAX_FILES,
): Promise<void> {
  if (!existsSync(cacheDir)) {
    return
  }
  const names = readdirSync(cacheDir).filter((name) => {
    try {
      return statSync(join(cacheDir, name)).isFile()
    } catch {
      return false
    }
  })
  if (names.length <= maxFiles) {
    return
  }
  const ranked = names
    .map((name) => {
      const file = join(cacheDir, name)
      return { file, mtime: statSync(file).mtimeMs }
    })
    .sort((a, b) => a.mtime - b.mtime)
  const drop = ranked.length - maxFiles
  await Promise.all(ranked.slice(0, drop).map((item) => rm(item.file, { force: true })))
}

export function cacheExt(sourcePath: string): string {
  return extname(sourcePath).toLowerCase()
}
```

`v5/packages/core/src/compile/emit.ts`：给 `emitPlan` input 增加可选字段，并在 transform 前后读写缓存。顶部 `import type { Module, ModuleGraph, OutputPlan }` 改成含 `AbstractKind`（只要一行）。把函数签名和循环换成：

```ts
import { cacheExt, compilerDepVersions, readTransformCache, transformCacheKey, writeTransformCache } from './cache.js'
import type { AbstractKind, Module, ModuleGraph, OutputPlan } from '../types.js'

export async function emitPlan(input: {
  graph: ModuleGraph
  plan: OutputPlan
  outputDir: string
  clean: boolean
  js: { target: 'es5' | 'es2018' | 'es2020'; module: 'commonjs' | 'es6' }
  css?: { lightningcss: boolean }
  previousDests?: Iterable<string>
  preserveNames?: string[]
  npmCompat?: 'weapp' | 'none'
  minify?: boolean | Record<string, boolean>
  cacheDir?: string
  platform?: string
  ifdefTokens?: Record<string, boolean | string>
}): Promise<{ diagnostics: Diagnostic[]; dests: string[] }> {
```

在 `for (const placement of input.plan.placements)` 里，把现有 `useNpmCompat` / `transformModule` 那段换成：

```ts
    const minifyFlag = minifyOf(node.kind, input.minify)
    const useNpmCompat =
      input.npmCompat === 'weapp' && node.kind === 'script' && isNodeModulesPath(node.sourcePath)
    const cacheable =
      node.kind === 'script' || node.kind === 'script-module' || node.kind === 'style'
    const versions = compilerDepVersions()
    const key =
      input.cacheDir && cacheable
        ? transformCacheKey({
            hash: node.hash,
            js: input.js,
            css: input.css ?? { lightningcss: true },
            minify: input.minify ?? false,
            platform: input.platform,
            ifdefTokens: input.ifdefTokens ?? {},
            coreVersion: versions.coreVersion,
            swcVersion: versions.swcVersion,
            lightningcssVersion: versions.lightningcssVersion,
            kind: node.kind,
            ext: cacheExt(node.sourcePath),
            npmCompat: useNpmCompat,
          })
        : undefined
    let code: string | undefined
    if (input.cacheDir && key) {
      code = await readTransformCache(input.cacheDir, key)
    }
    if (code === undefined) {
      const transformed = useNpmCompat
        ? npmCompat({
            kind: node.kind,
            sourcePath: node.sourcePath,
            code: source,
            js: input.js,
          })
        : transformModule({
            kind: node.kind,
            sourcePath: node.sourcePath,
            code: source,
            js: input.js,
            css: input.css,
            minify: minifyFlag,
          })
      code = transformed.code
      if (input.cacheDir && key) {
        await writeTransformCache(input.cacheDir, key, code)
      }
    }
```

文件底部加：

```ts
function minifyOf(
  kind: AbstractKind,
  minify: boolean | Record<string, boolean> | undefined,
): boolean {
  if (minify === true) {
    return true
  }
  if (minify && typeof minify === 'object') {
    return minify[kind] === true
  }
  return false
}
```

`v5/packages/core/src/compiler.ts`：

1. 增加 `import type` 旁：

```ts
export type CompilerOptions = { cache?: boolean }
```

2. `createCompiler` 改成双参数：

```ts
export function createCompiler(
  config: ResolvedConfig,
  options?: CompilerOptions,
): {
```

3. 在闭包顶部：

```ts
  const cacheDir = options?.cache === false ? undefined : transformCacheDir(config.rootDir)
```

并从 `./compile/cache.js` import `transformCacheDir`。

4. `run()` 里 `emitPlan({...})` 增加：

```ts
      minify: config.compile.minify,
      cacheDir,
      platform: config.platform,
      ifdefTokens: config.ifdef?.tokens ?? {},
```

5. `applyWatchTick` 调 `applyWatchTickOnce` 时增加 `cacheDir`。

`v5/packages/core/src/watch/tick.ts` 的 input 增加 `cacheDir?: string`，`emitPlan` 调用增加：

```ts
    minify: config.compile.minify,
    cacheDir: input.cacheDir,
    platform: config.platform,
    ifdefTokens: config.ifdef?.tokens ?? {},
```

`v5/packages/core/src/index.ts` 增加：

```ts
export type { CompilerOptions } from './compiler.js'
export {
  TRANSFORM_CACHE_MAX_FILES,
  transformCacheDir,
  transformCacheKey,
  gcTransformCache,
} from './compile/cache.js'
```

`v5/packages/cli/src/index.ts` 的 build 分支：

```ts
  if (argv[2] === 'build') {
    const config = await loadOrReport(process.cwd())
    if (!config) {
      return
    }
    const { diagnostics } = await createCompiler(config, {
      cache: !argv.includes('--no-cache'),
    }).run()
```

`dev` / `--watch` 不要解析 `--no-cache`。

根 README「## 命令」代码块改成：

```bash
mpb build
mpb build --no-cache
mpb dev
mpb analyze
mpb inspect graph
```

并在代码块下加一句：`--no-cache` 跳过磁盘 transform 缓存（目录 `node_modules/.cache/mpbuild`）。`output.clean` 不会删这个目录。

`docs/migration-v5.md` 命令列表同样加上 `mpb build --no-cache`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/cache.test.ts src/__tests__/emit-delta.test.ts src/__tests__/transform.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts
```

Expected: PASS。`emit-delta` 不传 `cacheDir` 时行为与以前相同。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/compile/cache.ts v5/packages/core/src/compile/emit.ts v5/packages/core/src/compiler.ts v5/packages/core/src/watch/tick.ts v5/packages/core/src/index.ts v5/packages/core/src/__tests__/cache.test.ts v5/packages/core/src/__tests__/readme.test.ts v5/packages/core/src/__tests__/migration.test.ts v5/packages/cli/src/index.ts README.md docs/migration-v5.md
git -c trailer.ifexists=doNothing commit -m "feat: disk transform cache and --no-cache"
```

---

### Task 4: demo `mpbuild.config.mjs` + `mpb build`

**Files:**
- Create: `example/demo/mpbuild.config.mjs`
- Delete: `example/demo/mpbuild.config.js`
- Modify: `v5/packages/core/src/__tests__/gold-demo.test.ts`（**只在文件末尾追加** `describe('example/demo mpbuild.config.mjs')`。禁止改 `demoConfig()`、禁止改现有 `example/demo gold` / `legacyScss load` / `projectConfig generate` 三个 describe 的断言。）

**Interfaces:**
- Consumes: Task 1 的 `.mjs` 加载；P4 的 `core/dist` + `cli/bin/mpb.js`；现有 `compareGold`；`legacyScss` / `projectConfig` / `defineConfig`
- Produces: demo 配置与 `demoConfig()` 字段同构（alias / projects / platform / `output.dir: 'dist-v5'` / 两个插件）。手造 ResolvedConfig 的金样用例语义不变。新测试必须写在同一文件，避免与金样并行抢 `example/demo/dist-v5`。

- [ ] **Step 1: Write the failing test**

在 `v5/packages/core/src/__tests__/gold-demo.test.ts` **只改顶部 import**（不要动 `demoConfig`）：

- 增加 `import { spawnSync } from 'node:child_process'`
- 把 `import { existsSync } from 'node:fs'` 改成 `import { existsSync, readFileSync } from 'node:fs'`
- 在 `../index` 的值 import 里加上 `loadConfig`（与现有 `createCompiler` / `legacyScss` / `projectConfig` / `weappAdapter` 并列）
- 增加 `import { cliDir, v5Dir } from './repo'`
- 保留 `import type { Diagnostic, ResolvedConfig } from '../index'`

在文件**最末尾追加**（不要改 `demoConfig` 和已有 describe）：

```ts
describe('example/demo mpbuild.config.mjs', () => {
  it('loadConfig + createCompiler matches gold, and mpb build exits 0', { timeout: 120_000 }, async () => {
    expect(existsSync(join(demoRoot, 'mpbuild.config.mjs'))).toBe(true)
    expect(existsSync(join(demoRoot, 'mpbuild.config.js'))).toBe(false)
    const cfgText = readFileSync(join(demoRoot, 'mpbuild.config.mjs'), 'utf8')
    expect(cfgText).not.toMatch(/tsx/)
    expect(cfgText).toContain('../../v5/packages/core/dist/index.js')
    expect(cfgText).toContain('legacyScss')
    expect(cfgText).toContain('projectConfig')
    expect(cfgText).toContain("dir: 'dist-v5'")

    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)

    const cfg = await loadConfig(demoRoot)
    expect(cfg.platform).toBe('wx')
    expect(cfg.output.dir).toBe('dist-v5')
    expect(cfg.projects.map((p) => p.name).sort()).toEqual(['@one', '@two'])
    expect(cfg.plugins?.map((p) => p.name).sort()).toEqual(['legacy-scss', 'project-config'])
    expect(cfg.configPath.replace(/\\/g, '/')).toMatch(/mpbuild\.config\.mjs$/)

    const { diagnostics } = await createCompiler(cfg).run()
    expect(diagnostics.filter((d: Diagnostic) => d.code === 'RESOLVE_MISS')).toEqual([])
    expect(diagnostics.filter((d: Diagnostic) => d.severity === 'error')).toEqual([])

    const { compareGold } = (await import('../../../../../example/demo/scripts/compare-gold.mjs')) as {
      compareGold: (gold: string, dest: string) => Promise<CompareGoldResult>
    }
    const result = await compareGold(goldDir, destDir)
    expect(result.missingPrefixes).toEqual([])
    expect(result.npmQuerystring).toBe(true)
    expect(result.npmUtil).toBe(true)
    expect(result.destPages).toEqual(result.goldPages)
    expect(result.destSubPackages).toEqual(result.goldSubPackages)
    expect(existsSync(join(destDir, 'project.config.json'))).toBe(true)

    const spawned = spawnSync(process.execPath, [join(cliDir, 'bin/mpb.js'), 'build'], {
      cwd: demoRoot,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
    })
    expect(spawned.status, `${spawned.stdout}\n${spawned.stderr}`).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/gold-demo.test.ts
```

Expected: FAIL。`example/demo/mpbuild.config.mjs` 不存在；`mpbuild.config.js` 仍在。

- [ ] **Step 3: Write minimal implementation**

删除 `example/demo/mpbuild.config.js`。

创建 `example/demo/mpbuild.config.mjs`：

```js
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, legacyScss, projectConfig } from '../../v5/packages/core/dist/index.js'

const root = dirname(fileURLToPath(import.meta.url))
const one = join(root, '../projects/one')
const two = join(root, '../projects/two')

export default defineConfig({
  entry: './entry.js',
  src: join(root, 'src'),
  platform: 'wx',
  output: { dir: 'dist-v5', npm: 'npm', clean: true, componentRelative: true },
  resolve: {
    alias: {
      '@one': one,
      '@two': two,
      '@utils': join(root, 'src/utils'),
      '@root': join(root, 'src'),
      '@components': join(root, 'src/components'),
      '@/': ({ importer }) => {
        if (importer.startsWith(one)) {
          return one
        }
        if (importer.startsWith(two)) {
          return two
        }
      },
    },
  },
  projects: [
    {
      name: '@one',
      src: one,
      alias: {
        '@one': one,
        '@two-b': join(two, 'utils/b.js'),
      },
    },
    { name: '@two', src: two, alias: { '@two': two } },
  ],
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'test', appId: 'test', setting: { minified: true } }),
  ],
})
```

注释如果要写：只能写「in-repo 相对 dist；生产用户 `import { defineConfig, legacyScss, projectConfig } from '@mpbuild/core'`」。禁止出现 tsx。

不要改 `demoConfig()`。不要改 `example/demo/scripts/compare-gold.mjs`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/gold-demo.test.ts
```

Expected: PASS。两条金样路径（手造 ResolvedConfig / loadConfig.mjs）都绿；`mpb build` 退出码 0。

- [ ] **Step 5: Commit**

```bash
git add example/demo/mpbuild.config.mjs v5/packages/core/src/__tests__/gold-demo.test.ts
git add -u example/demo/mpbuild.config.js
git -c trailer.ifexists=doNothing commit -m "feat: demo mpb build via mpbuild.config.mjs"
```

---

### Task 5: prepublishOnly + GitHub Actions 发包

**Files:**
- Create: `.github/workflows/publish-mpbuild.yml`
- Create: `v5/packages/core/src/__tests__/publish-workflow.test.ts`
- Modify: `v5/packages/core/package.json`
- Modify: `v5/packages/cli/package.json`
- Modify: `v5/packages/core/src/__tests__/publish.test.ts`（断言 `prepublishOnly` 与 `pack:check`）
- Modify: `README.md`（发布 / `NPM_TOKEN`）
- Modify: `docs/migration-v5.md`（一句：打 `v*` tag，不要本地 publish）
- Modify: `v5/packages/core/src/__tests__/readme.test.ts`
- Modify: `v5/packages/core/src/__tests__/migration.test.ts`

**Interfaces:**
- Consumes: P4 的 `scripts.build` / `pack:check`、包 version `2.0.0`
- Produces: `prepublishOnly: pnpm build`；workflow 在 `v*` tag 上于 `v5/` `pnpm publish -r --filter @mpbuild/core --filter @mpbuild/cli --access public --no-git-checks`，`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`。

- [ ] **Step 1: Write the failing test**

创建 `v5/packages/core/src/__tests__/publish-workflow.test.ts`：

```ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliDir, coreDir, readJson, repoRoot, v5Dir } from './repo'

describe('publish workflow', () => {
  it('publishes from v* tags with NPM_TOKEN and never local npm publish in v5', () => {
    const workflowPath = join(repoRoot, '.github/workflows/publish-mpbuild.yml')
    expect(existsSync(workflowPath)).toBe(true)
    const yml = readFileSync(workflowPath, 'utf8')
    expect(yml).toContain('secrets.NPM_TOKEN')
    expect(yml).toContain('pnpm publish')
    expect(yml).toContain('v*')
    expect(yml).toContain('v5')
    expect(yml).toContain('@mpbuild/core')
    expect(yml).toContain('@mpbuild/cli')
    expect(yml).toContain('actions/checkout@v4')
    expect(yml).toContain('pnpm/action-setup@v4')
    expect(yml).toContain('actions/setup-node@v4')
    expect(yml).toContain("node-version: '22'")
    expect(yml).toContain('registry.npmjs.org')
    expect(yml).toContain('pnpm install --frozen-lockfile')
    expect(yml).toContain('pnpm build')
    expect(yml).toContain('--no-git-checks')
    expect(yml).toContain('--access public')
    expect(yml).toContain('contents: read')
    expect(yml).toContain('ubuntu-latest')
    expect(yml).toContain('workflow_dispatch')
    expect(yml).not.toMatch(/id-token/)
    expect(yml).not.toMatch(/provenance/)
    expect(yml).not.toContain('npm publish')

    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    const v5Pkg = readJson(join(v5Dir, 'package.json'))
    const rootPkg = readJson(join(repoRoot, 'package.json'))
    expect((corePkg.scripts as Record<string, string>).prepublishOnly).toBe('pnpm build')
    expect((cliPkg.scripts as Record<string, string>).prepublishOnly).toBe('pnpm build')
    expect((corePkg.scripts as Record<string, string>)['pack:check']).toContain('pack --dry-run')
    expect((cliPkg.scripts as Record<string, string>)['pack:check']).toContain('pack --dry-run')
    for (const [name, script] of Object.entries((v5Pkg.scripts ?? {}) as Record<string, string>)) {
      expect(name, script).not.toMatch(/^publish$/)
      expect(script).not.toMatch(/\bnpm publish\b/)
      expect(script).not.toMatch(/\bchangeset publish\b/)
      expect(script).not.toMatch(/\bpnpm publish\b/)
    }
    for (const pkg of [corePkg, cliPkg]) {
      for (const [name, script] of Object.entries((pkg.scripts ?? {}) as Record<string, string>)) {
        if (name === 'prepublishOnly') {
          expect(script).toBe('pnpm build')
          continue
        }
        expect(script).not.toMatch(/\bnpm publish\b/)
        expect(script).not.toMatch(/\bpnpm publish\b/)
      }
    }
    expect((rootPkg.scripts as Record<string, string>).release).toBe('changeset publish')
  })
})
```

`readme.test.ts` 根 README 用例追加：

```ts
    expect(readme).toContain('NPM_TOKEN')
    expect(readme).toContain('Secrets and variables')
    expect(readme).toContain('publish-mpbuild.yml')
    expect(readme).not.toMatch(/npm_[A-Za-z0-9]{10,}/)
```

`migration.test.ts` 的 `required` 追加 `'NPM_TOKEN'`。

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/publish-workflow.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts
```

Expected: FAIL。`.github/workflows/publish-mpbuild.yml` 不存在；`prepublishOnly` 为 `undefined`。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/package.json` 的 `scripts` 改成：

```json
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.build.json",
    "pack:check": "pnpm build && npm pack --dry-run",
    "prepublishOnly": "pnpm build"
  }
```

`v5/packages/cli/package.json` 的 `scripts` 改成：

```json
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "pack:check": "pnpm build && npm pack --dry-run",
    "prepublishOnly": "pnpm build"
  }
```

不要改 `exports` / `files` / `dependencies`。不要给 `v5/package.json` 加 publish 脚本。不要改根 `release` / `cs:*`。

创建 `.github/workflows/publish-mpbuild.yml`（整文件）：

```yaml
name: publish-mpbuild

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: v5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - name: Check tag matches package versions
        run: |
          if [[ "${GITHUB_REF}" != refs/tags/v* ]]; then
            echo "publish only from tags matching v*"
            exit 1
          fi
          TAG="${GITHUB_REF_NAME}"
          CORE_VER="$(node -p "require('./packages/core/package.json').version")"
          CLI_VER="$(node -p "require('./packages/cli/package.json').version")"
          if [[ "${CORE_VER}" != "${CLI_VER}" ]]; then
            echo "core ${CORE_VER} != cli ${CLI_VER}"
            exit 1
          fi
          if [[ "${TAG}" != "v${CORE_VER}" ]]; then
            echo "tag ${TAG} != v${CORE_VER}"
            exit 1
          fi
      - run: pnpm publish -r --filter @mpbuild/core --filter @mpbuild/cli --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

根 README 在「## 仓库」之前加：

```markdown
## 发布

不要在本地执行 `npm publish` 或 `changeset publish` 来发 `@mpbuild/*`。给仓库打并 push `v*` tag（包 version 都是 `2.0.0` 时 tag 必须是 `v2.0.0`）后，[`.github/workflows/publish-mpbuild.yml`](.github/workflows/publish-mpbuild.yml) 会在 GitHub Actions 里对 `@mpbuild/core` 与 `@mpbuild/cli` 执行 `pnpm publish`。

在 GitHub Settings → Secrets and variables → Actions 添加名为 `NPM_TOKEN` 的 repository secret（npm 登录 token）。不要把 token 写进仓库。
```

`docs/migration-v5.md` §1 命令列表后加一句：发布走 GitHub Actions 的 `v*` tag，仓库 secret 名是 `NPM_TOKEN`；不要本地 `npm publish`。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/publish-workflow.test.ts src/__tests__/publish.test.ts src/__tests__/package.test.ts src/__tests__/readme.test.ts src/__tests__/migration.test.ts
```

Expected: PASS。然后再跑全量确认没有破坏金样：

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run
```

Expected: 全部 PASS。不要执行 `npm publish` / `changeset publish` / 真正的 `pnpm publish`。

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/publish-mpbuild.yml v5/packages/core/package.json v5/packages/cli/package.json v5/packages/core/src/__tests__/publish-workflow.test.ts v5/packages/core/src/__tests__/readme.test.ts v5/packages/core/src/__tests__/migration.test.ts README.md docs/migration-v5.md
git -c trailer.ifexists=doNothing commit -m "ci: publish @mpbuild packages from v-star tags"
```

提交说明里写 `v-star` 而不是带星号的 tag glob，避免 shell glob。实现与测试仍匹配 `v*`。

---

## Self-review

### Spec coverage

| 规格 / 锁定 | 任务 |
|---|---|
| §14.1 监听 `src` 与 `projects[].src`；`mpbuild.config.*` | Task 1（`.mjs`）、Task 2（`watchPaths` + `@one` id） |
| §14.1 配置变化全量 `loadConfig`（不作废磁盘目录，键变 miss） | 已有 `onConfigChange → run()`；Task 3 裁定不 `rm` 缓存 |
| §14.3 缓存目录 `node_modules/.cache/mpbuild`；键含 hash / compile / platform / ifdef / 版本；禁止 dest/owner；`--no-cache`；`output.clean` 不清缓存；GC | Task 3（算法锁定 sha256，不用 xxhash/blake3） |
| §15 `mpb build --no-cache` | Task 3 |
| §8 / §10 子仓库 id = `project.name` + 相对 `project.src` | Task 2 `graphIdFromAbs`；demo 金样 Task 4 |
| §7 配置名 `mpbuild.config.*` 含 `.mjs`，`.js` 在 `.mjs` 前 | Task 1 |
| demo 能 `mpb build` 并对金样 | Task 4 |
| 发布 `@mpbuild/*@2.0.0`、不发布名为 `mpbuild` 的 5.0、不本地 npm publish | Task 5 |
| GitHub Actions `publish-mpbuild.yml` + `NPM_TOKEN` + Node 22 + pnpm 9 + working-directory `v5` | Task 5 |
| `prepublishOnly` + `pack:check` dry-run | Task 5 |
| 根 `cs:release` / `changeset publish` 保留 | Task 5 断言 |
| 不 rebase origin、不发到 npm、不做 copy/tt/完整 PluginContext | Global Constraints |

缺口：规格 §14.3 写 xxhash/blake3——本阶段按用户锁定改用 sha256。规格 §15 `--minify`、§14.1「配置变化作废全部 transform 缓存目录」、插件 `cacheKey`——明确不做。规格 §14.1 extras / `addWatchFile` / `copy` 源——`copy()` 不做。

### Placeholder scan

无 TBD / TODO / 「类似 Task N」 / 「补适当错误处理」。每个 Step 1 都贴了完整测试。workflow YAML、demo `mpbuild.config.mjs`、`cache.ts` 均为完整内容。

### Type consistency

- `CONFIG_NAMES`：Task 1 导出，Task 2 `watchPaths` / `compiler.watch` 继续用同一常量。
- `graphIdFromAbs(graph, absPath, srcDir, projects?)`：Task 2 定义，`startWatch` 调用同名。
- `watchPaths(graph, srcDir, projects?)`：第三参可选，旧 `dev.test.ts` 补上 projects。
- `createCompiler(config, options?: { cache?: boolean })`：Task 3 增加；Task 4 仍可单参数（默认开缓存）。
- `transformCacheDir` / `transformCacheKey` / `gcTransformCache` / `TRANSFORM_CACHE_MAX_FILES=4096`：Task 3 测试与实现同名。
- CLI：`argv.includes('--no-cache')` 只在 `argv[2] === 'build'`。
- demo 插件 `name`：`legacy-scss` / `project-config`（现有 `legacyScss()` / `projectConfig()` 的 `name` 字段）。

---

## 本阶段不做（再列一次）

- `copy()`、完整 PluginContext、`@mpbuild/target-tt`、tt adapter
- 改 intern / analyze / plan / 归属语义
- 把 `example/demo` 迁到 `v5/packages/example`
- 修 `attachAddedCompanions` 对 `@one/` add 的 `resolve(srcDir, id)`
- 插件 `cacheKey`、配置 reload 时 `rm` 缓存目录、CLI `--minify`
- rebase / 合 origin 的 Snyk 提交
- 本地或本计划执行 `npm publish` / `changeset publish` / 真正把包发到 npm
- 改根包名为 `mpbuild@5`
- 删除根 `cs:*` / `"release": "changeset publish"`
