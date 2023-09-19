# mpbuild 5.0 P4 发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 写出用户能照着改项目的迁移文档和根 README；把 `@mpbuild/core@2.0.0` / `@mpbuild/cli@2.0.0` 做成可 `npm pack` 的包（编译后的 JS + d.ts，CLI `bin/mpb.js` 纯 Node）。不发布名为 `mpbuild` 的 5.0，也不真正 `npm publish`。

**Architecture:** 实现仍只在 `v5/packages/core` 与 `v5/packages/cli`。日常 vitest 继续相对路径测 `src/`。发布用 `tsc -p tsconfig.build.json` 把 `src/` emit 到 `dist/`，`package.json` 的 `exports`/`main`/`types`/`files` 指向 dist。CLI 的 npm bin 改为 `import('../dist/index.js')`，不再 `tsx register` + 加载 TS。tsx 仅作开发脚本 `dev`。

**Tech Stack:** 现有 v5（TypeScript 5、Node >= 20、pnpm、vitest）。构建器用包内已有的 `typescript`，不引入 tsup/tsdown。验收用 `npm pack --dry-run`，禁止 `npm publish` / `changeset publish`。

## Global Constraints

- 命令名是 `mpb`。npm 包名是 `@mpbuild/core`、`@mpbuild/cli`，版本锁 `2.0.0`。禁止改成 `5.0.0`。禁止新增或发布 `name: "mpbuild"` 且 version 以 `5.` 开头的包。
- 根 `package.json` 保持 `private: true`、`name: "mpbuild-project"`、`version: "4.2.1"`。禁止把它改成可发布的 `mpbuild@5.0.0`。
- 实现目录：`v5/packages/core`、`v5/packages/cli`。可新增根 `docs/migration-v5.md`、两包 `README.md`、构建用 `tsconfig.build.json`。不要改图 / plan / emit / watch 语义，不要为了 `mpb build` demo 去改金样。
- **不要**把 `example/demo` 迁进 `v5/packages/example`。
- **不要**实现 `copy()`、完整 PluginContext（`emitModule` / `resolve` / `transform` / `plan` 等规格 §13 未落地钩子）、磁盘 transform 缓存、watch 对 `@one/` id 的补丁、tt adapter、`@mpbuild/target-tt`。
- **不要**恢复 4.x 包。不要把用户导向 `https://ximing.github.io/mpbuild/` 当 5.x 主文档。
- **不要**真正执行 `npm publish` 或 `changeset publish`。只允许 `npm pack --dry-run` / `pnpm pack --dry-run`。
- `example/demo/mpbuild.config.js` 保持 CJS，**不**改成 ESM 去 `import { legacyScss, projectConfig } from '@mpbuild/core'`。金样测试继续自己构造 `ResolvedConfig`。生产 CLI 用 Node 原生 `import()` 加载 `mpbuild.config.js`；`.ts` / `.mts` 配置在去掉 bin 顶部 tsx 后不再保证能加载——迁移文档写明发布配置用 `mpbuild.config.js`。P4 不引入 jiti，不在 core 里为配置文件再做一套 SWC 编译器。
- 日常测试继续跑 **src + vitest**，相对路径 `from '../index'`，不要把单元测试改成必须先 import dist。发布验收测试可以在用例内部自己调 `pnpm build`。
- 测试环境：`eval "$(fnm env)" && fnm use 22`（默认 shell 是 Node 14）。
- TDD：先写失败测试并跑红，再写最少实现。提交：`git -c trailer.ifexists=doNothing commit`，禁止 `Co-authored-by`，禁止提及 AI / Grok / Claude / Cursor / Generated。
- 中文注释；标识符英文。
- 现有 `src/` 在 exclude `__tests__` / `__fixtures__` 后 `tsc` 已能通过。若 emit 失败，只修 tsconfig / 类型入口，禁止借机改编译语义。

---

## File map

```
v5/packages/core/src/__tests__/repo.ts
v5/packages/core/src/__tests__/package.test.ts
v5/packages/core/src/__tests__/publish.test.ts
v5/packages/core/src/__tests__/cli-release.test.ts
v5/packages/core/src/__tests__/migration.test.ts
v5/packages/core/src/__tests__/readme.test.ts
v5/packages/core/package.json
v5/packages/core/tsconfig.build.json
v5/packages/core/README.md
v5/packages/cli/package.json
v5/packages/cli/tsconfig.json
v5/packages/cli/bin/mpb.js
v5/packages/cli/README.md
v5/package.json
docs/migration-v5.md
README.md
docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md
```

不改：`v5/packages/core/src/index.ts` 的 `version` 常量（已是 `'2.0.0'`）、图/编译源码、`example/demo/**`、根 `package.json` 的 name/version/private。

当前事实（写计划时已核对，不要假装不存在）：

- core `exports`/`main`/`types` = `./src/index.ts`；`version` 在 `src/index.ts` 为 `'2.0.0'`。
- CLI `bin/mpb.js`：`tsx/esm/api` `register()` 再 `import('../src/index.ts')`。命令：`inspect graph` | `build` | `dev` | `analyze`。usage 字符串已是 `usage: mpb <inspect graph|build|dev|analyze>`。
- core tsconfig：`rootDir: src`，`outDir: dist`，`include: src/**/*.ts`——**会把 `__tests__` 编进 dist**。必须用 `tsconfig.build.json` exclude。
- CLI 没有 tsconfig、没有 `typescript` devDependency。
- 根 README 仍是 4.x / lerna / `ximing.github.io/mpbuild` 叙事。
- 无 `docs/migration-v5.md`。无两包 README。

---

### Task 1: 包身份锁在 `@mpbuild/*@2.0.0`

**Files:**
- Create: `v5/packages/core/src/__tests__/repo.ts`
- Modify: `v5/packages/core/src/__tests__/package.test.ts`
- Modify: `v5/packages/core/package.json`
- Modify: `v5/packages/cli/package.json`

