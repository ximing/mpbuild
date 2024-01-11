---
title: 官方插件
group: 插件
order: 2
---

# 官方插件

`@mpbuild/core` 内置并导出三个用户侧插件：`legacyScss`、`projectConfig`、`copy`。它们在配置文件的 `plugins` 数组中注册（注册方式见[插件 API](#/plugins/api)）。另有一个 `npmCompat` 变换内置在写盘管线中，不需要也不应该以插件形式手动添加，本文最后一节仅作说明。

## legacyScss()

为样式模块提供 SCSS 语法支持。内部以 `postcss-scss` 作为解析器，叠加变量与 mixin（`@yeanzhi/postcss-advanced-variables`）和嵌套规则（`postcss-nested`，`@keyframes` 会上提）处理后产出 CSS。

```js
import { defineConfig, legacyScss } from '@mpbuild/core'

export default defineConfig({
  // ...其余配置
  plugins: [legacyScss()],
})
```

行为细节：

- 只作用于样式模块（模块种类为 `style` 的文件），对其他种类不处理。
- mixin 导入只处理路径中包含 `mixin` 的文件；被导入的 mixin 文件会通过 `addWatchFile` 加入 watch 监听，改动后触发重建。
- 语法解析失败时上报 error 级诊断 `UNSUPPORTED_PREPROCESSOR`。

## projectConfig(opts)

在输出目录生成项目配置文件（微信目标为 `project.config.json`），内容包含开发者工具所需的 `appid`、`projectname` 与 `setting`。

```js
import { defineConfig, projectConfig } from '@mpbuild/core'

export default defineConfig({
  // ...其余配置
  plugins: [
    projectConfig({
      projectname: 'demo',
      appId: 'your-appid',
      setting: { minified: true },
    }),
  ],
})
```

参数：

| 参数 | 类型 | 说明 |
|---|---|---|
| `projectname` | `string` | 项目名称，写入 `projectname` 字段 |
| `appId` | `string` | 小程序 AppID，写入 `appid` 字段 |
| `setting` | `Record<string, unknown>` | 可选，合并进 `setting` 字段 |

生成的 `setting` 默认值为 `{ urlCheck: false, es6: false, postcss: true, minified: false }`，传入的 `setting` 按键覆盖默认值。

> [!NOTE]
> **不覆盖已有文件**：如果输出目录下已存在项目配置文件，插件直接跳过、不写盘。手工维护的 `project.config.json` 不会被冲掉。

## copy(patterns, opts?)

把源码树之外的静态文件（或源码树内需原样保留的文件）按相对路径复制到输出目录。完整构建时执行一次，watch 模式下每个变更 tick 重新执行，被复制的文件会加入 watch 监听。

```js
import { defineConfig, copy } from '@mpbuild/core'

export default defineConfig({
  // ...其余配置
  plugins: [copy(['src/assets/**/*', 'static/**/*'])],
})
```

参数：

- `patterns`：`string | string[]`，一个或多个匹配模式，相对项目根目录解析。
- `opts.graph`：`boolean`，可选。传 `true` 目前**未实现**——会上报 warning 级诊断 `COPY_GRAPH_UNSUPPORTED` 并退化为普通的 extras 复制。

匹配语义（自实现的 glob，不依赖第三方库）：

- 模式中不含 `*` 时按字面**文件**路径处理：文件存在即复制，不存在则忽略。
- `*` 匹配单层路径段内的任意字符（不跨 `/`）。
- `**/` 匹配**零层或多层**目录，因此 `src/**/*.png` 同时命中 `src/a.png` 与 `src/x/y/b.png`。
- 单独的 `**` 匹配任意字符（可跨 `/`）。
- 遍历时跳过 `node_modules`、`.git` 与输出目录；只有文件会被复制（不产生空目录）。

> [!WARNING]
> 非 glob 的字面模式只支持**文件**路径。如果字面模式指向一个目录，复制该目录时会读取失败并导致构建报错——复制整个目录请改用 glob 模式（如 `'static/**/*'`）。

输出位置：位于源码目录（`src`）内的文件保持其相对 `src` 的路径写入输出目录；其余文件保持其相对项目根目录的路径写入输出目录。

## npmCompat（内置，非用户侧插件）

`npmCompat` 不是插件，也不在 `plugins` 数组里注册。它是写盘管线的内置变换：当目标平台的 `npmCompat` 为 `weapp`（微信目标默认开启）时，对来自 `node_modules` 的脚本模块执行一次与 `compile.js` 相同的 SWC 变换，让 npm 包语法与目标一致。它不处理 `require('fs')` 这类 Node 内置模块引用。

用法与入口字段优先级等细节见[npm 支持](#/guide/npm)。
