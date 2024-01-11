---
title: 配置参考
group: 参考
order: 1
---

# 配置参考

本页是 mpbuild v5 的完整配置项清单。所有字段名、类型与默认值均以 `@mpbuild/core` 的配置 schema 为准。

## 配置文件解析规则

mpbuild 在项目根目录（命令执行时的 `process.cwd()`）按以下优先级查找配置文件，**第一个存在且能成功 import 的文件生效**：

1. `mpbuild.config.ts`
2. `mpbuild.config.mts`
3. `mpbuild.config.js`
4. `mpbuild.config.mjs`

- 以上文件都不存在时：报 `CONFIG_NOT_FOUND`，CLI 退出码 2。
- `.ts` / `.mts` 在生产环境的 Node 上无法直接 import（`unknown file extension`）时，跳过该文件、记录 `CONFIG_TS_SKIPPED` 警告并尝试下一个候选；所有候选都失败则以 `CONFIG_TS_SKIPPED` 报错退出。**生产环境建议使用 `.js` / `.mjs`。**
- 配置文件内容会被 schema 校验，类型不合法会直接抛错（CLI 退出码 1）。
- 解析成功后，watch 期间修改配置文件会触发全量重新加载。

> [!WARNING]
> v5 **不再读取** 4.x 的 `mpb.config.js`。项目里只有 `mpb.config.js` 而没有 `mpbuild.config.*` 时，构建直接报 `LEGACY_CONFIG` 并以退出码 2 失败。请把配置迁移到 `mpbuild.config.mjs`，详见 [从 4.x 迁移](#/migration/from-v4)。

推荐使用 `defineConfig` 获得类型提示（它只是原样返回入参，不做任何变换）：

```js
// mpbuild.config.mjs
import { defineConfig } from '@mpbuild/core'

export default defineConfig({
  entry: './entry.js',
  src: 'src',
})
```

## 完整配置项表

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `string` | `'src'` | 源码目录（相对项目根）。`/` 开头的请求按相对 `src` 解析 |
| `entry` | `string \| Record<string, unknown>` | 无（**必填**） | 应用入口：字符串为入口文件路径（相对项目根，动态 import）；对象直接作为入口描述。形态详见下文「entry」 |
| `target` | `string \| TargetAdapter` | `'weapp'` | 目标平台 adapter。字符串目前仅支持 `'weapp'`，其他值报 `UNKNOWN_TARGET`；也可传入自定义 `TargetAdapter` 对象 |
| `platform` | `string` | 无（可选） | 文件级多态 infix 与 `ifdef` 上下文标识（如 `'wx'`）。与 `target` 不同：`target` 决定文件种类与产物后缀，`platform` 只参与多态与条件编译 |
| `output.dir` | `string` | `'dist'` | 产物输出目录（相对项目根） |
| `output.npm` | `string` | `'npm'` | npm 依赖产物的目录名，位于 `output.dir` 之下（默认即 `dist/npm`） |
| `output.clean` | `boolean` | `true` | 首次写盘前清空输出目录（保留 `project.config.json` 等保留文件）；watch 的后续增量写盘不再清空 |
| `output.componentRelative` | `boolean` | `true` | 组件 JSON 中 `usingComponents` 等路径改写为相对组件自身位置；置 `false` 则改写为相对输出根的路径 |
| `resolve.alias` | `Record<string, string \| (ctx) => string \| undefined>` | `{}` | 路径别名，按最长前缀匹配。值为函数时接收 `{ importer, request }`，返回替换前缀或 `undefined`（不命中）。子仓库内文件先查 `projects[].alias` 再查全局别名 |
| `resolve.extensions` | `Record<string, string[]>` | 无（可选） | 按模块种类覆盖/补充后缀补全顺序，与 adapter 内置表合并（用户值优先）。weapp 内置见下文 |
| `compile.js.target` | `'es5' \| 'es2018' \| 'es2020'` | `'es2018'` | JS 编译目标（SWC） |
| `compile.js.module` | `'commonjs' \| 'es6'` | `'commonjs'` | JS 产物模块格式 |
| `compile.css.lightningcss` | `boolean` | `true` | 是否用 Lightning CSS 处理 WXSS/CSS |
| `compile.minify` | `boolean \| Record<string, boolean>` | `false` | 压缩开关。对象形式按节点种类细控，如 `{ script: true, style: false }`。`mpb build --minify` 可临时覆盖为 `true` |
| `subPackage.shared` | `'duplicate' \| 'main'` | `'duplicate'` | 被多个分包引用的共享模块归属：`duplicate` 复制到各分包；`main` 提升到主包 |
| `projects` | `Array<{ name: string; src: string; alias: Record<string, string> }>` | `[]` | 子仓库（源码在仓库外的项目）。每项 `alias` 默认 `{}`，仓内文件解析先查它。仓内禁用 `/` 开头的路径（报 `ABS_PATH_IN_SUBPROJECT`） |
| `ifdef.tokens` | `Record<string, boolean \| string>` | `{}` | 块级条件编译（`@ifdef` 等）可用的 token 表；`platform` 对应的 token 自动为真 |
| `ifdef.blockcode` | `boolean` | `true` | 是否启用块级条件编译 |
| `plugins` | `Plugin[]` | 无（可选） | 插件列表，见 [插件 API](#/plugins/api) 与 [官方插件](#/plugins/official) |

## 字段详解

### entry

两种给法：字符串（入口文件路径，相对项目根，动态 import）或内联对象。entry 对象含 `router` 数组时为 router 形态，否则为经典形态：

```js
// router 形态：逻辑页 -> 源码位置，app.json 由 entry 生成（virtual:app.json）
export default defineConfig({
  entry: './entry.js', // 该文件 export router: [{ root, pages: { 逻辑页: 源码位置 } }]
})
```

- **router 形态**：页面来自 `router` 映射；entry 对象里除 `router` / `pages` / `subPackages` 之外的顶层键（如 `networkTimeout`、`permission`）原样透传进生成的 `app.json`。
- **经典形态**：页面发现来自**磁盘上的 `src/app.json`**（作为 app 入口脚本的伴生文件入图），entry 对象的 `pages` / `subPackages` 与顶层键**不被读取**——必须有物理 `src/app.json`。
- 字符串路径动态 import 失败报 `ENTRY_LOAD`；entry 值不是对象同样报 `ENTRY_LOAD`。

形态与规则详见 [entry 与路由](#/guide/entry)。

### target 与 platform

- `target` 默认 `'weapp'`（微信小程序），决定模块种类（script/json/template/style/script-module/asset）、产物后缀、模板标签扫描规则等。字符串形式只识别 `'weapp'`，其他值报 `UNKNOWN_TARGET`；自定义平台可实现 `TargetAdapter` 接口后把对象传给 `target`。
- `platform` 与 `target` 解耦：它决定文件级多态 infix 与 `@ifdef wx` 这类块级条件的取值。解析时 `name.wx.js` 优先于 `name.js`；**剥 infix 只发生在套件成员（app/页面/组件）与 `*.config.js` 上**（`index.wx.js` 产物为 `index.js`），普通模块解析时同样优先命中带 infix 的文件，但产物保留 infix（`utils.wx.ts` 的产物仍是 `utils.wx.js`）。详见 [条件编译与多态](#/guide/conditional-compilation)。

### resolve.extensions

按模块种类给出后缀补全顺序，与 adapter 内置表合并（同名种类以用户配置覆盖）。weapp 内置：

| 种类 | 后缀顺序 |
|---|---|
| `script` | `.ts` → `.js` → `.tsx` → `.jsx` |
| `json` | `.config.js` → `.json` |
| `template` | `.wxml` |
| `style` | `.wxss` → `.css` |
| `script-module` | `.wxs` |
| `asset` | （空） |

注意边界：该覆盖只作用于源码内请求的解析；**npm 包内解析**（包入口字段与子路径补全）固定使用 adapter 内置后缀表，不受 `resolve.extensions` 影响。

### compile.minify

```js
export default defineConfig({
  // 全开
  compile: { minify: true },
  // 或按节点种类细控
  compile: { minify: { script: true, style: true, json: true } },
})
```

命令行 `mpb build --minify` 会在本次进程内把它覆盖为 `true`，见 [CLI 参考](#/reference/cli)。

### projects（子仓库）

```js
import { join } from 'node:path'

export default defineConfig({
  projects: [
    {
      name: '@one',
      src: join(import.meta.dirname, '../projects/one'),
      alias: { '@one': join(import.meta.dirname, '../projects/one') },
    },
  ],
})
```

- `src` 指向仓库外目录即可把其中的源码纳入构建；`alias` 默认 `{}`。
- 子仓库内文件的解析**先查 `projects[].alias`，再查全局 `resolve.alias`**。
- 子仓库内禁止使用 `/` 开头的源码根路径，违反报 `ABS_PATH_IN_SUBPROJECT`。详见 [分包与子仓库](#/guide/subpackages)。

### ifdef

```js
export default defineConfig({
  platform: 'wx',
  ifdef: {
    tokens: { ios: true, channel: 'official' },
    blockcode: true, // 默认 true；置 false 关闭块级条件编译
  },
})
```

`platform` 对应的 token（上例的 `wx`）在条件编译上下文中自动为真，无需在 `tokens` 里重复声明。

## 相关诊断码

配置加载与解析阶段可能遇到：`CONFIG_NOT_FOUND`、`LEGACY_CONFIG`、`CONFIG_TS_SKIPPED`、`ENTRY_LOAD`、`UNKNOWN_TARGET`，触发条件与处置见 [诊断码](#/reference/diagnostics)。