**Interfaces:**
- Consumes: 现有 `export const version = '2.0.0'`；现有 `bin.mpb` = `./bin/mpb.js`
- Produces:

```ts
export const coreDir: string
export const cliDir: string
export const v5Dir: string
export const repoRoot: string
export function readJson(file: string): Record<string, unknown>
export function listPackageJson(dir: string): string[]
```

core/cli `package.json` 增加（不改 name/version/exports）：`license: "MIT"`、`repository`（git + `directory`）、`publishConfig.access: "public"`。`engines.node` 保持 `>=20.0.0`。

- [ ] **Step 1: Write the failing test**

创建 `v5/packages/core/src/__tests__/repo.ts`：

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const coreDir = join(here, '../..')
export const cliDir = join(here, '../../../cli')
export const v5Dir = join(here, '../../../..')
export const repoRoot = join(here, '../../../../..')

export function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

const SKIP = new Set(['node_modules', 'dist', '.git', '.worktrees'])

export function listPackageJson(dir: string): string[] {
  const out: string[] = []
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    if (SKIP.has(name)) {
      continue
    }
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      out.push(...listPackageJson(p))
    } else if (name === 'package.json') {
      out.push(p)
    }
  }
  return out
}
```

把 `v5/packages/core/src/__tests__/package.test.ts` **整文件**换成：

```ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { version } from '../index'
import { cliDir, coreDir, listPackageJson, readJson, repoRoot } from './repo'

