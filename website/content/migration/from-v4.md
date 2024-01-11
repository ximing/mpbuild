---
title: 从 4.x 迁移
group: 迁移
order: 1
---

mpbuild 5.0 是一次图驱动的整体重写。本页汇总从 4.x 升级到 5.x 需要做的全部改动，更详细的说明见仓库内 [docs/migration-v5.md](https://github.com/ximing/mpbuild/blob/master/docs/migration-v5.md) 与 [CHANGELOG](https://github.com/ximing/mpbuild/blob/master/CHANGELOG.md)。

## 包名与命令

npm 包从无作用域的 `mpbuild` 改为有作用域的两个包：

- `@mpbuild/core`：图驱动编译器核心
- `@mpbuild/cli`：命令行工具，二进制命令是 `mpb`（不是 `mpbuild`，也不是 `mpb5`）

历史上的 `mpbuild@4` 已冻结，不会再发布无作用域的 `mpbuild` 包。

```bash
pnpm add -D @mpbuild/cli
```

安装 `@mpbuild/cli` 会带上 `@mpbuild/core`。常用命令：

```bash
mpb build          # 构建（--minify / --no-cache）
mpb dev            # 首次构建 + watch
mpb analyze        # 产物分析，写 <output.dir>/mpbuild-analyze.json
mpb inspect graph  # 逐节点打印依赖图
```

命令详情见 [CLI 参考](#/reference/cli)。

## 环境要求：Node >= 20，纯 ESM

5.x 要求 Node.js `>=20`。`@mpbuild/core` 与 `@mpbuild/cli` 都是 `"type": "module"`，`exports` 只提供 `import`——在代码里加载 core 必须用 ESM `import`，不能 `require('@mpbuild/core')`。

配置文件本身仍可以是 CJS（`mpbuild.config.js` 里写 `module.exports` 合法，CLI 用 Node `import()` 加载配置）。

## 配置文件改名

配置文件从 `mpb.config.js` 改为 `mpbuild.config.*`，加载优先级：

```text
mpbuild.config.ts → mpbuild.config.mts → mpbuild.config.js → mpbuild.config.mjs
```

> [!WARNING]
> 5.x **不再读取 `mpb.config.js`**。工作区里只有旧配置文件时，CLI 报 `LEGACY_CONFIG` 并以**退出码 2** 退出。请把 `mpb.config.js` 改名为 `mpbuild.config.js`（或 `.mjs` / `.ts` / `.mts`）。

生产环境的 `@mpbuild/cli` 是编译后的 JS，不再默认注册 TypeScript 加载器：生产 bin 无法 import `.ts` / `.mts` 配置时会跳过并诊断 `CONFIG_TS_SKIPPED`，继续尝试 `.js` / `.mjs`。**生产环境建议直接写 `mpbuild.config.js` 或 `mpbuild.config.mjs`**，并删掉会误导的残留 `.ts` / `.mts` 配置。详见 [配置参考](#/reference/config) 与 [诊断码](#/reference/diagnostics)。

## 字段改名对照

| 4.x | 5.x |
|---|---|
| `entry` / `src` | 同名。`entry` 可以是文件路径或对象 |
| `output.path` | `output.dir` |
| `output.npm` | `output.npm`（默认 `'npm'`） |
| `output.component.relative` | `output.componentRelative`（默认 `true`） |
| 顶层 `alias` | `resolve.alias`；函数签名改为 `({ importer, request }) => string \| undefined` |
| `optimization.minimize` | `compile.minify`（`boolean` 或按 kind 的对象；没有 4.x 的 include/exclude glob，也没有 `minimize.path`） |
| `target` | 默认 `'weapp'`，不要把平台名写进 `target` |
| 多态平台 | `platform: 'wx'` |

一个最小的新配置：

```js
// mpbuild.config.mjs
export default {
  src: 'src',
  entry: './entry.js',
  platform: 'wx',
  output: { dir: 'dist', clean: true },
  resolve: {
    alias: { '@utils': './src/utils' },
  },
  compile: { minify: false },
}
```

完整字段说明见 [配置参考](#/reference/config)。

## `require('./x.json')` 不再内联

> [!WARNING]
> 4.x 会把 `require('./x.json')` 的 JSON 内容**内联**进 JS 产物；5.x **刻意 break 了这个行为**：该 JSON 会作为独立模块入图、独立写出为 `.json` 文件，并把源码里的 specifier 重写指向它。
>
> 升级后请确认小程序运行时仍能加载这份 `.json`，不要假设产物里是对象字面量。

## loader 链废弃

5.x 不兼容 4.x 的 loader 链，**不读取 `module.rules`**。请删除 `babel-loader` / `ts-loader` / `postcss-loader` / `json-loader` 等配置：

- JS/TS 默认用 SWC 变换（`compile.js.target` 默认 `es2018`，`compile.js.module` 默认 `commonjs`）
- CSS 默认用 Lightning CSS
- 类 SCSS 语法（变量、嵌套、mixin）由官方插件 `legacyScss()` 提供，见 [官方插件](#/plugins/official)

## 插件 API 全新

> [!WARNING]
> 5.x 的插件 API 与 4.x 的 Tapable 体系（`apply(mpb)`、`scan.addAssetByEXT` 等钩子）**完全不兼容**，旧插件必须按新 API 重写。

新插件是一个普通对象，只有 `name` + 两个可选钩子：

```ts
interface Plugin {
  name: string
  load?(id: string, ctx: PluginLoadContext): string | void | Promise<string | void>
  generate?(file, ctx): file | file[] | void | Promise<file | file[] | void>
}
```

`load` 用于替换模块内容（第一个返回字符串的插件胜出），`generate` 用于追加/改写产物文件。详见 [插件 API](#/plugins/api)。

## PolymorphismPlugin → platform + ifdef

删除 `new MPB.PolymorphismPlugin(...)`，改用两个配置字段：

- **文件级多态**：配置 `platform: 'wx'`，解析时先试 `name.wx.js` 再试 `name.js`。输出时只有套件成员（app / 页面 / 组件）与 `*.config.js` 会剥掉 `.wx` infix（`index.wx.js` → `index.js`）；普通工具模块解析时同样优先命中带 infix 的文件，但产物保留 infix（`utils.wx.ts` 的产物仍是 `utils.wx.js`）
- **块级条件编译**：默认开启（`ifdef.blockcode` 默认 `true`），指令为 `@ifdef` / `@ifndef` / `@if` / `@endif`；额外宏用 `ifdef.tokens`

```js
// mpbuild.config.mjs
export default {
  src: 'src',
  entry: './entry.js',
  platform: 'wx',
  ifdef: {
    tokens: { FEATURE_A: true },
  },
}
```

详见 [条件编译与多态](#/guide/conditional-compilation)。

## SubProjectPlugin → projects

删除 `SubProjectPlugin`，改用 `projects` 配置子仓库：

```js
// mpbuild.config.mjs
export default {
  src: 'src',
  entry: './entry.js',
  projects: [
    {
      name: '@one',
      src: '../projects/one',
      alias: { '@one': '../projects/one' },
    },
  ],
}
```

注意：

- 子仓库内禁止以 `/` 开头的绝对源码路径，违反报 `ABS_PATH_IN_SUBPROJECT`
- 5.x **不再提供 `resolveOutside`**
- 子仓库模块的图 id 形如 `@one/pages/test/index.js`

详见 [分包与子仓库](#/guide/subpackages)。

## 程序化 API

`new MPB().run()` 替换为 `createCompiler(config).run()`：

```js
import { createCompiler, loadConfig } from '@mpbuild/core'

const config = await loadConfig(process.cwd())
await createCompiler(config).run()
```

## 其他行为变化

- `plugin:` / `http:` / `https:` / `data:` / `wxfile:` 是 external：不建图、不报 `RESOLVE_MISS`，源码与 JSON 里的 `plugin://` 路径**原样保留**，不要改成相对路径
- CleanMbpPlugin 由 `output.clean` 取代（仅该 compiler 第一次 emit 时清理）
- ProjectConfigPlugin 由 `projectConfig()` 插件取代（目标处已有文件则不覆盖）
- Copy / CopyImage 由 `copy()` 插件取代（extras 模式，`**` 含零层目录）
- `compile.minify` 为假时，script 产物会写出独立的 `.map` 文件与 `sourceMappingURL`

## 总对照表

| 4.x | 5.x |
|---|---|
| `mpb.config.js` + loaders | `mpbuild.config.*`（ts / mts / js / mjs） |
| `new MPB().run()` | `createCompiler(config).run()` |
| `module.rules` / loader 链 | 删除；JS→SWC，CSS→Lightning CSS，类 SCSS→`legacyScss()` |
| PolymorphismPlugin | `platform` + `ifdef` |
| SubProjectPlugin | `projects` |
| CleanMbpPlugin | `output.clean` |
| ProjectConfigPlugin | `projectConfig()` 插件 |
| Copy / CopyImage | `copy()` 插件 |
| Tapable 插件 | `name` + `load` + `generate` 对象插件 |
| JSON require 内联 | 独立 json 模块（刻意 break） |
| `resolveOutside` | 不再提供 |
| `plugin://` | 原样保留 |

迁移中遇到的具体诊断信息，可在 [诊断码](#/reference/diagnostics) 页逐码查询；常见问题见 [FAQ](#/faq)。
