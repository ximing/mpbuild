---
title: watch 与缓存
group: 指南
order: 6
---

# watch 与缓存

## `mpb dev` 的行为

`mpb dev` 先做一次完整构建,随后进入 watch:诊断(error / warning)打印到 stderr,打印完进程保持存活,继续监听文件变更。

以下三种写法等价:`mpb dev`、`mpb --watch`、`mpb build --watch`。注意最后一种写法不会应用 `--minify`(`--minify` 只对纯 `mpb build` 生效)。

## 监听策略

- 基于 chokidar,文件事件经 **80ms 防抖**后批量处理。
- 监听集合包括:已入图文件的 sourcePath、每个 script 所在目录、`src` 目录、`projects[].src`、插件通过 `addWatchFile` 登记的文件,以及配置文件与 entry 文件。
- `node_modules` 内只精确监听已入图的 npm 文件(单文件级别),不监听整个目录,见 [npm 支持](#/guide/npm)。
- `*.config.js` 执行时 `require` 的相邻文件也会进入监听集合,改动后触发所属节点重建(见 [entry 与路由](#/guide/entry))。

## 增量重建

一次变更批次(tick)的处理流程:

1. **图补丁**:只对变更 / 删除 / 新增的模块 id 重新解析与抽取,未受影响的节点直接复用。节点 hash 取「load + 条件编译之后、transform 之前」的内容字节。
2. **拓扑比较**:`topologyChanged` 谓词比较节点集合、边、入口、分包与页面/组件套件伴生关系;拓扑没变则跳过归属分析与分包规划。
3. **计划比较**:`planChanged` 谓词比较每个模块的产物路径与所在包、以及 shared 模块的包集合,判断产物布局是否变化。
4. **差量写盘**:以 `clean: false` 写出产物;内容字节相同的文件不重写,上一轮存在而本轮消失的产物路径会被删除。

## 配置变更:全量重建

以下文件的变更不走增量,而是重新加载配置(`reloadConfig`)并做全量重建:

- `mpbuild.config.ts` / `.mts` / `.js` / `.mjs`
- `entry` 指向的文件

## 磁盘缓存

script / script-module / style(即 JS、WXS、WXSS/CSS)的 transform 结果有磁盘缓存:

- **位置**:`<项目根>/node_modules/.cache/mpbuild`。
- **缓存键**:内容 hash + `compile.js` / `compile.css` / `minify` / `platform` / `ifdef.tokens` 配置 + `@mpbuild/core`、SWC、Lightning CSS 的版本号 + 节点类型与文件扩展名 + 是否走 npmCompat。任一因素变化都会得到不同的键,缓存自然失效,通常无需手动清理。
- **容量回收**:超过 4096 个缓存文件后,按 mtime 从最旧的开始删除。
- **禁用**:`mpb build --no-cache` 整轮禁用磁盘缓存。
