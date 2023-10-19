# 从 mpbuild 4.x 迁到 @mpbuild/cli 2.0

本文对应仓库规格 `docs/superpowers/specs/2026-08-19-mpbuild-v5-graph-driven-design.md` 的 §21（八条）和 §18（对照表）。5.x 源码在 `v5/`。npm 包是 `@mpbuild/core@2.0.0` 与 `@mpbuild/cli@2.0.0`。**不会**发布名为 `mpbuild` 的 5.0；历史上的 `mpbuild@4` 已冻结且源码已移出本仓库。

需要 Node.js `>=20`。

`@mpbuild/core` / `@mpbuild/cli` 是 `"type": "module"`，`exports` 只有 `import`。加载 core **必须用 ESM `import`**，不要写 `require('@mpbuild/core')`。CJS `mpbuild.config.js`（`module.exports`）仍然合法：CLI 用 Node `import()` 加载配置本身。

## 1. 安装 @mpbuild/cli，命令是 `mpb`

```bash
pnpm add -D @mpbuild/cli
```

会安装 `@mpbuild/core`。命令行二进制是 `mpb`，不是 `mpbuild`，也不是 `mpb5`。

```bash
mpb build
mpb build --no-cache
mpb build --minify
mpb dev
mpb analyze
mpb inspect graph
```

`mpb dev` 把首次构建和每次 watch tick 的诊断打印到 stderr（与 `mpb build` 相同），打印后保持进程。已入图文件的 chokidar `add` 当作内容变更（编辑器 unlink 再 add 会更新 dest）。

发布走 GitHub Actions 的 `v*` tag，仓库 secret 名是 `NPM_TOKEN`；不要本地 `npm publish`。

`--watch` 是 `dev` 的别名。退出码：0 成功；1 含 error；2 配置错误（包括只找到 `mpb.config.js`）。

程序内 API 从 `new MPB().run()` 换成：

```js
import { createCompiler, loadConfig } from '@mpbuild/core'

const config = await loadConfig(process.cwd())
await createCompiler(config).run()
```

## 2. 把 4.x 配置字段抄到 mpbuild.config.*

加载顺序：`mpbuild.config.ts` → `mpbuild.config.mts` → `mpbuild.config.js` → `mpbuild.config.mjs`（`export default` 或 `module.exports`）。

**不读取** `mpb.config.js`。工作区里只有旧文件时诊断 `LEGACY_CONFIG`，退出码 2。

生产环境的 `@mpbuild/cli`（`mpb` bin）是编译后的 JS，**请把发布配置写成 `mpbuild.config.js` 或 `mpbuild.config.mjs`**。`.ts` / `.mts` 需要额外的 TypeScript loader，本版本的生产 bin 不再默认 `tsx register`。生产 bin 不能加载 `.ts` / `.mts` 时会 **跳过并诊断 `CONFIG_TS_SKIPPED`**，继续尝试 `.js` / `.mjs`；若只有无法加载的 `.ts` 则失败。不要同时留下会误导的 leftover `.ts` / `.mts`，仍建议删掉。

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

纯字段配置可以继续 CJS：

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

要从 `@mpbuild/core` 引用官方插件时，把配置写成 ESM（`import` / `export default`）。若项目根 `package.json` 没有 `"type": "module"`，Node 会把 `mpbuild.config.js` 当 CJS，此时请加上 `"type": "module"`（小程序业务 JS 不经 Node 执行）。不要 `require` 仓库里的 `src/index.ts`。

```js
import { legacyScss, projectConfig } from '@mpbuild/core'

export default {
  src: 'src',
  entry: './entry.js',
  platform: 'wx',
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'my-app', appId: 'touristappid' }),
  ],
}
```

## 4. PolymorphismPlugin 改为 platform / ifdef

删除 `new MPB.PolymorphismPlugin({ platform: 'wx', blockcode: true })`。

- 文件级后缀选择：配置 `platform: 'wx'`。解析时先试 `*.wx.js` 再试 `*.js`。
- 块级条件编译默认开（`ifdef.blockcode` 默认 `true`）。指令：`@ifdef` / `@ifndef` / `@if TOKEN || TOKEN` / `@endif`。
- 需要额外宏：`ifdef.tokens`。上下文是 `{ [platform]: platform, p: platform, ...ifdef.tokens }`。

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

规格 §13 里的 `resolve` / `extract` / `transform` / `plan` / `emitModule` / `addEntry` **本版本没有实现**。不要按那张完整表去写自定义插件并期待能跑。2.0 Plugin 只有 `load` / `generate`。`copy(patterns)` 默认 extras；`copy({ graph: true })` 未做。完整 PluginContext 首发没有。

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
| Copy / CopyImage | `copy()` extras（默认 `graph: false`） |
| JSON require 内联 | 独立 json（刻意 break） |
| `plugin://` | 原样保留 |

## 首发明确不做

抖音/头条 adapter、`@mpbuild/target-tt`、HMR、把小程序打成 JS bundle、workers / sitemap / tabBar 图标 / WXML `<image src>` 入图、json `extends`、minify 的 include/exclude、完整 PluginContext。详见规格 §2.2 与 §22.2。不要把 origin 上那 2 个 Snyk 提交 merge 进 5.x；发布 tag 是 `v2.0.0`。
