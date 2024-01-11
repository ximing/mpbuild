---
title: 暂不支持
group: 参考
order: 4
---

# 暂不支持

以下是 v5 首发**明确不做**的能力清单。每条给出现状与可用的替代做法。这份清单描述的是现状，后续版本是否补齐以 CHANGELOG 为准。

## 抖音 / 头条等小程序平台

- **现状**：内置 adapter 仅 `'weapp'`（微信），也不发布抖音/头条/支付宝/百度的官方 adapter；`target` 传其他字符串报 `UNKNOWN_TARGET`。
- **替代**：`target` 接受自定义 `TargetAdapter` 对象，可自行实现目标平台（接口定义见 `@mpbuild/core` 的 `types.ts`，仓库内 `v5/packages/core/src/__fixtures__/fake-mini` 是一个最小实现样例）。

## HMR（热更新）

- **现状**：没有 HMR 运行时，`mpb dev` 只做增量重建写盘。
- **替代**：watch 本身基于内容 hash 增量建图、差量写盘，重建开销已经很小；在开发者工具里刷新预览即可。

## 打成少量 JS bundle

- **现状**：不做 bundle，模块按依赖图一对一变换、按归属写盘，保持小程序原生的模块结构。
- **替代**：无；这是架构决策而非待办。压缩体积用 `compile.minify` 或 `mpb build --minify`。

## workers / sitemap / tabBar 图标入图

- **现状**：`workers` 目录、`sitemap.json`、tabBar 图标等资源不参与依赖图，不会被自动收集产出。
- **替代**：用官方 `copy()` 插件按 extras 直拷这些文件（见 [官方插件](#/plugins/official)）。

## WXML `<image src>` 资源抽取

- **现状**：WXML 里 `<image>` 的 `src` 不建依赖边，引用的图片不会自动入图。
- **替代**：同样用 `copy()` 直拷图片目录；或改用 `resolve.alias` 让 JS/样式里的资源路径可解析。

## JSON `extends`

- **现状**：页面/组件 JSON 不支持 `extends` 继承。
- **替代**：用 `*.config.js` 代替 JSON——它在隔离环境执行后序列化为 JSON，可以在文件里自由组合公共片段（见 [entry 与路由](#/guide/entry)）。

## minify 的 include / exclude

- **现状**：`compile.minify` 只接受 `boolean` 或按节点种类的对象（如 `{ script: true }`），不支持按文件路径 include/exclude。
- **替代**：按种类粗粒度控制；个别不想压缩的文件保持其源码即为压缩友好形态。

## 完整 PluginContext

- **现状**：插件上下文只暴露当前所需的最小字段与方法（`load` 钩子的 kind/路径信息、`generate` 钩子的 outputDir/rootDir/srcDir/graph/plan 与 `warn`），未开放完整编译器内部状态。
- **替代**：在现有 `load` / `generate` 两段钩子内表达需求，见 [插件 API](#/plugins/api)。

## `copy({ graph: true })`

- **现状**：copy 插件的 `graph: true`（拷贝产物入依赖图）未实现，调用时只报 `COPY_GRAPH_UNSUPPORTED` 警告并按 extras 直拷。
- **替代**：默认的 extras 直拷（`**` 含零层目录），见 [官方插件](#/plugins/official)。

## 用户侧 `virtual:` 模块 API

- **现状**：`virtual:` 前缀（如 `virtual:app.json`）是内部保留机制，不向用户插件开放注册虚拟模块的 API。
- **替代**：需要生成内容的场景用插件的 `generate` 钩子直接产出文件。

## 包体积强校验

- **现状**：adapter 声明了微信的体积上限（主包/分包 2048 KB、总计 30720 KB），但 v5 不在构建期做强校验、不生成 HTML 分析报告。
- **替代**：用 `mpb analyze` 生成 `<output.dir>/mpbuild-analyze.json` 检查各包产物构成，或用 `mpb inspect graph` 逐节点排查归属，见 [CLI 参考](#/reference/cli)。

## 其他

- **指定分包编译**：不支持只构建单个分包，每次构建都是全量建图（watch 下为增量）。
- **`tsc` 类型检查**：构建不做类型检查，请在编辑器或 CI 里单独跑 `tsc --noEmit`。
