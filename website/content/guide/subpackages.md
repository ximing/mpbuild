---
title: 分包与子仓库
group: 指南
order: 4
---

# 分包与子仓库

## 归属模型:多源染色

mpbuild 用「多源染色」决定每个模块归属哪个包:从各包入口(主包页面与各分包页面)出发,沿影响归属的依赖边遍历全图,记录每个模块被哪些包触及,然后写出 `owner`:

- 被主包触及 → `owner = main`,输出到主包
- 只被某一个分包触及 → `owner = <分包 root>`,只输出到该分包
- 被多个分包触及(且未被主包触及)→ `owner = shared`

## shared 模块:`subPackage.shared`

shared 模块的输出策略由 `subPackage.shared` 决定:

| 取值 | 行为 |
|---|---|
| `duplicate`(默认) | 复制到每一个触及它的分包,各分包各持一份 |
| `main` | 提升到主包,全图只输出一份 |

```js
import { defineConfig } from '@mpbuild/core'

export default defineConfig({
  subPackage: { shared: 'duplicate' },
})
```

## 独立分包

在分包声明上标 `independent: true` 即声明独立分包:router 形态写在 entry 对应的分包组上,经典形态写在磁盘 `src/app.json` 的 `subPackages` 里(形态差异见 [entry 与路由](#/guide/entry))。独立分包与主包之间不允许存在影响归属的依赖边:独立分包不能引用主包的模块,主包也不能引用独立分包的模块。违例报 `INDEPENDENT_PACKAGE_EDGE`,微信平台下为 error 级诊断。

## 路径冲突与环

- `PATH_COLLISION`(warning):两个不同模块映射到同一个产物路径时,后到者的产物文件名加 `-<内容 hash 前 8 位>` 后缀,避免互相覆盖。
- `CYCLE`(warning):影响归属的依赖边构成环时给出告警,构建继续。

## 子仓库:`projects`

当页面、组件或工具代码来自主工程 `src` 之外的独立目录(独立维护的组件库、跨项目共享的业务包),用 `projects` 把它们声明为子仓库(取代 4.x 的 SubProjectPlugin):

```js
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@mpbuild/core'

const root = dirname(fileURLToPath(import.meta.url))
const one = join(root, '../projects/one')
const two = join(root, '../projects/two')

export default defineConfig({
  resolve: {
    alias: { '@one': one, '@two': two },
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
})
```

以上配置取自 `example/demo/mpbuild.config.mjs`,子仓库源码见 `example/projects/one` 与 `example/projects/two`。规则:

- `projects[].src` 指向子仓库根目录;`name` 是它在依赖图里的命名空间,节点 id 形如 `@one/pages/test/index`。
- **解析顺序**:子仓库内的文件发起 import 时,先查该子仓库自己的 `projects[].alias`(最长前缀匹配),查不到再走全局 `resolve.alias`。
- 子仓库内**禁止**使用 `/` 开头的「相对 src 根」路径(子仓库没有主工程的 src 概念),违例报 `ABS_PATH_IN_SUBPROJECT`(error 级);请改用相对路径或 alias。
- 多个 `projects[].src` 重叠时,一个路径归属于 `src` 更长的那个子仓库。
- entry 的 router 形态可以把子仓库页面直接编进主包或分包,如 `example/demo/entry.js` 中的 `'pages/one-test/index': '@one/pages/test/index'`。

> [!NOTE]
> 4.x 的 SubProjectPlugin 已移除,对应能力由 `projects` 配置承担,迁移细节见 [从 4.x 迁移](#/migration/from-v4)。
