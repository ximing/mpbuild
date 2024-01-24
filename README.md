<h1 align="center">mpbuild</h1>

<p align="center">图驱动的微信小程序构建工具</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@mpbuild/cli"><img src="https://img.shields.io/npm/v/@mpbuild/cli.svg?style=flat" alt="NPM Version"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/@mpbuild/cli.svg?style=flat" alt="Node >= 20"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/@mpbuild/cli.svg?style=flat" alt="License: MIT"></a>
  <a href="https://github.com/ximing/mpbuild/actions/workflows/github-pages.yml"><img src="https://github.com/ximing/mpbuild/actions/workflows/github-pages.yml/badge.svg" alt="Deploy Website"></a>
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="#contributors-"><img src="https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square" alt="All Contributors"></a>
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
</p>

## 简介

mpbuild 5.x 是一次图驱动的整体重写：从源文件出发构建依赖图，经归属分析、Output Plan 到变换写盘，四段流水线职责清晰。历史上的 `mpbuild@4`（无作用域包）已冻结，不会再发布新版本；当前发布的包是 [`@mpbuild/core`](https://www.npmjs.com/package/@mpbuild/core) 与 [`@mpbuild/cli`](https://www.npmjs.com/package/@mpbuild/cli)，命令行为 `mpb`。

## 特性

- **图驱动流水线** — 建图 → 归属分析 → Output Plan → 变换写盘，行为可推理、可检查
- **SWC + Lightning CSS** — JS/CSS 变换原生级速度，无沉重的前端编译链负担
- **精准分包** — 多源染色归属模型，shared 模块复制进分包或提升到主包可配
- **增量 watch + 磁盘缓存** — 内容 hash 增量建图，差量写盘，重启后缓存复用
- **条件编译与多态** — 文件级 infix（`name.wx.js`）+ 块级 `@ifdef`，编译时拆分多端代码
- **npm 支持** — 内置 npmCompat 变换，海量 npm 包开箱即用
- **插件体系** — `load` / `generate` 两段钩子，官方提供 SCSS、projectConfig、copy 插件
- **可观测** — `mpb analyze` 产物分析、`mpb inspect graph` 逐节点图检查、16 个语义化诊断码

## 要求

- Node.js `>= 20`
- 包为纯 ESM

## 快速开始

```bash
npm i -D @mpbuild/cli
```

`@mpbuild/cli` 依赖 `@mpbuild/core`，装这一个即可。

在项目根目录新建 `mpbuild.config.mjs`：

```js
import { defineConfig } from '@mpbuild/core'

export default defineConfig({
  entry: './entry.js',
  src: 'src',
  platform: 'wx',
  output: { dir: 'dist' },
})
```

对应的 `entry.js`（router 形态——由 entry 直接生成产物 `app.json`，无需磁盘 `src/app.json`）：

```js
module.exports = {
  router: [
    { root: '', pages: { 'pages/index/index': '/pages/index/index' } },
  ],
}
```

`src` 目录下必须存在 `app.js` 或 `app.ts`，否则报 `MISSING_APP_JS`。entry 另有经典形态（`{ pages, subPackages }`），其页面结构以磁盘 `src/app.json` 为准且该文件必须存在，entry 里的字段不会被消费——两种形态的差异与坑点见文档站 [entry 与路由](https://ximing.github.io/mpbuild/#/guide/entry)。

```bash
mpb build   # 构建一次
mpb dev     # 构建并进入 watch
```

完整可运行示例见 [`example/demo`](example/demo)。全部配置项见文档站[配置参考](https://ximing.github.io/mpbuild/#/reference/config)。

## 文档

文档站：<https://ximing.github.io/mpbuild/>

常用入口：

- [快速开始](https://ximing.github.io/mpbuild/#/guide/getting-started)
- [配置参考](https://ximing.github.io/mpbuild/#/reference/config)
- [CLI 参考](https://ximing.github.io/mpbuild/#/reference/cli)
- [插件 API](https://ximing.github.io/mpbuild/#/plugins/api)
- [诊断码](https://ximing.github.io/mpbuild/#/reference/diagnostics)
- [FAQ](https://ximing.github.io/mpbuild/#/faq)

## 从 4.x 迁移

> [!WARNING]
> 5.x 与 4.x 不兼容，升级前请至少注意以下 breaking changes：
>
> - **包名变更**：`mpbuild` → `@mpbuild/core` + `@mpbuild/cli`，无作用域的 `mpbuild` 包不再发布
> - **配置文件改名**：只读取 `mpbuild.config.{ts,mts,js,mjs}`，不再读取 `mpb.config.js`（报 `LEGACY_CONFIG`，退出码 2）
> - **`require('./x.json')` 不再内联**：JSON 作为模块入图处理，产物形态与 4.x 不同
> - **插件 API 全新**：`load` / `generate` 两段钩子，与 4.x 插件不兼容

完整迁移指南见文档站[从 4.x 迁移](https://ximing.github.io/mpbuild/#/migration/from-v4)与 [docs/migration-v5.md](docs/migration-v5.md)。

## 包与仓库布局

| 包 | 路径 | 说明 |
|---|---|---|
| [`@mpbuild/core`](https://www.npmjs.com/package/@mpbuild/core) | [`packages/core`](packages/core) | 图驱动编译器核心 |
| [`@mpbuild/cli`](https://www.npmjs.com/package/@mpbuild/cli) | [`packages/cli`](packages/cli) | 命令行 `mpb` |

5.x 代码位于 `packages/`；金样示例在 [`example/demo`](example/demo)。

## 生态链接

- [CHANGELOG.md](CHANGELOG.md) — 版本变更记录
- [CONTRIBUTING.md](CONTRIBUTING.md) — 贡献指南
- [Issue 模板](.github/ISSUE_TEMPLATE) / [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)

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