describe('package', () => {
  it('exports a semver version string', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('exposes mpb bin and not mpb5', () => {
    expect(existsSync(join(cliDir, 'bin/mpb.js'))).toBe(true)
    expect(existsSync(join(cliDir, 'bin/mpb5.js'))).toBe(false)
  })
})

describe('package identity', () => {
  it('locks @mpbuild/core and @mpbuild/cli at 2.0.0 with mpb bin', () => {
    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect(corePkg.name).toBe('@mpbuild/core')
    expect(cliPkg.name).toBe('@mpbuild/cli')
    expect(corePkg.version).toBe('2.0.0')
    expect(cliPkg.version).toBe('2.0.0')
    expect(version).toBe('2.0.0')
    expect(corePkg.engines).toEqual({ node: '>=20.0.0' })
    expect(cliPkg.engines).toEqual({ node: '>=20.0.0' })
    expect((cliPkg.bin as Record<string, string>).mpb).toBe('./bin/mpb.js')
    expect((cliPkg.bin as Record<string, string>).mpb5).toBeUndefined()
  })

  it('adds publish metadata without becoming unscoped mpbuild@5', () => {
    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect(corePkg.license).toBe('MIT')
    expect(cliPkg.license).toBe('MIT')
    expect((corePkg.repository as { directory: string }).directory).toBe('v5/packages/core')
    expect((cliPkg.repository as { directory: string }).directory).toBe('v5/packages/cli')
    expect((corePkg.repository as { url: string }).url).toContain('github.com/ximing/mpbuild')
    expect((cliPkg.repository as { url: string }).url).toContain('github.com/ximing/mpbuild')
    expect((corePkg.publishConfig as { access: string }).access).toBe('public')
    expect((cliPkg.publishConfig as { access: string }).access).toBe('public')
  })

  it('keeps the root package private mpbuild-project@4.2.1', () => {
    const rootPkg = readJson(join(repoRoot, 'package.json'))
    expect(rootPkg.name).toBe('mpbuild-project')
    expect(rootPkg.private).toBe(true)
    expect(rootPkg.version).toBe('4.2.1')
  })

  it('has no package.json named mpbuild with version 5.x', () => {
    for (const file of listPackageJson(repoRoot)) {
      const pkg = readJson(file)
      if (pkg.name === 'mpbuild') {
        expect(String(pkg.version)).not.toMatch(/^5\./)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/package.test.ts
```

Expected: FAIL。`license` 为 `undefined`（core/cli 的 package.json 目前没有 `license` / `repository` / `publishConfig`），断言 `toBe('MIT')` 失败。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/package.json` 在现有字段上增加（**不要**改 `exports`/`main`/`types`/`version`/`dependencies`）：

```json
{
  "name": "@mpbuild/core",
  "version": "2.0.0",
  "type": "module",
  "description": "Graph-driven WeChat miniprogram compiler core",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ximing/mpbuild.git",
    "directory": "v5/packages/core"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@swc/core": "^1.16.1",
    "@yeanzhi/postcss-advanced-variables": "^3.1.0",
    "chokidar": "^3.6.0",
    "lightningcss": "^1.30.1",
    "postcss": "^8.5.26",
    "postcss-nested": "^8.0.1",
    "postcss-scss": "^4.0.9",
    "zod": "^4.4.3"
  }
}
```

`v5/packages/cli/package.json` 同样只加元数据，**保留** `tsx` 在 `dependencies`、`exports` 仍指向 `src`：

```json
{
  "name": "@mpbuild/cli",
  "version": "2.0.0",
  "type": "module",
  "description": "CLI for @mpbuild/core (command: mpb)",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ximing/mpbuild.git",
    "directory": "v5/packages/cli"
  },
  "publishConfig": {
    "access": "public"
  },
  "bin": {
    "mpb": "./bin/mpb.js"
  },
  "exports": {
    ".": "./src/index.ts"
  },
  "main": "./src/index.ts",
  "dependencies": {
    "@mpbuild/core": "workspace:*",
    "tsx": "^4.19.2"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/package.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/__tests__/repo.ts v5/packages/core/src/__tests__/package.test.ts v5/packages/core/package.json v5/packages/cli/package.json
git -c trailer.ifexists=doNothing commit -m "feat: lock @mpbuild packages at 2.0.0 publish identity"
```

---

### Task 2: tsc 发布构建与 pack:check

**Files:**
- Create: `v5/packages/core/src/__tests__/publish.test.ts`
- Create: `v5/packages/core/tsconfig.build.json`
- Create: `v5/packages/cli/tsconfig.json`
- Modify: `v5/packages/core/package.json`
- Modify: `v5/packages/cli/package.json`
- Modify: `v5/package.json`
- Modify: `v5/pnpm-lock.yaml`（给 CLI 加 `typescript` / `@types/node` 后）

**Interfaces:**
- Consumes: Task 1 的 `coreDir` / `cliDir` / `v5Dir` / `readJson`
- Produces:

core `package.json`：

```ts
main: './dist/index.js'
types: './dist/index.d.ts'
exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } }
files: ['dist']
scripts.build: 'tsc -p tsconfig.build.json'
scripts.pack:check: 'pnpm build && npm pack --dry-run'
```

cli 同样 `exports`/`main`/`types` 指向 dist，`files: ['dist', 'bin']`，`scripts.build: 'tsc -p tsconfig.json'`。

`v5/package.json` scripts：

```json
{
  "test": "pnpm --filter @mpbuild/core test",
  "build": "pnpm --filter @mpbuild/core build && pnpm --filter @mpbuild/cli build",
  "pack:check": "pnpm --filter @mpbuild/core pack:check && pnpm --filter @mpbuild/cli pack:check"
}
```

`tsconfig.build.json` 必须 exclude `src/__tests__` 与 `src/__fixtures__`。vitest `include` 仍是 `src/**/*.test.ts`，测试继续 import `../index`。

- [ ] **Step 1: Write the failing test**

`v5/packages/core/src/__tests__/publish.test.ts`：

```ts
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliDir, coreDir, readJson, v5Dir } from './repo'

function packPaths(cwd: string): string[] {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd,
    encoding: 'utf8',
  })
  expect(result.status, result.stderr || result.stdout).toBe(0)
  const src = result.stdout.trim()
  const start = Math.min(
    ...[src.indexOf('['), src.indexOf('{')].filter((i) => i >= 0),
  )
  const parsed = JSON.parse(src.slice(start)) as
    | { files: Array<{ path: string }> }
    | Array<{ files: Array<{ path: string }> }>
  const files = Array.isArray(parsed) ? parsed[0]!.files : parsed.files
  return files.map((f) => f.path.replace(/\\/g, '/'))
}

describe('publish build', () => {
  it('points package.json at dist and excludes tests from tsc', () => {
    const corePkg = readJson(join(coreDir, 'package.json'))
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect(corePkg.main).toBe('./dist/index.js')
    expect(corePkg.types).toBe('./dist/index.d.ts')
    expect(corePkg.exports).toEqual({
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
    })
    expect(corePkg.files).toEqual(['dist'])
    expect((corePkg.scripts as Record<string, string>).build).toBe(
      'tsc -p tsconfig.build.json',
    )
    expect(cliPkg.main).toBe('./dist/index.js')
    expect(cliPkg.types).toBe('./dist/index.d.ts')
    expect(cliPkg.exports).toEqual({
      '.': { types: './dist/index.d.ts', import: './dist/index.js' },
    })
    expect(cliPkg.files).toEqual(['dist', 'bin'])
    const buildTsconfig = readJson(join(coreDir, 'tsconfig.build.json'))
    const exclude = buildTsconfig.exclude as string[]
    expect(exclude.some((x) => x.includes('__tests__'))).toBe(true)
    expect(exclude.some((x) => x.includes('__fixtures__'))).toBe(true)
    const v5Pkg = readJson(join(v5Dir, 'package.json'))
    expect((v5Pkg.scripts as Record<string, string>).build).toContain(
      '@mpbuild/core',
    )
    expect((v5Pkg.scripts as Record<string, string>)['pack:check']).toContain(
      'pack:check',
    )
  })

  it('tsc emits dist/index.js + d.ts without __tests__', { timeout: 60_000 }, () => {
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
    expect(existsSync(join(coreDir, 'dist/index.js'))).toBe(true)
    expect(existsSync(join(coreDir, 'dist/index.d.ts'))).toBe(true)
    expect(existsSync(join(coreDir, 'dist/__tests__'))).toBe(false)
    expect(existsSync(join(cliDir, 'dist/index.js'))).toBe(true)
    expect(existsSync(join(cliDir, 'dist/index.d.ts'))).toBe(true)
    const coreFiles = packPaths(coreDir)
    const coreJoined = coreFiles.join('\n')
    expect(coreJoined).toMatch(/dist\/index\.js/)
    expect(coreJoined).toMatch(/dist\/index\.d\.ts/)
    expect(coreJoined).not.toMatch(/__tests__/)
    expect(coreJoined).not.toMatch(/src\/index\.ts/)
    const cliFiles = packPaths(cliDir)
    const cliJoined = cliFiles.join('\n')
    expect(cliJoined).toMatch(/dist\/index\.js/)
    expect(cliJoined).toMatch(/bin\/mpb\.js/)
    expect(cliJoined).not.toMatch(/src\/index\.ts/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/publish.test.ts
```

Expected: FAIL。`corePkg.main` 现为 `./src/index.ts`，不是 `./dist/index.js`；`tsconfig.build.json` 不存在则 `readJson` 抛 ENOENT。

- [ ] **Step 3: Write minimal implementation**

`v5/packages/core/tsconfig.build.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts"],
  "exclude": ["src/__tests__", "src/__fixtures__"]
}
```

`v5/packages/cli/tsconfig.json`：

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

在 `v5/` 安装 CLI 的编译依赖（不要装到 core 以外的业务依赖）：

```bash
eval "$(fnm env)" && fnm use 22
cd v5
pnpm --filter @mpbuild/cli add -D typescript@^5.7.3 @types/node@^22.13.0
```

把 `v5/packages/core/package.json` **整文件**写成（保留 Task 1 元数据与现有 dependencies）：

```json
{
  "name": "@mpbuild/core",
  "version": "2.0.0",
  "type": "module",
  "description": "Graph-driven WeChat miniprogram compiler core",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ximing/mpbuild.git",
    "directory": "v5/packages/core"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.build.json",
    "pack:check": "pnpm build && npm pack --dry-run"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "typescript": "^5.7.3",
    "vitest": "^3.0.5"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "@swc/core": "^1.16.1",
    "@yeanzhi/postcss-advanced-variables": "^3.1.0",
    "chokidar": "^3.6.0",
    "lightningcss": "^1.30.1",
    "postcss": "^8.5.26",
    "postcss-nested": "^8.0.1",
    "postcss-scss": "^4.0.9",
    "zod": "^4.4.3"
  }
}
```

把 `v5/packages/cli/package.json` **整文件**写成（本 Task **仍保留** `dependencies.tsx` 与现有 `bin/mpb.js`，Task 3 再改 bin）。`pnpm add -D` 之后 lockfile 里的 typescript / `@types/node` 版本以安装结果为准，字段名必须如下：

```json
{
  "name": "@mpbuild/cli",
  "version": "2.0.0",
  "type": "module",
  "description": "CLI for @mpbuild/core (command: mpb)",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ximing/mpbuild.git",
    "directory": "v5/packages/cli"
  },
  "publishConfig": {
    "access": "public"
  },
  "bin": {
    "mpb": "./bin/mpb.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "bin"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "pack:check": "pnpm build && npm pack --dry-run"
  },
  "dependencies": {
    "@mpbuild/core": "workspace:*",
    "tsx": "^4.19.2"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "typescript": "^5.7.3"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

`v5/package.json`：

```json
{
  "name": "mpbuild-v5",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "test": "pnpm --filter @mpbuild/core test",
    "build": "pnpm --filter @mpbuild/core build && pnpm --filter @mpbuild/cli build",
    "pack:check": "pnpm --filter @mpbuild/core pack:check && pnpm --filter @mpbuild/cli pack:check"
  }
}
```

先编 core 再编 CLI（CLI 解析 `@mpbuild/core` 的 types 条件，必须已有 `dist/index.d.ts`）：

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm build
```

若 CLI `tsc` 因 `@mpbuild/core` 还指向旧 src 失败：确认 core `package.json` 的 exports 已改且 `dist/` 已生成后再编 CLI。不要改 `legacy-scss.ts` 或补业务类型来绕过；`postcss-shim.d.ts` 已在 `src/`，build include 会吃到它。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/publish.test.ts src/__tests__/package.test.ts
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm pack:check
```

Expected: PASS。`pack:check` 打印 tarball 含 `dist/index.js`，core 不含 `src/__tests__`。然后确认日常测试仍不依赖「先手工 build」才能 import：

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/config.test.ts
```

Expected: PASS（该文件 `from '../index'`，不读 dist）。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/__tests__/publish.test.ts v5/packages/core/tsconfig.build.json v5/packages/core/package.json v5/packages/cli/tsconfig.json v5/packages/cli/package.json v5/package.json v5/pnpm-lock.yaml
git -c trailer.ifexists=doNothing commit -m "feat: emit dist for @mpbuild core and cli packs"
```

不要 `git add` `v5/packages/*/dist`（根 `.gitignore` 已忽略 `dist`）。

---

### Task 3: CLI 生产 bin 纯 Node

**Files:**
- Create: `v5/packages/core/src/__tests__/cli-release.test.ts`
- Modify: `v5/packages/cli/bin/mpb.js`
- Modify: `v5/packages/cli/package.json`
- Modify: `v5/pnpm-lock.yaml`（tsx 从 dependencies 挪到 devDependencies）

**Interfaces:**
- Consumes: Task 2 的 `v5` `build` 脚本、`cli/dist/index.js`（由 `cli/src/index.ts` 的 `export async function run` emit）
- Produces: 发布后的 `bin/mpb.js` 文本不含 `tsx`，用 Node 执行无参数时打印 `usage: mpb <inspect graph|build|dev|analyze>`。`tsx` 不在 `dependencies`。开发脚本 `"dev": "tsx src/index.ts"`。

- [ ] **Step 1: Write the failing test**

`v5/packages/core/src/__tests__/cli-release.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cliDir, readJson, v5Dir } from './repo'

describe('cli production bin', () => {
  it('does not depend on tsx in bin or production dependencies', () => {
    const binText = readFileSync(join(cliDir, 'bin/mpb.js'), 'utf8')
    expect(binText).not.toMatch(/\btsx\b/)
    const cliPkg = readJson(join(cliDir, 'package.json'))
    expect((cliPkg.dependencies as Record<string, string> | undefined)?.tsx).toBeUndefined()
    expect((cliPkg.bin as Record<string, string>).mpb).toBe('./bin/mpb.js')
    expect((cliPkg.scripts as Record<string, string>).dev).toBe('tsx src/index.ts')
  })

  it('prints usage with plain node after build', { timeout: 60_000 }, () => {
    const built = spawnSync('pnpm', ['build'], { cwd: v5Dir, encoding: 'utf8' })
    expect(built.status, `${built.stdout}\n${built.stderr}`).toBe(0)
    const bin = join(cliDir, 'bin/mpb.js')
    const result = spawnSync(process.execPath, [bin], {
      cwd: cliDir,
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '' },
    })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('usage: mpb <inspect graph|build|dev|analyze>')
    expect(result.stderr).not.toMatch(/\btsx\b/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/cli-release.test.ts
```

Expected: FAIL。`bin/mpb.js` 含 `import { register } from 'tsx/esm/api'`，`not.toMatch(/\btsx\b/)` 失败。同时 `dependencies.tsx` 仍存在。

- [ ] **Step 3: Write minimal implementation**

把 `v5/packages/cli/bin/mpb.js` **整文件**换成：

```js
#!/usr/bin/env node
import { run } from '../dist/index.js'
await run()
```

`v5/packages/cli/package.json`：`tsx` 移到 `devDependencies`（与 Task 2 已加的 `typescript` / `@types/node` 并列），增加 `dev` 脚本。完整示例：

```json
{
  "name": "@mpbuild/cli",
  "version": "2.0.0",
  "type": "module",
  "description": "CLI for @mpbuild/core (command: mpb)",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ximing/mpbuild.git",
    "directory": "v5/packages/cli"
  },
  "publishConfig": {
    "access": "public"
  },
  "bin": {
    "mpb": "./bin/mpb.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "bin"],
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "pack:check": "pnpm build && npm pack --dry-run"
  },
  "dependencies": {
    "@mpbuild/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

在 `v5/` 执行 `pnpm install` 让 lockfile 反映 tsx 不再是 runtime dep。

不要改 `v5/packages/cli/src/index.ts` 的命令分发（usage 字符串已正确）。不要在 `run()` 顶部 `register()` tsx——无参数路径必须不加载 tsx。

`mpbuild.config.ts` 在生产 bin 下会因 Node 无法原生 import `.ts` 而失败。P4 接受这一点：迁移文档 Task 4 写明用 `mpbuild.config.js`。开发可用 `pnpm --filter @mpbuild/cli dev`（tsx 加载 CLI **源码**；core 仍走 dist，需先 `pnpm --filter @mpbuild/core build`）。

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/cli-release.test.ts src/__tests__/publish.test.ts
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/cli pack:check
```

Expected: PASS。`node bin/mpb.js` 打出 usage。CLI pack 的 `package.json` 里 `dependencies` 无 tsx。

- [ ] **Step 5: Commit**

```bash
git add v5/packages/core/src/__tests__/cli-release.test.ts v5/packages/cli/bin/mpb.js v5/packages/cli/package.json v5/pnpm-lock.yaml
git -c trailer.ifexists=doNothing commit -m "feat(cli): ship mpb bin as plain Node entry"
```

---

### Task 4: 迁移文档 `docs/migration-v5.md`

**Files:**
- Create: `v5/packages/core/src/__tests__/migration.test.ts`
- Create: `docs/migration-v5.md`

**Interfaces:**
- Consumes: 规格 §21 八条、§18 对照表关键行、当前真实插件 API（`Plugin` 只有 `name` / `load?` / `generate?`；官方 `legacyScss()` / `projectConfig()`；`npmCompat` 是 emit 内置函数不是用户必须挂的 plugin）
- Produces: 中文迁移文档，八条各自有 `## 1.` … `## 8.` 标题；含对照表

- [ ] **Step 1: Write the failing test**

`v5/packages/core/src/__tests__/migration.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repoRoot } from './repo'

describe('migration-v5.md', () => {
  it('covers spec §21 eight items with numbered headings', () => {
    const md = readFileSync(join(repoRoot, 'docs/migration-v5.md'), 'utf8')
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(md).toContain(`## ${n}.`)
    }
    const required = [
      '@mpbuild/cli',
      '`mpb`',
      'mpbuild.config',
      'mpb.config.js',
      'module.rules',
      'legacyScss',
      'PolymorphismPlugin',
      "platform: 'wx'",
      'ifdef.tokens',
      'SubProjectPlugin',
      'projects',
      'createCompiler',
      'virtual:',
      "require('./x.json')",
      '不再内联',
      'plugin://',
      'Node.js',
      '>=20',
    ]
    for (const token of required) {
      expect(md, `missing ${token}`).toContain(token)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/migration.test.ts
```

Expected: FAIL。`docs/migration-v5.md` 不存在，`readFileSync` 抛 ENOENT。

- [ ] **Step 3: Write minimal implementation**

把下面内容原样写入 `docs/migration-v5.md`（可改措辞，但必须保留测试里的全部 token 与 `## 1.`–`## 8.`）：

````markdown
# 从 mpbuild 4.x 迁到 @mpbuild/cli 2.0

本文对应仓库规格 `docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md` 的 §21（八条）和 §18（对照表）。5.x 源码在 `v5/`。npm 包是 `@mpbuild/core@2.0.0` 与 `@mpbuild/cli@2.0.0`。**不会**发布名为 `mpbuild` 的 5.0；历史上的 `mpbuild@4` 已冻结且源码已移出本仓库。

需要 Node.js `>=20`。

## 1. 安装 @mpbuild/cli，命令是 `mpb`

```bash
pnpm add -D @mpbuild/cli
```

会安装 `@mpbuild/core`。命令行二进制是 `mpb`，不是 `mpbuild`，也不是 `mpb5`。

```bash
mpb build
mpb dev
mpb analyze
mpb inspect graph
```

`--watch` 是 `dev` 的别名。退出码：0 成功；1 含 error；2 配置错误（包括只找到 `mpb.config.js`）。

程序内 API 从 `new MPB().run()` 换成：

```js
import { createCompiler, loadConfig } from '@mpbuild/core'

const config = await loadConfig(process.cwd())
await createCompiler(config).run()
```

## 2. 把 4.x 配置字段抄到 mpbuild.config.*

加载顺序：`mpbuild.config.ts` → `mpbuild.config.mts` → `mpbuild.config.js`（`export default` 或 `module.exports`）。

**不读取** `mpb.config.js`。工作区里只有旧文件时诊断 `LEGACY_CONFIG`，退出码 2。

生产环境的 `@mpbuild/cli`（`mpb` bin）是编译后的 JS，**请把发布配置写成 `mpbuild.config.js`**。`.ts` / `.mts` 需要额外的 TypeScript loader，本版本的生产 bin 不再默认 `tsx register`。

字段对照：

| 4.x | 5.x |
|---|---|
| `entry` / `src` | 同名。`entry` 可以是文件路径或对象 |
| `output.path` | `output.dir` |
| `output.npm` | `output.npm`（默认 `'npm'`） |
| `output.component.relative` | `output.componentRelative`（默认 `true`） |
| 顶层 `alias` | `resolve.alias`。函数签名改为 `({ importer, request }) => string \| undefined` |
| `optimization.minimize` | `compile.minify`（`boolean` 或按 kind 的对象）。没有 4.x 的 include/exclude glob，也没有 `minimize.path` |
| `target` | 默认 `'weapp'`。不要把平台名写进 `target` |
| 多态平台 | `platform: 'wx'`（demo 仍写 `'wx'`） |

```js
const path = require('path')

module.exports = {
  src: path.join(__dirname, 'src'),
  entry: './entry.js',
  platform: 'wx',
  output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
  resolve: {
    alias: {
      '@utils': path.join(__dirname, 'src/utils'),
    },
  },
  compile: { minify: false },
}
```

## 3. 删除 module.rules 与 loaders

5.x **不兼容**旧 loader 链，不读取 `module.rules`。删掉 `babel-loader` / `ts-loader` / `postcss-loader` / `json-loader`。

- JS/TS 默认 SWC（`compile.js.target` 默认 `es2018`，`compile.js.module` 默认 `commonjs`）。
- CSS 默认 Lightning CSS。
- 若项目仍是 4.x demo 那种「`.wxss` 里写类 SCSS」：把 PostCSS nested / advanced-variables 换成官方插件 `legacyScss()`，或改成真实 Sass 文件并由你自己预处理。不要指望默认引擎跑 PostCSS 7。

```js
const { legacyScss, projectConfig } = require('@mpbuild/core')

module.exports = {
  src: 'src',
  entry: './entry.js',
  platform: 'wx',
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'my-app', appId: 'touristappid' }),
  ],
}
```

`mpbuild.config.js` 若是 CJS，必须能 `require('@mpbuild/core')`（即该包已发布或 workspace 已 build 出 dist）。不要 require 仓库里的 `src/index.ts`。

## 4. PolymorphismPlugin 改为 platform / ifdef

删除 `new MPB.PolymorphismPlugin({ platform: 'wx', blockcode: true })`。

- 文件级后缀选择：配置 `platform: 'wx'`。解析时先试 `*.wx.js` 再试 `*.js`。
- 块级条件编译默认开（`ifdef.blockcode` 默认 `true`）。指令：`@ifdef` / `@ifndef` / `@if TOKEN || TOKEN` / `@endif`。
- 需要额外宏：`ifdef.tokens`。上下文是 `{ [platform]: true, p: platform, ...ifdef.tokens }`。

```js
module.exports = {
  src: 'src',
  entry: './entry.js',
  platform: 'wx',
  ifdef: {
    tokens: { FEATURE_A: true },
    blockcode: true,
  },
}
```

## 5. SubProjectPlugin 改为 projects

删除 `SubProjectPlugin`。用 `projects`：

```js
module.exports = {
  src: 'src',
  entry: './entry.js',
  projects: [
    {
      name: '@one',
      src: path.join(__dirname, '../projects/one'),
      alias: { '@one': path.join(__dirname, '../projects/one') },
    },
  ],
  resolve: {
    alias: {
      '@one': path.join(__dirname, '../projects/one'),
    },
  },
}
```

子仓库模块的图 id 形如 `@one/pages/test/index.js`。子仓库内不要用以 `/` 开头的绝对源码路径（会 `ABS_PATH_IN_SUBPROJECT`）。不再提供 `resolveOutside`。

## 6. 插件按新对象 API 重写

旧 Tapable / `apply(mpb)` / `scan.addAssetByEXT` 全部废弃。

当前落地的 `Plugin` **只有**：

```ts
interface Plugin {
  name: string
  load?(id: string, ctx: PluginLoadContext): string | void | Promise<string | void>
  generate?(file, ctx): file | void | Promise<file | void>
}
```

`load` 第一个返回字符串的插件胜出（用于 `legacyScss()`）。`generate` 用于 extras（`projectConfig()` 写 `adapter.projectConfigFile`；目标处已有文件则不覆盖）。

规格 §13 里的 `resolve` / `extract` / `transform` / `plan` / `emitModule` / `addEntry` **本版本没有实现**。不要按那张完整表去写自定义插件并期待能跑。也不要调用不存在的 `copy()`。

虚文件：core 对 router 生成的 app.json 使用 `virtual:app.json`。用户侧若以前靠虚文件注入，请先改用 `generate` 写 extras；完整的 `virtual:` + `load` + `emitModule` 建图 API 尚未开放。

weapp 的 npm 运行时变换由 emit 内置的 `npmCompat` 完成（`adapter.npmCompat === 'weapp'` 时），不必自己塞进 `plugins`。

## 7. require('./x.json') 不再内联

4.x 会把 `require('./x.json')` 内联进 JS。5.x **刻意 break**：该 JSON 作为独立模块入图、独立写出，再 rewrite specifier。请保证运行时仍能加载那份 `.json`，不要假设它变成了对象字面量。

## 8. plugin:// 原样保留

`plugin:` / `http:` / `https:` / `data:` / `wxfile:` 是 external，不建磁盘节点、不报 `RESOLVE_MISS`，源码和 JSON 里的 `plugin://` **原样保留**。不要改成相对路径。

## 对照表（4.x → 5.x）

| 4.x | 5.x |
|---|---|
| `mpb.config.js` + loaders | `mpbuild.config.*` |
| `new MPB().run()` | `createCompiler(config).run()` |
| `module.rules` / loaders | 删除；JS→SWC，CSS→Lightning，类 SCSS→`legacyScss()` |
| PolymorphismPlugin | `platform` / `ifdef` |
| SubProjectPlugin | `projects` |
| CleanMbpPlugin | `output.clean`（仅该 compiler 第一次 emit） |
| ProjectConfigPlugin | `projectConfig()` |
| Copy / CopyImage | **首发无 `copy()`**，请自己拷贝或 `generate` |
| JSON require 内联 | 独立 json（刻意 break） |
| `plugin://` | 原样保留 |

## 首发明确不做

抖音/头条 adapter、`@mpbuild/target-tt`、HMR、把小程序打成 JS bundle、workers / sitemap / tabBar 图标 / WXML `<image src>` 入图、json `extends`、minify 的 include/exclude、完整 PluginContext。详见规格 §2.2 与 §22.2。
````

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/migration.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add docs/migration-v5.md v5/packages/core/src/__tests__/migration.test.ts
git -c trailer.ifexists=doNothing commit -m "docs: add v5 migration guide from 4.x"
```

---

### Task 5: 根 README、包 README、路线图收尾

**Files:**
- Create: `v5/packages/core/src/__tests__/readme.test.ts`
- Modify: `README.md`（仓库根）
- Create: `v5/packages/core/README.md`
- Create: `v5/packages/cli/README.md`
- Modify: `docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md`

**Interfaces:**
- Consumes: Task 4 的 `docs/migration-v5.md`；现有 README 的 Contributors HTML 注释块
- Produces: 根 README 以 `@mpbuild/cli` + `` `mpb` `` + Node.js `>=20` + 迁移文档链接为主叙事；保留 `ALL-CONTRIBUTORS-BADGE` 与 `ALL-CONTRIBUTORS-LIST` 两段 HTML 注释（含中间表格）。路线图「当前开工」改为 `P4 已交付`。P0–P3 验收句一字不改。

- [ ] **Step 1: Write the failing test**

`v5/packages/core/src/__tests__/readme.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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
  })

  it('ships npm README files for core and cli', () => {
    const coreReadme = readFileSync(join(coreDir, 'README.md'), 'utf8')
    const cliReadme = readFileSync(join(cliDir, 'README.md'), 'utf8')
    expect(coreReadme).toContain('@mpbuild/core')
    expect(coreReadme).toContain('createCompiler')
    expect(cliReadme).toContain('@mpbuild/cli')
    expect(cliReadme).toContain('`mpb`')
    expect(cliReadme).toContain('Node.js')
  })

  it('marks P4 delivered without editing P0-P3 acceptance lines', () => {
    const roadmap = readFileSync(
      join(repoRoot, 'docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md'),
      'utf8',
    )
    expect(roadmap).toMatch(/当前开工：P4 已交付/)
    expect(roadmap).toContain('2026-08-19-mpbuild-v5-p4-release.md')
    expect(roadmap).toContain('`mpb inspect graph` 打出节点/边；假 adapter 快照通过')
    expect(roadmap).toContain(
      '`mpb build` 打出页面四件套；`plugin://` 不失败；命令为 `mpb`；4.x 包删除',
    )
    expect(roadmap).toContain('Watch 状态机 + `mpb dev` + 增量正确性用例')
    expect(roadmap).toContain('`example/demo` 语义对比 CI')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run src/__tests__/readme.test.ts
```

Expected: FAIL。根 README 无 `@mpbuild/cli`，仍含 lerna badge 与 `ximing.github.io/mpbuild`；两包 README 不存在；路线图「当前开工」还不是 `P4 已交付`。

- [ ] **Step 3: Write minimal implementation**

把根 `README.md` **整文件**换成下面内容。Contributors 表格必须与替换前逐字相同（含 `ALL-CONTRIBUTORS-*` 注释）。

````markdown
# mpbuild

微信小程序图驱动构建器。5.x 实现位于 `v5/`，npm 包是 [`@mpbuild/core`](https://www.npmjs.com/package/@mpbuild/core) 与 [`@mpbuild/cli`](https://www.npmjs.com/package/@mpbuild/cli)（都是 `2.0.0`）。

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![NPM Version](https://img.shields.io/npm/v/@mpbuild/cli.svg?style=flat)](https://www.npmjs.com/package/@mpbuild/cli)

命令行是 `mpb`。**不会**再发布名为 `mpbuild` 的 5.0；历史上的 `mpbuild@4` 已冻结，源码已移出本仓库。

## 要求

- Node.js `>=20`

## 安装

```bash
pnpm add -D @mpbuild/cli
```

## 命令

```bash
mpb build
mpb dev
mpb analyze
mpb inspect graph
```

`--watch` 是 `dev` 的别名。退出码：0 成功；1 含 error；2 配置错误。

## 配置

项目根使用 `mpbuild.config.ts` / `mpbuild.config.mts` / `mpbuild.config.js`（`export default` 或 `module.exports`）。生产环境请用 `mpbuild.config.js`。

**不读取** `mpb.config.js`。

```js
const { defineConfig, legacyScss, projectConfig } = require('@mpbuild/core')

module.exports = defineConfig({
  src: 'src',
  entry: './entry.js',
  platform: 'wx',
  output: { dir: 'dist', npm: 'npm', clean: true, componentRelative: true },
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'my-app', appId: 'touristappid' }),
  ],
})
```

从 4.x 迁移见 [docs/migration-v5.md](docs/migration-v5.md)。

## 文档

- 迁移：[docs/migration-v5.md](docs/migration-v5.md)
- 架构规格：[docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md](docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md)
- 包说明：[v5/packages/cli/README.md](v5/packages/cli/README.md)、[v5/packages/core/README.md](v5/packages/core/README.md)

冷构建相对 4.x 快 5 倍是志向指标，不进 CI fail。

## 仓库

实现只在 `v5/packages/core` 与 `v5/packages/cli`。金样在 `example/demo`（不要到 `v5/packages/example` 找）。

## License

[MIT](LICENSE)

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://ximing.ren"><img src="https://avatars.githubusercontent.com/u/4659887?v=4?s=100" width="100px;" alt=""/><br /><sub><b>席铭</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/commits?author=ximing" title="Code">💻</a> <a href="#blog-ximing" title="Blogposts">📝</a> <a href="https://github.com/ximing/mpbuild/commits?author=ximing" title="Documentation">📖</a> <a href="#example-ximing" title="Examples">💡</a> <a href="#maintenance-ximing" title="Maintenance">🚧</a></td>
    <td align="center"><a href="https://github.com/yozosann"><img src="https://avatars.githubusercontent.com/u/19776974?v=4?s=100" width="100px;" alt=""/><br /><sub><b>yozosann</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/issues?q=author%3Ayozosann" title="Bug reports">🐛</a> <a href="https://github.com/ximing/mpbuild/commits?author=yozosann" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/liujin10"><img src="https://avatars.githubusercontent.com/u/18552493?v=4?s=100" width="100px;" alt=""/><br /><sub><b>liujin123456</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/issues?q=author%3Aliujin10" title="Bug reports">🐛</a> <a href="https://github.com/ximing/mpbuild/commits?author=liujin10" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ShiningDan"><img src="https://avatars.githubusercontent.com/u/23012618?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Yuchen</b></sub></a><br /><a href="https://github.com/ximing/mpbuild/issues?q=author%3AShiningDan" title="Bug reports">🐛</a> <a href="https://github.com/ximing/mpbuild/commits?author=ShiningDan" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification.
Contributions of any kind welcome!
````

`v5/packages/core/README.md`：

````markdown
# @mpbuild/core

微信小程序图驱动编译器核心。配合 [`@mpbuild/cli`](https://www.npmjs.com/package/@mpbuild/cli) 使用，命令是 `mpb`。

需要 Node.js `>=20`。

```js
const { createCompiler, defineConfig, legacyScss, projectConfig } = require('@mpbuild/core')
```

或 ESM：

```js
import { createCompiler, defineConfig, loadConfig } from '@mpbuild/core'

const config = await loadConfig(process.cwd())
await createCompiler(config).run()
```

从 4.x 迁移见仓库根目录 `docs/migration-v5.md`。
````

`v5/packages/cli/README.md`：

````markdown
# @mpbuild/cli

`mpb` 命令行。依赖 `@mpbuild/core@2.0.0`。

需要 Node.js `>=20`。

```bash
pnpm add -D @mpbuild/cli
mpb build
mpb dev
mpb analyze
mpb inspect graph
```

配置文件：`mpbuild.config.js`（生产请用 JS）。详见仓库 `docs/migration-v5.md`。

开发本包：先 `pnpm --filter @mpbuild/core build`，再 `pnpm --filter @mpbuild/cli build`。不经过 build 的源码调试可用 `pnpm --filter @mpbuild/cli dev`（tsx，仅开发态）。
````

改 `docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md`：

- 将文首「当前开工」那一行改成：`当前开工：P4 已交付 → docs/superpowers/plans/2026-08-19-mpbuild-v5-p4-release.md`（路径可用反引号包起来，与现有 P0–P3 计划链接风格一致）
- **不要**改表格里 P0–P3 的「可独立验收」列原文

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm --filter @mpbuild/core test -- --run
eval "$(fnm env)" && fnm use 22 && cd v5 && pnpm pack:check
```

Expected: 全部 PASS（含既有金样与本阶段新增测试）。`pack:check` 成功。根 README 不再出现 lerna / 旧文档站 URL。

- [ ] **Step 5: Commit**

```bash
git add README.md v5/packages/core/README.md v5/packages/cli/README.md v5/packages/core/src/__tests__/readme.test.ts docs/superpowers/plans/2026-08-19-mpbuild-v5-roadmap.md
git -c trailer.ifexists=doNothing commit -m "docs: rewrite README for @mpbuild/cli 2.0"
```

---

## Self-review

### Spec coverage

| 规格 | 任务 |
|---|---|
| §19 P4：迁移文档、根 README、`@mpbuild/*@2.0.0`、不发布名为 `mpbuild` 的 5.0 | Task 1、4、5 |
| §21 八条 | Task 4（`## 1.`–`## 8.`） |
| §18 对照关键行：`mpb.config.js`→`mpbuild.config.*`、`new MPB().run()`→`createCompiler`、删 loaders、PolymorphismPlugin→`platform`/`ifdef`、SubProjectPlugin→`projects`、JSON require 不再内联、`plugin://` 原样保留 | Task 4 |
| §3 CLI/包名：`mpb`；`@mpbuild/core` `@mpbuild/cli@2.0.0` | Task 1、3、5 |
| §4 布局：实现在 `v5/packages/core`+`cli`；**不**把 example 迁入 `v5/packages/example` | Global Constraints |
| §15 CLI 命令 | Task 3 usage 断言；Task 5 README |
| §2.2 / P4 YAGNI：copy、tt、完整 PluginContext、不改图语义 | Global Constraints；Task 4「首发明确不做」 |
| 根 package 仍是 private `mpbuild-project@4.2.1` | Task 1 |
| 可 pack：dist JS+d.ts、exclude tests、bin 纯 Node | Task 2、3 |
| 不执行 npm publish | Global Constraints；只用 pack --dry-run |

缺口：无。规格 §7 的 `.ts` 配置加载在去掉 bin 顶部 tsx 后不再默认可用——已写入 Global Constraints 与迁移文档 §1/§2，不另开 Task 做 jiti。

### Placeholder scan

无 TBD / TODO / 「类似 Task N」 / 「补适当错误处理」。每个 Step 1 都贴了完整测试。需要改动的 package.json / bin / 文档都有完整内容。

### Type consistency

- `run`：CLI `src/index.ts` 已导出 `export async function run(argv?: string[]): Promise<void>`，Task 3 bin `import { run } from '../dist/index.js'`。
- `createCompiler` / `legacyScss` / `projectConfig` / `defineConfig` / `loadConfig` / `version` 均为现有导出，P4 不改签名。
- 路径 helper：Task 1 的 `coreDir`/`cliDir`/`v5Dir`/`repoRoot`，后续 Task 同名使用。

---

## 本阶段不做（再列一次）

- `copy()`、完整 PluginContext、磁盘 transform 缓存、`@mpbuild/target-tt`、tt adapter
- 把 `example/demo` 迁到 `v5/packages/example`
- 把 demo 的 CJS 配置改成 ESM 并挂 `legacyScss` / `projectConfig` 以便 `mpb build` demo
- 改 P0–P3 已实现的图/编译语义
- 发布名为 `mpbuild` 的 5.0，或把根包改成可发布
- `npm publish` / `changeset publish`
