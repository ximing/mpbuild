---
title: 插件 API
group: 插件
order: 1
---

# 插件 API

mpbuild 的插件是一个普通对象：必填的 `name`，加上两个可选钩子——在依赖图构建阶段拦截模块内容的 `load`，和在产物写盘阶段追加文件的 `generate`。钩子可以是同步或异步函数，只实现你需要的那个即可。

> [!WARNING]
> v5 的插件 API 与 4.x **完全不兼容**。4.x 基于 Tapable 的钩子体系（`compiler.hooks.xxx.tap(...)`）已整体移除，为 4.x 编写的插件无法在 v5 中加载，需要按本文的接口重写。迁移事项汇总见[从 4.x 迁移](#/migration/from-v4)。

## 插件接口

```ts
interface Plugin {
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
```

`Plugin`、`PluginLoadContext`、`PluginGenerateContext` 三个类型均从 `@mpbuild/core` 导出。

## 注册插件

在配置文件（如 `mpbuild.config.mjs`）的 `plugins` 数组中按顺序注册：

```js
import { defineConfig, legacyScss, projectConfig } from '@mpbuild/core'

export default defineConfig({
  // ...其余配置
  plugins: [
    legacyScss(),
    projectConfig({ projectname: 'demo', appId: 'your-appid' }),
  ],
})
```

## load 钩子

建图阶段对每个模块调用一次，插件可以替换该模块参与后续依赖分析与编译的内容。

- `id` 是模块 id；`ctx.code` 是该模块当前的内容。
- 返回一个字符串即替换模块内容；返回 `undefined`（或不返回值）表示不处理。
- **第一个返回字符串的插件胜出**：一旦有插件返回字符串，剩余插件的 `load` 不会再作用于该模块——不存在逐插件链式传递，插件顺序因此很重要。

`PluginLoadContext` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `adapter` | `TargetAdapter` | 当前目标平台适配器 |
| `kind` | `AbstractKind` | 模块种类：`script` / `json` / `template` / `style` / `script-module` / `asset` |
| `sourcePath` | `string` | 模块源文件的绝对路径 |
| `code` | `string` | 模块当前内容 |
| `addWatchFile(path)` | 函数 | 把额外文件加入 watch 监听（例如预处理器的 mixin 依赖） |
| `warn(d)` | 函数 | 上报一条 warning 级诊断 |
| `error(d)` | 函数 | 上报一条 error 级诊断 |

`warn` / `error` 接收形如 `{ code, severity, message, file? }` 的对象，诊断码见[诊断码](#/reference/diagnostics)。

## generate 钩子

在产物写盘阶段调用：完整构建时执行一次，watch 模式下每个变更 tick 也会执行。插件通过返回文件描述对象来向输出目录追加文件。

- 入参 `file` 是一个合成文件，其 `destPath` 指向输出目录下的项目配置文件（微信目标为 `<output.dir>/project.config.json`），`content` 为空字符串——它的主要作用是让 `projectConfig` 这类插件定位项目配置文件，不代表真实模块产物。
- 返回单个文件对象或文件对象数组，编译器会把它们写盘（自动创建父目录）；返回 `undefined` 表示本次不产出文件。
- 多个插件的 `generate` 按 `plugins` 数组顺序依次执行，各自返回的文件都会被写出。

`PluginGenerateContext` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `adapter` | `TargetAdapter` | 当前目标平台适配器 |
| `outputDir` | `string` | 输出目录绝对路径 |
| `rootDir` | `string` | 项目根目录绝对路径 |
| `srcDir` | `string` | 源码目录绝对路径（`rootDir` + `src`） |
| `graph` | `ModuleGraph` | 本次构建的依赖图 |
| `plan` | `OutputPlan` | 本次构建的输出计划 |
| `addWatchFile(path)` | 函数 | 把额外文件加入 watch 监听 |
| `warn(d)` | 函数 | 上报一条 warning 级诊断 |

## 下一步

- [官方插件](#/plugins/official)：`legacyScss` / `projectConfig` / `copy` 的用法与行为。
- [配置参考](#/reference/config)：`plugins` 配置项在完整配置表中的位置。
