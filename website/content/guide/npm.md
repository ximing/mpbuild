---
title: npm 支持
group: 指南
order: 5
---

# npm 支持

mpbuild 内置 npm 包构建能力:源码里直接 `import` / `require` 裸包名即可,不需要额外的「构建 npm」步骤,也不需要用户配置任何插件。

```js
import dayjs from 'dayjs'

Page({
  onLoad() {
    console.log(dayjs().format('YYYY-MM-DD'))
  },
})
```

## 入口字段优先级

解析裸包名时,mpbuild 从 importer 所在目录向上逐级查找 `node_modules/<包名>/package.json`,找到后按以下字段顺序取包入口(微信平台):

1. `miniprogram`
2. `browser`
3. `main`
4. `module`

细则:

- 字段值可以是字符串路径,也可以是含 `'.'` 键的对象(取 `'.'` 的值)。
- 带子路径的引用(如 `pkg/lib/foo`):若 `miniprogram` 字段指向一个目录,先在该目录内解析子路径,解析不到再回退到包根目录解析。
- 以上字段都不命中时,回退到包根目录按 `index` 等常规候选补全。

## 输出位置

npm 依赖的产物输出到 `<output.dir>/<output.npm>/` 下,保留包内相对路径结构。`output.npm` 默认为 `'npm'`,即默认落在 `dist/npm/`:

```js
import { defineConfig } from '@mpbuild/core'

export default defineConfig({
  output: { dir: 'dist', npm: 'miniprogram_npm' },
})
```

## 内置 npmCompat 变换

emit 阶段,所有位于 `node_modules` 内的 script 文件会自动再经过一次与 `compile.js` 相同的 SWC 变换(target 与 module 取自 `compile.js` 配置),把 npm 包转成小程序可运行的形态。

这是**内置能力,不需要用户在 `plugins` 里加任何插件**;磁盘缓存键也区分了该变换是否生效,见 [watch 与缓存](#/guide/watch-cache)。

> [!NOTE]
> npmCompat 只做语法降级与模块制式变换,不注入 polyfill,也不处理 `require('fs')` 这类 Node 内置模块引用——依赖 Node API 的包仍然无法用。

## watch 行为

watch 模式下,**已经入图**的 npm 文件会被精确到单文件地监听,而不是监听整个 `node_modules` 目录;未入图的 `node_modules` 内容一律忽略。改动已入图的 npm 文件会触发增量重建,细节见 [watch 与缓存](#/guide/watch-cache)。
